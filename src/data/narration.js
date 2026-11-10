// Plain-English narration for the live run, derived only from the step
// events /api/agent streams (see stepEvent there). Nothing here is guessed.

const TOOL_ACTION = {
  web_search: 'Searching the web…',
  database: 'Looking up the customer database…',
  calculator: 'Working out the numbers…',
  external_api: 'Reading the text you provided…',
}

const TOOL_NAME = {
  web_search: 'Web search',
  database: 'Customer database',
  calculator: 'Calculator',
  external_api: 'Text analysis',
}

export const toolPlainName = (tool) => TOOL_NAME[tool] || tool

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// What the scene should show when a server step starts.
export function stepStart(event) {
  const { name, attempt } = event
  if (name === 'memory_retrieval') {
    return { node: 'memory', connection: ['planner', 'memory'], text: 'Checking memory for similar past questions…' }
  }
  if (name.startsWith('tool:')) {
    const tool = name.slice(5)
    return {
      node: null,
      tool,
      connection: ['toolhub', tool],
      lead: attempt === 1 ? ['memory', 'toolhub'] : null,
      text: attempt > 1 && tool === 'web_search' ? 'Searching again with a better query…' : TOOL_ACTION[tool] || 'Running the tool…',
    }
  }
  if (name === 'reasoning') {
    return { node: 'llm', connection: ['toolhub', 'llm'], text: attempt > 1 ? 'Rewriting the answer from the new sources…' : 'Writing the answer…' }
  }
  if (name === 'verification') {
    return { node: 'verifier', connection: ['llm', 'verifier'], text: 'Fact-checking each claim against the sources…' }
  }
  if (name === 'replan') {
    return { node: 'planner', connection: ['verifier', 'planner'], text: 'Check failed, planning a retry…', retry: true }
  }
  return null
}

// How a finished server step should be reported: status is ok, warn or failed.
export function stepEnd(event) {
  const { name, status, error, summary = {} } = event
  const s = summary || {}
  if (status === 'error') {
    if (name === 'reasoning') return { status: 'failed', text: 'The language model was unavailable, so a summary of the sources is shown instead.' }
    if (name.startsWith('tool:')) return { status: 'failed', text: `The ${toolPlainName(name.slice(5)).toLowerCase()} failed: ${error || 'unknown error'}` }
    return { status: 'failed', text: error || 'This step failed.' }
  }
  if (name === 'memory_retrieval') {
    return { status: 'ok', text: s.hits ? `Found ${plural(s.hits, 'related past answer')}.` : 'Nothing similar in memory yet.' }
  }
  if (name.startsWith('tool:')) {
    const tool = name.slice(5)
    if (tool === 'web_search') {
      if (!s.sourceCount) return { status: 'warn', text: 'The search came back empty.' }
      if (s.relevance != null && s.relevance < 0.2) return { status: 'warn', text: `Found ${plural(s.sourceCount, 'page')}, but they are off-topic.` }
      return { status: 'ok', text: `Found ${plural(s.sourceCount, 'source')}.` }
    }
    if (tool === 'database') return { status: s.rows ? 'ok' : 'warn', text: s.rows ? `Found ${plural(s.rows, 'matching customer')}.` : 'No matching customer found.' }
    if (tool === 'calculator') return { status: 'ok', text: 'Calculated from the numbers you typed.' }
    return { status: 'ok', text: 'Text read.' }
  }
  if (name === 'reasoning') return { status: 'ok', text: 'Answer written.' }
  if (name === 'verification') {
    const claims = s.claims ?? 0
    if (!claims) return { status: 'ok', text: 'No separate claims to check.' }
    const supported = s.supported ?? 0
    return {
      status: supported === claims ? 'ok' : 'warn',
      text: `${supported} of ${plural(claims, 'claim')} backed by the sources.`,
    }
  }
  if (name === 'replan') return { status: 'ok', text: 'Retry planned.' }
  return { status: 'ok', text: 'Done.' }
}

// End-of-run summary built from the stored trace in the done payload.
// checks: the fact-check result of every attempt, in order. The server keeps the
// best-scoring attempt, which is not always the last one.
export function runSummary(live, ms, checks = []) {
  const status = live?.trace?.status || (live?.response ? 'ok' : 'failed')
  const verdicts = live?.verdicts || []
  const supported = verdicts.filter((item) => item.supported).length
  const retries = live?.replans?.length || 0
  const sources = live?.sources?.length || 0
  const lines = []
  if (verdicts.length) lines.push(`${supported} of ${plural(verdicts.length, 'claim')} backed by the sources`)
  if (sources) lines.push(`${plural(sources, 'source')} used`)
  const allBacked = verdicts.length > 0 && supported === verdicts.length
  if (retries) lines.push(status === 'ok' && allBacked ? `Recovered after ${plural(retries, 'retry')}` : `${plural(retries, 'retry')} attempted`)
  const last = checks[checks.length - 1]
  if (retries && last && verdicts.length && (last.claims !== verdicts.length || last.supported !== supported)) {
    lines.push('Kept an earlier answer because it scored better on the fact-check')
  }
  if (ms) lines.push(`Took ${(ms / 1000).toFixed(1)}s`)
  const flagged = status === 'ok' && verdicts.length > 0 && !allBacked
  const title = status === 'ok' ? (flagged ? 'Answered, some claims not backed' : 'Answered') : status === 'degraded' ? 'Answered with a fallback' : 'Could not answer'
  return { status: flagged ? 'degraded' : status, title, lines, error: live?.error || null }
}
