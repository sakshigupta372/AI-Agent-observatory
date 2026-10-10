import { useCallback, useRef, useState } from 'react'
import { buildSteps } from '../data/scenarios.js'
import { MEMORY_CLUSTERS } from '../data/memoryClusters.js'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const CLUSTER_LABELS = Object.fromEntries(MEMORY_CLUSTERS.map((c) => [c.id, c.label]))
const TOOL_CLUSTER = {
  web_search: 'conversations',
  calculator: 'projects',
  database: 'users',
  external_api: 'documents',
}

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
}

async function postJson(body) {
  const res = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) return { error: data?.error || `Request failed (${res.status})`, ...data }
  return data
}

async function streamExecute(query, plan, onEvent, extra = {}) {
  const res = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase: 'execute', query, plan, ...extra }),
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
}

function latencyFor(step, live, routeMs, lastTraceTime) {
  if (step.id === 'intent') return { latency: routeMs, note: 'Measured routing time' }
  if (step.timingKey && live?.timings?.[step.timingKey] != null) {
    return { latency: live.timings[step.timingKey], note: 'Measured API time' }
  }
  return { latency: Math.max(0, Math.round(performance.now() - lastTraceTime)), note: null }
}

export function useAgentExecution() {
  const [state, setState] = useState(IDLE_STATE)
  const runId = useRef(0)
  const steerWait = useRef(null)

  const steer = useCallback((tool) => {
    steerWait.current?.(tool)
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
    }))
  }, [])

  const run = useCallback(async (query, options = {}) => {
    const id = ++runId.current
    const alive = () => runId.current === id
    const frames = []
    const visited = []
    let ghostEdges = []

    setState((prev) => {
      ghostEdges = prev.visitedEdges || []
      return {
        ...IDLE_STATE,
        running: true,
        label: 'Classifying intent...',
        query,
        ghostEdges,
        shockKey: prev.shockKey,
      }
    })

    const record = (slice) => {
      frames.push({
        activeNodeId: slice.activeNodeId ?? null,
        activeConnection: slice.activeConnection ?? null,
        activeTool: slice.activeTool ?? null,
        label: slice.label || '',
      })
      if (slice.activeConnection) visited.push(slice.activeConnection)
    }

    const routeStarted = performance.now()
    const planResult = await postJson({ phase: 'route', query })
    const routeMs = Math.round(performance.now() - routeStarted)
    if (!alive()) return

    if (!planResult?.tool) {
      setState((prev) => ({
        ...IDLE_STATE,
        ghostEdges,
        query,
        shockKey: prev.shockKey + 1,
        error: planResult?.error || 'Intent routing failed. Check GROQ_API_KEY in .env and restart the dev server.',
        trace: [
          {
            id: `route-${routeStarted}`,
            time: new Date().toLocaleTimeString('en-GB'),
            event: 'ROUTING_FAILED',
            latency: routeMs,
            failed: true,
            detail: { step: 'route', phase: 'Classifying intent...', note: planResult?.error || 'Routing request failed.' },
          },
        ],
      }))
      return
    }

    let plan = planResult
    let steps = buildSteps(plan)
    let live = null
    let lastTraceTime = performance.now()
    setState((prev) => ({
      ...prev,
      confidence: { intent: plan.routedBy === 'keywords' ? 62 : 88, tool: null, answer: null, verifier: null },
    }))

    for (let index = 0; index < steps.length; index += 1) {
      if (!alive()) return
      const step = steps[index]

      if (step.id === 'toolhub') {
        const visual = {
          activeNodeId: 'toolhub',
          activeConnection: null,
          activeTool: null,
          label: 'Choose a tool, or wait to continue',
        }
        record(visual)
        setState((prev) => ({
          ...prev,
          ...visual,
          awaitingSteer: true,
          trace: [
            ...prev.trace,
            {
              id: `toolhub-${performance.now()}`,
              time: new Date().toLocaleTimeString('en-GB'),
              event: step.trace,
              latency: Math.max(0, Math.round(performance.now() - lastTraceTime)),
              detail: { step: 'toolhub', phase: visual.label, activeNode: 'toolhub', note: 'Steering window open' },
            },
          ],
        }))
        lastTraceTime = performance.now()
        const choice = await new Promise((resolve) => {
          const timer = setTimeout(() => resolve(null), 1800)
          steerWait.current = (tool) => {
            clearTimeout(timer)
            resolve(tool)
          }
        })
        steerWait.current = null
        if (!alive()) return
        if (choice && choice !== plan.tool) {
          plan = { ...plan, tool: choice, memoryCluster: TOOL_CLUSTER[choice] || plan.memoryCluster, steered: true }
          const rebuilt = buildSteps(plan)
          const hubAt = rebuilt.findIndex((item) => item.id === 'toolhub')
          steps = steps.slice(0, index + 1).concat(rebuilt.slice(hubAt + 1))
        }
        setState((prev) => ({ ...prev, awaitingSteer: false, label: `Routing to ${String(plan.tool).replaceAll('_', ' ')}` }))
        await delay(350)
        continue
      }

      if (step.id === 'to-tool') {
        const started = performance.now()
        const visual = {
          activeNodeId: step.activeNode,
          activeConnection: step.connection,
          activeTool: step.activeTool,
          label: step.label,
        }
        record(visual)
        setState((prev) => ({
          ...prev,
          ...visual,
          packetTrigger: {
            key: `${step.id}-${plan.tool}`,
            connection: step.connection,
            count: step.packetCount ?? 1,
            duration: step.duration,
          },
          trace: [
            ...prev.trace,
            {
              id: `${step.id}-${started}`,
              time: new Date().toLocaleTimeString('en-GB'),
              event: step.trace,
              latency: Math.max(0, Math.round(started - lastTraceTime)),
              detail: {
                step: step.id,
                phase: step.label,
                activeTool: step.activeTool,
                connection: step.connection,
                note: 'Tool call started',
              },
            },
          ],
        }))
        lastTraceTime = started
        live = await streamExecute(query, plan, (event) => {
          if (!alive()) return
          if (event.type === 'token') {
            setState((prev) => ({ ...prev, streamText: `${prev.streamText}${event.text}` }))
          } else if (event.type === 'sources') {
            setState((prev) => ({ ...prev, sources: event.sources || [] }))
          } else if (event.type === 'status') {
            setState((prev) => ({ ...prev, label: event.label || prev.label }))
          } else if (event.type === 'reset') {
            setState((prev) => ({ ...prev, streamText: '' }))
          } else if (event.type === 'replan') {
            // A real verify -> replan feedback, emitted by the server the moment it happens.
            setState((prev) => ({
              ...prev,
              feedbackCount: prev.feedbackCount + 1,
              replans: [...prev.replans, event],
              activeNodeId: 'planner',
              activeConnection: ['verifier', 'planner'],
              activeTool: null,
              label: `Replanning (attempt ${event.attempt}): ${event.reason}`,
              packetTrigger: { key: `replan-${event.attempt}-${performance.now()}`, connection: ['verifier', 'planner'], count: 3, duration: 900 },
              trace: [
                ...prev.trace,
                {
                  id: `replan-${event.attempt}-${performance.now()}`,
                  time: new Date().toLocaleTimeString('en-GB'),
                  event: `REPLAN_TRIGGERED (attempt ${event.attempt})`,
                  latency: 0,
                  failed: true,
                  detail: {
                    step: 'replan',
                    phase: 'Verifier fed a failure back to the Planner',
                    connection: ['verifier', 'planner'],
                    note: `Why: ${event.reason}. New search: "${event.revisedQuery}". Retries left: ${event.retriesLeft}.`,
                  },
                },
              ],
            }))
          }
        }, options.inject ? { inject: options.inject } : {})
        if (!alive()) return
        if (live?.confidence) {
          setState((prev) => ({ ...prev, confidence: live.confidence, sources: live.sources || prev.sources, runTrace: live.trace || null }))
        }
        await delay(280)
        continue
      }

      const measured = latencyFor(step, live, routeMs, lastTraceTime)
      if (step.trace) lastTraceTime = performance.now()
      const failed = Boolean(step.final && live?.error && !live?.response)
      const visual = {
        activeNodeId: step.activeNode,
        activeConnection: step.connection,
        activeTool: step.activeTool,
        label: step.id === 'verifier' && live?.verdicts?.length ? `Verifier checked ${live.verdicts.length} claims` : step.label,
      }
      record(visual)

      setState((prev) => {
        const trace = step.trace
          ? [
              ...prev.trace,
              {
                id: `${step.id}-${lastTraceTime}`,
                time: new Date().toLocaleTimeString('en-GB'),
                event: step.trace,
                latency: measured.latency,
                failed: failed || Boolean(step.trace === 'TOOL_RESPONSE_RECEIVED' && live?.error && !live?.sources?.length),
                detail: {
                  step: step.id,
                  phase: visual.label,
                  activeNode: step.activeNode,
                  activeTool: step.activeTool,
                  connection: step.connection,
                  note: measured.note,
                },
              },
            ]
          : prev.trace

        let plannerTrigger = prev.plannerTrigger
        if (step.planner) plannerTrigger = { key: step.id, tasks: step.planner.tasks, duration: step.duration }

        let memoryTrigger = prev.memoryTrigger
        let memoryStats = prev.memoryStats
        let memoryLitIds = prev.memoryLitIds
        if (step.memory) {
          const items = live?.retrieved ?? []
          memoryLitIds = items.map((item) => item.id)
          memoryTrigger = { key: step.id, clusterId: step.memory.clusterId, duration: step.duration }
          memoryStats = {
            clusterLabel: CLUSTER_LABELS[step.memory.clusterId] ?? step.memory.clusterId,
            retrieved: items.length,
            latencyMs: live?.timings?.memoryMs ?? measured.latency,
            items,
          }
        }

        return {
          ...prev,
          ...visual,
          packetTrigger: step.connection
            ? { key: step.id, connection: step.connection, count: step.packetCount ?? 1, duration: step.duration }
            : null,
          plannerTrigger,
          memoryTrigger,
          memoryStats,
          memoryLitIds,
          response: step.final ? live?.response || prev.streamText || null : prev.response,
          error: step.final ? live?.error || null : prev.error,
          sources: live?.sources || prev.sources,
          asOf: step.final ? live?.asOf || null : prev.asOf,
          memorySnapshot: step.final ? live?.memories || null : prev.memorySnapshot,
          verdicts: live?.verdicts || prev.verdicts,
          confidence: live?.confidence || prev.confidence,
          trace,
        }
      })

      await delay(step.duration)
    }

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
      runTrace: live?.trace || prev.runTrace,
      shockKey: (prev.error && !prev.response) || (live?.error && !live?.response) ? prev.shockKey + 1 : prev.shockKey,
      query,
    }))
  }, [])

  return { ...state, run, steer, recall }
}
