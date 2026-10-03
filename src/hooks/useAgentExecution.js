import { useCallback, useRef, useState } from 'react'
import { buildSteps } from '../data/scenarios.js'
import { MEMORY_CLUSTERS } from '../data/memoryClusters.js'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const CLUSTER_LABELS = Object.fromEntries(MEMORY_CLUSTERS.map((c) => [c.id, c.label]))

// Calls the real backend (Grok reasoning + Tavily web search for the
// WEB_SEARCH tool). Never throws — callers fall back to the scripted
// response on failure.
async function fetchAgentResponse(query) {
  try {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.response ? data : null
  } catch {
    return null
  }
}

const IDLE_STATE = {
  running: false,
  activeNodeId: null,
  activeConnection: null,
  activeTool: null,
  packetTrigger: null,
  plannerTrigger: null,
  memoryTrigger: null,
  memoryStats: null,
  label: '',
  response: null,
  trace: [],
}

// Step-based state machine driving the 3D execution. Re-entrant: calling
// run() while a previous run is mid-flight cancels it cleanly via runId.
// Trace entries record the real elapsed time since the previous trace
// event, so the latency shown is the actual time the simulator spent in
// the phase that just completed.
export function useAgentExecution() {
  const [state, setState] = useState(IDLE_STATE)
  const runId = useRef(0)

  const run = useCallback(async (query) => {
    const id = ++runId.current
    const steps = buildSteps(query)
    let lastTraceTime = performance.now()
    let liveResult = null

    setState({ ...IDLE_STATE, running: true, label: 'Starting...' })

    const apiPromise = fetchAgentResponse(query)

    for (const step of steps) {
      if (runId.current !== id) return

      setState((prev) => {
        let trace = prev.trace
        if (step.trace) {
          const now = performance.now()
          const latency = Math.max(0, Math.round(now - lastTraceTime))
          lastTraceTime = now
          trace = [
            ...prev.trace,
            {
              id: `${step.id}-${now}`,
              time: new Date().toLocaleTimeString('en-GB'),
              event: step.trace,
              latency,
              detail: {
                step: step.id,
                phase: step.label,
                activeNode: step.activeNode,
                activeTool: step.activeTool,
                connection: step.connection,
              },
            },
          ]
        }

        let plannerTrigger = prev.plannerTrigger
        if (step.planner) {
          plannerTrigger = { key: step.id, tasks: step.planner.tasks, duration: step.duration }
        }

        let memoryTrigger = prev.memoryTrigger
        let memoryStats = prev.memoryStats
        if (step.memory) {
          const latencyMs = Math.round(90 + Math.random() * 90)
          memoryTrigger = {
            key: step.id,
            clusterId: step.memory.clusterId,
            topK: step.memory.topK,
            duration: step.duration,
          }
          memoryStats = {
            clusterLabel: CLUSTER_LABELS[step.memory.clusterId] ?? step.memory.clusterId,
            topK: step.memory.topK,
            threshold: step.memory.threshold,
            retrieved: step.memory.topK,
            latencyMs,
          }
        }

        return {
          ...prev,
          activeNodeId: step.activeNode,
          activeConnection: step.connection,
          activeTool: step.activeTool,
          packetTrigger: step.connection
            ? { key: step.id, connection: step.connection, count: step.packetCount ?? 1, duration: step.duration }
            : null,
          plannerTrigger,
          memoryTrigger,
          memoryStats,
          label: step.label,
          response: step.final ? (liveResult?.response ?? step.response) : prev.response,
          trace,
        }
      })

      if (step.id === 'llm') {
        const [result] = await Promise.all([apiPromise, delay(step.duration)])
        liveResult = result
      } else {
        await delay(step.duration)
      }
    }

    if (runId.current === id) {
      setState((prev) => ({
        ...IDLE_STATE,
        response: prev.response,
        trace: prev.trace,
        memoryStats: prev.memoryStats,
      }))
    }
  }, [])

  return { ...state, run }
}
