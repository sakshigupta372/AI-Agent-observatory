import { useCallback, useRef, useState } from 'react'
import { MEMORY_CLUSTERS } from '../data/memoryClusters.js'
import { runSummary, stepEnd, stepStart, toolPlainName } from '../data/narration.js'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const CLUSTER_LABELS = Object.fromEntries(MEMORY_CLUSTERS.map((c) => [c.id, c.label]))
const TOOL_CLUSTER = {
  web_search: 'conversations',
  calculator: 'projects',
  database: 'users',
  external_api: 'documents',
}

// Server steps can finish in a few milliseconds; each visual state is held
// at least this long so the viewer can follow the order.
const MIN_DWELL = 700
const STEER_WINDOW = 1800

const IDLE_STATE = {
  running: false,
  awaitingSteer: false,
  activeNodeId: null,
  activeConnection: null,
  activeTool: null,
  packetTrigger: null,
  plannerTrigger: null,
  memoryTrigger: null,
  memoryStats: null,
  memoryLitIds: [],
  label: '',
  response: null,
  error: null,
  sources: [],
  asOf: null,
  trace: [],
  memorySnapshot: null,
  streamText: '',
  verdicts: [],
  confidence: null,
  frames: [],
  ghostEdges: [],
  visitedEdges: [],
  shockKey: 0,
  query: '',
  feedbackCount: 0,
  replans: [],
  runTrace: null,
  story: [],
  summary: null,
}

const clock = () => new Date().toLocaleTimeString('en-GB')

async function postJson(body, signal) {
  try {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) return { error: data?.error || `Request failed (${res.status})`, ...data }
    return data
  } catch (err) {
    return { error: err.name === 'AbortError' ? 'Stopped by user' : err.message }
  }
}

async function streamExecute(query, plan, onEvent, extra = {}, signal) {
  try {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'execute', query, plan, ...extra }),
      signal,
    })
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => null)
      return { error: data?.error || `Request failed (${res.status})` }
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let donePayload = null
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''
      for (const part of parts) {
        const line = part.split('\n').find((item) => item.startsWith('data:'))
        if (!line) continue
        try {
          const event = JSON.parse(line.slice(5).trim())
          if (event.type === 'done') donePayload = event
          else onEvent(event)
        } catch {
          // A split event is completed on the next chunk.
        }
      }
    }
    return donePayload || { error: 'The agent stream ended before a result.' }
  } catch (err) {
    return { error: err.name === 'AbortError' ? 'Stopped by user' : err.message }
  }
}

export function useAgentExecution() {
  const [state, setState] = useState(IDLE_STATE)
  const runId = useRef(0)
  const steerWait = useRef(null)
  const abortRef = useRef(null)

  const steer = useCallback((tool) => {
    steerWait.current?.(tool)
  }, [])

  const stop = useCallback(() => {
    runId.current += 1
    abortRef.current?.abort()
    steerWait.current?.(null)
    setState((prev) => ({
      ...prev,
      running: false,
      awaitingSteer: false,
      activeNodeId: null,
      activeConnection: null,
      activeTool: null,
      label: 'Stopped',
      error: prev.response ? prev.error : prev.error || 'Run stopped by user.',
      summary: { status: 'failed', title: 'Stopped', lines: [], error: 'You stopped this run.' },
    }))
  }, [])

  const recall = useCallback((memory) => {
    runId.current += 1
    setState((prev) => ({
      ...prev,
      running: false,
      awaitingSteer: false,
      response: memory.summary,
      error: null,
      sources: [],
      verdicts: [],
      asOf: memory.createdAt,
      query: memory.query,
      label: 'Recalled run',
      streamText: '',
      story: [],
      summary: { status: 'ok', title: 'Recalled from memory', lines: ['This answer was saved by an earlier run; nothing was re-run.'], error: null },
    }))
  }, [])

  const run = useCallback(async (query, options = {}) => {
    const id = ++runId.current
    const alive = () => runId.current === id
    const controller = new AbortController()
    abortRef.current = controller
    const frames = []
    const visited = []
    const started = performance.now()
    let ghostEdges = []
    let storySeq = 0

    // Visual changes go through a queue so fast server steps stay visible
    // for MIN_DWELL each, in the order they actually happened.
    const queue = []
    let pumping = false
    const pump = async () => {
      pumping = true
      while (queue.length) {
        if (!alive()) {
          queue.length = 0
          break
        }
        const { apply, hold } = queue.shift()
        apply()
        await delay(hold ?? MIN_DWELL)
      }
      pumping = false
    }
    const enqueue = (apply, hold) => {
      queue.push({ apply, hold })
      if (!pumping) pump()
    }
    const drained = async () => {
      while (pumping || queue.length) await delay(40)
    }

    const show = (visual, extra = {}) => {
      frames.push({
        activeNodeId: visual.activeNodeId ?? null,
        activeConnection: visual.activeConnection ?? null,
        activeTool: visual.activeTool ?? null,
        label: visual.label || '',
      })
      if (visual.activeConnection) visited.push(visual.activeConnection)
      setState((prev) => ({
        ...prev,
        activeNodeId: visual.activeNodeId ?? null,
        activeConnection: visual.activeConnection ?? null,
        activeTool: visual.activeTool ?? null,
        label: visual.label || prev.label,
        packetTrigger: visual.activeConnection
          ? { key: `${id}-${frames.length}`, connection: visual.activeConnection, count: visual.packets ?? 1, duration: 650 }
          : prev.packetTrigger,
        ...(typeof extra === 'function' ? extra(prev) : extra),
      }))
    }

    const addStory = (item) => {
      const key = `${id}-${(storySeq += 1)}`
      setState((prev) => ({ ...prev, story: [...prev.story, { key, status: 'live', ...item }] }))
      return key
    }
    const settleStory = (key, patch) => {
      setState((prev) => ({ ...prev, story: prev.story.map((item) => (item.key === key ? { ...item, ...patch } : item)) }))
    }
    const logTrace = (entry) => {
      setState((prev) => ({
        ...prev,
        trace: [...prev.trace, { id: `${entry.event}-${performance.now()}`, time: clock(), ...entry }],
      }))
    }

    setState((prev) => {
      ghostEdges = prev.visitedEdges || []
      return {
        ...IDLE_STATE,
        running: true,
        label: 'Reading your question…',
        query,
        ghostEdges,
        shockKey: prev.shockKey,
      }
    })

    // 1. Route: real request, shown on the input nodes while it runs.
    show({ activeNodeId: 'user', label: 'Reading your question…' })
    const routeKey = addStory({ node: 'intent', text: 'Reading your question…' })
    const routeStarted = performance.now()
    const planResult = await postJson({ phase: 'route', query }, controller.signal)
    const routeMs = Math.round(performance.now() - routeStarted)
    if (!alive()) return

    if (!planResult?.tool) {
      const error = planResult?.error || 'Intent routing failed. Check GROQ_API_KEY in .env and restart the dev server.'
      settleStory(routeKey, { status: 'failed', text: 'Could not understand the question.', detail: error })
      logTrace({ event: 'ROUTE', latency: routeMs, failed: true, detail: { step: 'route', phase: 'Routing', note: error } })
      setState((prev) => ({
        ...prev,
        ...IDLE_STATE,
        story: prev.story,
        trace: prev.trace,
        ghostEdges,
        query,
        shockKey: prev.shockKey + 1,
        error,
        summary: { status: 'failed', title: 'Could not answer', lines: [], error },
      }))
      return
    }

    let plan = planResult
    settleStory(routeKey, {
      status: 'ok',
      text: `Understood: ${plan.intentLabel}${plan.routedBy === 'keywords' ? ' (keyword fallback)' : ''}.`,
      ms: routeMs,
    })
    logTrace({ event: 'ROUTE', latency: routeMs, detail: { step: 'route', phase: plan.intentLabel, note: `Routed by ${plan.routedBy}` } })

    enqueue(() => show({ activeConnection: ['user', 'intent'], label: `Understood: ${plan.intentLabel}` }), 450)
    enqueue(() => show({ activeNodeId: 'intent', label: `Understood: ${plan.intentLabel}` }), 450)
    enqueue(() => show({ activeConnection: ['intent', 'planner'], label: 'Planning…' }), 450)
    enqueue(() =>
      show(
        { activeNodeId: 'planner', label: `Planned ${plan.tasks.length} steps` },
        { plannerTrigger: { key: `${id}-plan`, tasks: plan.tasks, duration: 400 + plan.tasks.length * 300 } }
      ),
      400 + plan.tasks.length * 300
    )
    await drained()
    if (!alive()) return

    // 2. Steering window: the planner's tool choice can be overridden.
    const planKey = addStory({ node: 'planner', text: `Planner picked ${toolPlainName(plan.tool)}. Tap another tool to override.` })
    setState((prev) => ({ ...prev, awaitingSteer: true, label: `Planner picked ${toolPlainName(plan.tool)}` }))
    const choice = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), STEER_WINDOW)
      steerWait.current = (tool) => {
        clearTimeout(timer)
        resolve(tool)
      }
    })
    steerWait.current = null
    if (!alive()) return
    if (choice && choice !== plan.tool) {
      plan = { ...plan, tool: choice, memoryCluster: TOOL_CLUSTER[choice] || plan.memoryCluster, steered: true }
    }
    settleStory(planKey, {
      status: 'ok',
      text: `Plan: ${plan.tasks.length} steps using ${toolPlainName(plan.tool)}${plan.steered ? ' (your choice)' : ''}.`,
    })
    setState((prev) => ({ ...prev, awaitingSteer: false }))

    // 3. Execute: every visual below is driven by a real server event.
    const openSteps = new Map()
    const checks = []
    const onEvent = (event) => {
      if (!alive()) return
      if (event.type === 'token') {
        setState((prev) => ({ ...prev, streamText: `${prev.streamText}${event.text}` }))
      } else if (event.type === 'sources') {
        setState((prev) => ({ ...prev, sources: event.sources || [] }))
      } else if (event.type === 'reset') {
        setState((prev) => ({ ...prev, streamText: '' }))
      } else if (event.type === 'step') {
        if (event.phase === 'start') {
          const view = stepStart(event)
          if (!view) return
          const stepKey = `${event.name}#${event.attempt}`
          if (view.lead) enqueue(() => show({ activeNodeId: 'toolhub', activeConnection: view.lead, label: view.text }), 450)
          enqueue(() => {
            openSteps.set(stepKey, addStory({ node: view.tool || view.node, text: view.text, retry: view.retry }))
            const extra = {}
            if (event.name === 'memory_retrieval') {
              extra.memoryTrigger = { key: `${id}-mem-${event.attempt}`, clusterId: plan.memoryCluster, duration: 900 }
            }
            show(
              {
                activeNodeId: view.node,
                activeTool: view.tool || null,
                activeConnection: view.connection,
                packets: view.tool ? 3 : 1,
                label: view.text,
              },
              extra
            )
          })
        } else {
          const result = stepEnd(event)
          const stepKey = `${event.name}#${event.attempt}`
          if (event.name === 'verification' && event.summary?.claims != null) checks.push(event.summary)
          enqueue(() => {
            const key = openSteps.get(stepKey)
            if (key) settleStory(key, { status: result.status, text: result.text, ms: event.ms })
            logTrace({
              event: event.name.toUpperCase().replace(':', ' · '),
              latency: event.ms ?? 0,
              failed: event.status === 'error',
              detail: { step: event.name, phase: result.text, note: event.error || (event.attempt > 1 ? `Attempt ${event.attempt}` : null) },
            })
            if (event.name.startsWith('tool:') && event.status !== 'error') {
              const tool = event.name.slice(5)
              show({ activeTool: tool, activeConnection: [tool, 'toolhub'], label: result.text })
            }
          }, event.name.startsWith('tool:') ? MIN_DWELL : 120)
        }
      } else if (event.type === 'replan') {
        // A real verify -> replan feedback, emitted by the server the moment it happens.
        enqueue(() => {
          setState((prev) => ({
            ...prev,
            feedbackCount: prev.feedbackCount + 1,
            replans: [...prev.replans, event],
            story: [
              ...prev.story,
              {
                key: `${id}-replan-${event.attempt}`,
                node: 'planner',
                status: 'warn',
                retry: true,
                text: `Retrying: ${event.reason}`,
                detail: event.revisedQuery ? `New search: “${event.revisedQuery}”` : null,
              },
            ],
          }))
          show({ activeNodeId: 'planner', activeConnection: ['verifier', 'planner'], packets: 3, label: `Retrying: ${event.reason}` })
          logTrace({
            event: `REPLAN (attempt ${event.attempt})`,
            latency: 0,
            failed: true,
            detail: { step: 'replan', phase: 'Fact-check sent a failure back to the planner', note: `Why: ${event.reason}. New search: "${event.revisedQuery}". Retries left: ${event.retriesLeft}.` },
          })
        }, 900)
      }
    }

    const live = await streamExecute(query, plan, onEvent, options.inject ? { inject: options.inject } : {}, controller.signal)
    if (!alive()) return
    await drained()
    if (!alive()) return

    // 4. Result.
    const failed = Boolean(live?.error && !live?.response)
    const totalMs = Math.round(performance.now() - started)
    const items = live?.retrieved ?? []
    show(
      { activeNodeId: 'response', activeConnection: ['verifier', 'response'], label: failed ? 'Could not answer' : 'Answer ready' },
      {
        response: live?.response || null,
        error: live?.error || null,
        sources: live?.sources || [],
        asOf: live?.asOf || null,
        verdicts: live?.verdicts || [],
        confidence: live?.confidence || null,
        memorySnapshot: live?.memories || null,
        memoryLitIds: items.map((item) => item.id),
        memoryStats: {
          clusterLabel: CLUSTER_LABELS[plan.memoryCluster] ?? plan.memoryCluster,
          retrieved: items.length,
          latencyMs: live?.timings?.memoryMs ?? null,
          items,
        },
        runTrace: live?.trace || null,
      }
    )
    logTrace({ event: 'RESPONSE', latency: totalMs, failed, detail: { step: 'response', phase: failed ? 'No answer' : 'Answer delivered', note: 'Total run time in the browser' } })
    await delay(500)
    if (!alive()) return

    setState((prev) => ({
      ...IDLE_STATE,
      response: prev.response,
      error: prev.error || (prev.response ? null : live?.error || 'The agent did not return an answer.'),
      sources: prev.sources,
      asOf: prev.asOf,
      trace: prev.trace,
      memoryStats: prev.memoryStats,
      memoryLitIds: prev.memoryLitIds,
      memorySnapshot: prev.memorySnapshot,
      verdicts: prev.verdicts,
      confidence: prev.confidence,
      frames,
      ghostEdges,
      visitedEdges: visited,
      feedbackCount: prev.feedbackCount,
      replans: prev.replans,
      runTrace: prev.runTrace,
      story: prev.story,
      summary: runSummary(live, live?.trace?.totalMs ?? totalMs, checks),
      shockKey: failed ? prev.shockKey + 1 : prev.shockKey,
      query,
    }))
  }, [])

  return { ...state, run, steer, recall, stop }
}
