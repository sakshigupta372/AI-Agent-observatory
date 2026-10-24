// Latency and claim-verification benchmark for the existing agent.
//
//   pnpm dev                                   (in another terminal)
//   node --env-file=.env scripts/runBenchmark.js
//   node --env-file=.env scripts/runBenchmark.js --only curr --pause 3000
//   node --env-file=.env scripts/runBenchmark.js --base https://ai-agent-observatory.onrender.com
//
// Flags: --base URL, --queries FILE, --only <id|category substring>, --pause ms
// between queries (default 2000), --timeout ms per query (default 120000),
// --warmup n (default 1, excluded from results), --remember (let runs write to
// the memory table; off by default so results do not depend on query order),
// --out DIR.
//
// It calls POST /api/agent exactly like the browser: a route request, then an
// execute request whose SSE stream is read to the `done` event. Stage durations
// come from the server's own spans (performance.now around each operation);
// client-side numbers are wall-clock times measured here with performance.now.
// Nothing is estimated: a value the server did not report is written as null.
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const flag = (name, fallback = null) => {
  const at = args.indexOf(`--${name}`)
  if (at < 0) return fallback
  const next = args[at + 1]
  return next && !next.startsWith('--') ? next : true
}

const BASE = String(flag('base', 'http://localhost:4331')).replace(/\/$/, '')
const QUERY_FILE = String(flag('queries', 'benchmarks/queries.json'))
const ONLY = flag('only')
const PAUSE_MS = Number(flag('pause', 2000))
const TIMEOUT_MS = Number(flag('timeout', 120000))
const WARMUP = Number(flag('warmup', 1))
const REMEMBER = flag('remember') === true
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const OUT = String(flag('out', path.join('benchmarks', 'results', stamp)))

const CONFIG = { verify: true, replan: true, maxRetries: 1, remember: REMEMBER }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const round = (value, digits = 1) => (value == null || Number.isNaN(value) ? null : Number(value.toFixed(digits)))

function parseServerTiming(header, name) {
  if (!header) return null
  for (const part of header.split(',')) {
    const [metric, ...params] = part.trim().split(';')
    if (metric !== name) continue
    const dur = params.find((p) => p.trim().startsWith('dur='))
    return dur ? Number(dur.trim().slice(4)) : null
  }
  return null
}

async function readSse(res, origin, onEvent) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      const line = part.split('\n').find((item) => item.startsWith('data:'))
      if (!line) continue
      let event
      try {
        event = JSON.parse(line.slice(5).trim())
      } catch {
        continue
      }
      onEvent(event, performance.now() - origin)
    }
  }
}

function sumSpans(spans, test) {
  const matched = spans.filter(test)
  if (!matched.length) return null
  return matched.reduce((total, span) => total + span.durationMs, 0)
}

function sumField(spans, test, field) {
  const values = spans.filter(test).map((span) => span.output?.[field]).filter((v) => typeof v === 'number')
  return values.length ? values.reduce((a, b) => a + b, 0) : null
}

// Spans are awaited one after another in the execute handler, so they should
// not overlap. This checks that instead of assuming it (1 ms rounding slack).
function findOverlaps(spans) {
  const sorted = [...spans].sort((a, b) => a.startedMs - b.startedMs)
  const overlaps = []
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]
    const end = prev.startedMs + prev.durationMs
    if (sorted[i].startedMs < end - 1) {
      overlaps.push(`${prev.name}#${prev.attempt} overlaps ${sorted[i].name}#${sorted[i].attempt} by ${end - sorted[i].startedMs}ms`)
    }
  }
  return overlaps
}

async function runOne(item) {
  const record = {
    id: item.id,
    category: item.category,
    query: item.query,
    status: null,
    error: null,
    failedStage: null,
    routedBy: null,
    intentLabel: null,
    tool: null,
    timings: {
      clientTotalMs: null,
      routeClientMs: null,
      routeServerMs: null,
      executeClientMs: null,
      executeFirstEventMs: null,
      executeFirstTokenMs: null,
      routeOverheadMs: null,
      executeOutsideTracerMs: null,
      postSpanServerMs: null,
      serverExecuteMs: null,
      stages: {
        plan_bookkeeping: null,
        memory_retrieval: null,
        tool_execution: null,
        reasoning: null,
        reasoning_time_to_first_content: null,
        reasoning_content_stream: null,
        verification: null,
        replan: null,
      },
      spanSumMs: null,
      unattributedServerMs: null,
      overlaps: [],
    },
    attempts: null,
    replans: null,
    reasoningUsedModel: null,
    spanErrors: [],
    verification: null,
    traceId: null,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const origin = performance.now()
  let stage = 'route'
  try {
    const routeStarted = performance.now()
    const routeRes = await fetch(`${BASE}/api/agent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phase: 'route', query: item.query }),
      signal: controller.signal,
    })
    const plan = await routeRes.json().catch(() => null)
    record.timings.routeClientMs = round(performance.now() - routeStarted)
    record.timings.routeServerMs = parseServerTiming(routeRes.headers.get('server-timing'), 'route')
    if (!routeRes.ok || !plan?.tool) {
      record.status = 'http_error'
      record.failedStage = 'route'
      record.error = plan?.error || `route request returned ${routeRes.status}`
      return record
    }
    record.routedBy = plan.routedBy
    record.intentLabel = plan.intentLabel
    record.tool = plan.tool

    stage = 'execute'
    const execStarted = performance.now()
    const execRes = await fetch(`${BASE}/api/agent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phase: 'execute', query: item.query, plan, config: CONFIG }),
      signal: controller.signal,
    })
    if (!execRes.ok || !execRes.body) {
      const data = await execRes.json().catch(() => null)
      record.status = 'http_error'
      record.failedStage = 'execute'
      record.error = data?.error || `execute request returned ${execRes.status}`
      return record
    }

    let done = null
    let doneAt = null
    await readSse(execRes, execStarted, (event, at) => {
      if (record.timings.executeFirstEventMs == null) record.timings.executeFirstEventMs = round(at)
      if (event.type === 'token' && record.timings.executeFirstTokenMs == null) record.timings.executeFirstTokenMs = round(at)
      if (event.type === 'done') {
        done = event
        doneAt = at
      }
    })
    const ended = performance.now()
    record.timings.executeClientMs = round((doneAt ?? ended - execStarted))
    record.timings.clientTotalMs = round(execStarted - origin + (doneAt ?? ended - execStarted))

    if (!done) {
      record.status = 'incomplete'
      record.failedStage = 'execute'
      record.error = 'The stream closed without a done event'
      return record
    }

    const trace = done.trace
    const spans = trace?.spans || []
    record.traceId = done.traceId || null
    record.attempts = done.attempts ?? null
    record.replans = Array.isArray(done.replans) ? done.replans.length : null
    record.timings.serverExecuteMs = trace?.totalMs ?? null
    if (record.timings.routeServerMs != null) record.timings.routeOverheadMs = round(record.timings.routeClientMs - record.timings.routeServerMs)
    if (record.timings.serverExecuteMs != null) record.timings.executeOutsideTracerMs = round(record.timings.executeClientMs - record.timings.serverExecuteMs)
    if (spans.length && record.timings.serverExecuteMs != null) {
      record.timings.postSpanServerMs = record.timings.serverExecuteMs - Math.max(...spans.map((x) => x.startedMs + x.durationMs))
    }

    const s = record.timings.stages
    s.plan_bookkeeping = sumSpans(spans, (x) => x.name === 'plan')
    s.memory_retrieval = sumSpans(spans, (x) => x.name === 'memory_retrieval')
    s.tool_execution = sumSpans(spans, (x) => x.name.startsWith('tool:'))
    s.reasoning = sumSpans(spans, (x) => x.name === 'reasoning')
    s.reasoning_time_to_first_content = sumField(spans, (x) => x.name === 'reasoning', 'timeToFirstContentMs')
    s.reasoning_content_stream = sumField(spans, (x) => x.name === 'reasoning', 'contentStreamMs')
    s.verification = sumSpans(spans, (x) => x.name === 'verification')
    s.replan = sumSpans(spans, (x) => x.name === 'replan')
    record.timings.overlaps = findOverlaps(spans)
    record.timings.spanSumMs = spans.reduce((total, span) => total + span.durationMs, 0)
    if (record.timings.serverExecuteMs != null && !record.timings.overlaps.length) {
      record.timings.unattributedServerMs = record.timings.serverExecuteMs - record.timings.spanSumMs
    }
    const reasoningSpans = spans.filter((x) => x.name === 'reasoning')
    record.model = reasoningSpans.find((x) => x.input?.model)?.input?.model || null
    record.reasoningUsedModel = reasoningSpans.length ? reasoningSpans.some((x) => x.output?.usedModel === true) : null
    record.spanErrors = spans.filter((x) => x.status === 'error').map((x) => `${x.name}#${x.attempt}: ${x.error}`)

    // Final verdicts belong to the attempt the agent kept; find that attempt's
    // verification span to learn which verifier produced them.
    const verdicts = Array.isArray(done.verdicts) ? done.verdicts : []
    const verifySpans = spans.filter((x) => x.name === 'verification')
    const key = verdicts.map((v) => v.text).join('\n')
    const keptSpan = verifySpans.find((x) => (x.output?.verdicts || []).map((v) => v.text).join('\n') === key) || verifySpans[verifySpans.length - 1] || null
    const sources = Array.isArray(done.sources) ? done.sources : []
    record.verification = {
      ran: verifySpans.length > 0,
      verifier: keptSpan?.output?.via ?? null,
      fallbackNote: keptSpan?.output?.fallbackNote ?? null,
      claimsChecked: verdicts.length,
      supported: verdicts.filter((v) => v.supported === true).length,
      unsupported: verdicts.filter((v) => v.supported === false).length,
      uncertain: null,
      perClaimConfidence: null,
      checkedAgainstSources: sources.length > 0,
      sourceCount: sources.length,
      sources: sources.map((src) => ({ title: src.title, url: src.url, publishedDate: src.publishedDate || null })),
      verdicts: verdicts.map((v) => ({ text: v.text, supported: v.supported, note: v.note })),
      heuristicConfidence: done.confidence ?? null,
    }

    const hasResponse = typeof done.response === 'string' && done.response.trim().length > 0
    if (!hasResponse) {
      record.status = 'failed'
      record.error = done.error || 'No response was produced'
    } else if (done.error) {
      record.status = 'degraded'
      record.error = done.error
    } else {
      record.status = 'ok'
    }
    record.responseChars = hasResponse ? done.response.length : 0
    record.response = hasResponse ? done.response : null
    return record
  } catch (err) {
    const elapsed = performance.now() - origin
    record.timings.clientTotalMs = round(elapsed)
    record.failedStage = stage
    if (err.name === 'AbortError') {
      record.status = 'timeout'
      record.error = `No result within ${TIMEOUT_MS} ms`
    } else {
      record.status = 'network_error'
      record.error = err.message
    }
    return record
  } finally {
    clearTimeout(timer)
  }
}

// Nearest-rank percentile: the smallest value with at least p% of samples at or below it.
function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]
}

function describe(values) {
  const v = values.filter((x) => typeof x === 'number')
  if (!v.length) return { n: 0, total: null, mean: null, median: null, p95: null, min: null, max: null }
  const total = v.reduce((a, b) => a + b, 0)
  return {
    n: v.length,
    total: round(total),
    mean: round(total / v.length),
    median: round(percentile(v, 50)),
    p95: round(percentile(v, 95)),
    min: round(Math.min(...v)),
    max: round(Math.max(...v)),
  }
}

// Operation stages that never overlap each other: the route call, then each
// execute span family. Overheads (network, persistence, gaps between spans)
// are reported separately and not ranked. The reasoning sub-splits are parts of
// `reasoning` and are not ranked either, so nothing is counted twice.
const RANKED_STAGES = [
  ['route_intent_planning_tool_selection', (r) => r.timings.routeServerMs ?? null],
  ['memory_retrieval', (r) => r.timings.stages.memory_retrieval],
  ['tool_execution', (r) => r.timings.stages.tool_execution],
  ['reasoning', (r) => r.timings.stages.reasoning],
  ['verification', (r) => r.timings.stages.verification],
  ['replan', (r) => r.timings.stages.replan],
]

function summarize(runs, meta) {
  const statusCounts = {}
  for (const run of runs) statusCounts[run.status] = (statusCounts[run.status] || 0) + 1
  const completed = runs.filter((r) => r.status === 'ok' || r.status === 'degraded')

  const stageStats = {}
  for (const [name, get] of RANKED_STAGES) stageStats[name] = describe(completed.map(get))
  stageStats.reasoning_time_to_first_content = describe(completed.map((r) => r.timings.stages.reasoning_time_to_first_content))
  stageStats.reasoning_content_stream = describe(completed.map((r) => r.timings.stages.reasoning_content_stream))
  stageStats.plan_bookkeeping = describe(completed.map((r) => r.timings.stages.plan_bookkeeping))
  stageStats.unattributed_server = describe(completed.map((r) => r.timings.unattributedServerMs))
  stageStats.route_client_roundtrip = describe(completed.map((r) => r.timings.routeClientMs))
  stageStats.overhead_route_outside_server = describe(completed.map((r) => r.timings.routeOverheadMs))
  stageStats.overhead_execute_outside_tracer = describe(completed.map((r) => r.timings.executeOutsideTracerMs))
  stageStats.overhead_post_span_server = describe(completed.map((r) => r.timings.postSpanServerMs))

  const ranked = RANKED_STAGES.map(([name]) => ({ name, ...stageStats[name] })).filter((s) => s.n > 0)
  const byTotal = [...ranked].sort((a, b) => b.total - a.total)[0] || null
  const byMean = [...ranked].sort((a, b) => b.mean - a.mean)[0] || null

  const verified = completed.filter((r) => r.verification)
  const claimTotals = (list) => {
    const checked = list.reduce((a, r) => a + r.verification.claimsChecked, 0)
    const unsupported = list.reduce((a, r) => a + r.verification.unsupported, 0)
    return {
      runs: list.length,
      claimsChecked: checked,
      supported: list.reduce((a, r) => a + r.verification.supported, 0),
      unsupported,
      unsupportedRate: checked ? round(unsupported / checked, 4) : null,
    }
  }

  return {
    meta,
    sampleCount: runs.length,
    statusCounts,
    completedCount: completed.length,
    errorCount: runs.length - completed.length,
    degradedCount: statusCounts.degraded || 0,
    endToEndLatencyMs: describe(completed.map((r) => r.timings.clientTotalMs)),
    endToEndLatencyAllRunsMs: describe(runs.map((r) => r.timings.clientTotalMs)),
    stageLatencyMs: stageStats,
    slowestStage: {
      byTotalAccumulated: byTotal && { name: byTotal.name, totalMs: byTotal.total, runs: byTotal.n },
      byAverage: byMean && { name: byMean.name, meanMs: byMean.mean, runs: byMean.n },
    },
    spanErrorsByStage: runs.reduce((acc, r) => {
      for (const entry of r.spanErrors) {
        const name = entry.split('#')[0]
        acc[name] = (acc[name] || 0) + 1
      }
      return acc
    }, {}),
    verifierFallbackRuns: completed.filter((r) => r.verification?.verifier === 'local' && r.verification.checkedAgainstSources).map((r) => r.id),
    runsWithOverlappingSpans: runs.filter((r) => r.timings.overlaps.length).map((r) => r.id),
    claims: {
      all: claimTotals(verified),
      checkedAgainstRetrievedSources: claimTotals(verified.filter((r) => r.verification.checkedAgainstSources)),
      withoutRetrievedSources: claimTotals(verified.filter((r) => !r.verification.checkedAgainstSources)),
      byVerifier: {
        model: claimTotals(verified.filter((r) => r.verification.verifier === 'model')),
        local_word_overlap: claimTotals(verified.filter((r) => r.verification.verifier === 'local')),
      },
      runsWithZeroClaims: verified.filter((r) => r.verification.claimsChecked === 0).map((r) => r.id),
    },
    byCategory: Object.fromEntries(
      [...new Set(runs.map((r) => r.category))].map((cat) => {
        const list = runs.filter((r) => r.category === cat)
        const done = list.filter((r) => r.status === 'ok' || r.status === 'degraded')
        return [cat, { runs: list.length, completed: done.length, latencyMs: describe(done.map((r) => r.timings.clientTotalMs)), claims: claimTotals(done.filter((r) => r.verification)) }]
      })
    ),
  }
}

const CSV_COLUMNS = [
  ['id', (r) => r.id],
  ['category', (r) => r.category],
  ['query', (r) => r.query],
  ['status', (r) => r.status],
  ['failed_stage', (r) => r.failedStage],
  ['error', (r) => r.error],
  ['routed_by', (r) => r.routedBy],
  ['tool', (r) => r.tool],
  ['client_total_ms', (r) => r.timings.clientTotalMs],
  ['route_client_ms', (r) => r.timings.routeClientMs],
  ['route_server_ms', (r) => r.timings.routeServerMs],
  ['execute_client_ms', (r) => r.timings.executeClientMs],
  ['execute_first_token_ms', (r) => r.timings.executeFirstTokenMs],
  ['server_execute_ms', (r) => r.timings.serverExecuteMs],
  ['memory_retrieval_ms', (r) => r.timings.stages.memory_retrieval],
  ['tool_execution_ms', (r) => r.timings.stages.tool_execution],
  ['reasoning_ms', (r) => r.timings.stages.reasoning],
  ['reasoning_time_to_first_content_ms', (r) => r.timings.stages.reasoning_time_to_first_content],
  ['reasoning_content_stream_ms', (r) => r.timings.stages.reasoning_content_stream],
  ['reasoning_used_model', (r) => r.reasoningUsedModel],
  ['verification_ms', (r) => r.timings.stages.verification],
  ['replan_ms', (r) => r.timings.stages.replan],
  ['route_overhead_ms', (r) => r.timings.routeOverheadMs],
  ['execute_outside_tracer_ms', (r) => r.timings.executeOutsideTracerMs],
  ['post_span_server_ms', (r) => r.timings.postSpanServerMs],
  ['unattributed_server_ms', (r) => r.timings.unattributedServerMs],
  ['span_overlaps', (r) => r.timings.overlaps.join(' | ')],
  ['attempts', (r) => r.attempts],
  ['replans', (r) => r.replans],
  ['verifier', (r) => r.verification?.verifier],
  ['claims_checked', (r) => r.verification?.claimsChecked],
  ['claims_supported', (r) => r.verification?.supported],
  ['claims_unsupported', (r) => r.verification?.unsupported],
  ['checked_against_sources', (r) => r.verification?.checkedAgainstSources],
  ['source_count', (r) => r.verification?.sourceCount],
  ['source_urls', (r) => r.verification?.sources.map((s) => s.url).join(' ')],
  ['span_errors', (r) => r.spanErrors.join(' | ')],
  ['trace_id', (r) => r.traceId],
]

function toCsv(runs) {
  const cell = (value) => {
    if (value == null) return ''
    const text = String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [CSV_COLUMNS.map(([name]) => name).join(','), ...runs.map((r) => CSV_COLUMNS.map(([, get]) => cell(get(r))).join(','))].join('\n')
}

const ms = (v) => (v == null ? '–' : `${Math.round(v).toLocaleString('en-US')} ms`)

function toMarkdown(summary, runs) {
  const s = summary
  const e = s.endToEndLatencyMs
  const lines = []
  lines.push('# Agent benchmark summary', '')
  lines.push(`Run ${s.meta.startedAt} against \`${s.meta.baseUrl}\` · commit \`${s.meta.gitCommit}\` · model \`${s.meta.model || 'unknown'}\``)
  lines.push(`Config: \`${JSON.stringify(s.meta.config)}\` · ${s.meta.warmupRuns} warm-up run(s) excluded · pause ${s.meta.pauseMs} ms · timeout ${s.meta.timeoutMs} ms`, '')
  lines.push('## Outcomes', '')
  lines.push(`- Samples: **${s.sampleCount}**`)
  lines.push(`- Completed: **${s.completedCount}** (of which degraded: ${s.degradedCount})`)
  lines.push(`- Errors / timeouts / incomplete: **${s.errorCount}**`)
  lines.push(`- Status counts: ${Object.entries(s.statusCounts).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  const spanErrors = Object.entries(s.spanErrorsByStage)
  lines.push(`- Failed spans by stage (an answer can still be produced after a failed span): ${spanErrors.length ? spanErrors.map(([k, v]) => `${k} ${v}`).join(', ') : 'none'}`)
  lines.push(`- Runs with sources where the verifier fell back to word overlap: ${s.verifierFallbackRuns.length} of ${s.claims.checkedAgainstRetrievedSources.runs}`, '')
  lines.push('## End-to-end latency (completed runs, client wall clock)', '')
  lines.push('| n | mean | median | p95 | min | max |', '|---|---|---|---|---|---|')
  lines.push(`| ${e.n} | ${ms(e.mean)} | ${ms(e.median)} | ${ms(e.p95)} | ${ms(e.min)} | ${ms(e.max)} |`, '')
  lines.push('p95 uses the nearest-rank method; with about 30 samples it is the second-largest value, so treat it as indicative.', '')
  lines.push('## Latency per stage (completed runs)', '')
  lines.push('| stage | runs with stage | total | mean | median | p95 |', '|---|---|---|---|---|---|')
  const order = [
    'route_intent_planning_tool_selection',
    'memory_retrieval',
    'tool_execution',
    'reasoning',
    'reasoning_time_to_first_content',
    'reasoning_content_stream',
    'verification',
    'replan',
    'unattributed_server',
    'overhead_post_span_server',
    'overhead_execute_outside_tracer',
    'overhead_route_outside_server',
    'plan_bookkeeping',
    'route_client_roundtrip',
  ]
  for (const name of order) {
    const st = s.stageLatencyMs[name]
    lines.push(`| ${name} | ${st.n} | ${ms(st.total)} | ${ms(st.mean)} | ${ms(st.median)} | ${ms(st.p95)} |`)
  }
  lines.push('')
  lines.push(`**Slowest stage by total accumulated time:** ${s.slowestStage.byTotalAccumulated?.name ?? '–'} (${ms(s.slowestStage.byTotalAccumulated?.totalMs)} across ${s.slowestStage.byTotalAccumulated?.runs ?? 0} runs)`)
  lines.push(`**Slowest stage by average time:** ${s.slowestStage.byAverage?.name ?? '–'} (${ms(s.slowestStage.byAverage?.meanMs)} mean over ${s.slowestStage.byAverage?.runs ?? 0} runs)`, '')
  lines.push('Ranking uses only the operation stages (route, memory_retrieval, tool_execution, reasoning, verification, replan), which never overlap. The reasoning sub-rows are parts of `reasoning`, `overhead_post_span_server` is part of `unattributed_server`, and the overhead rows are not operations, so none of them is ranked and nothing is counted twice.')
  lines.push(s.runsWithOverlappingSpans.length ? `Runs with overlapping spans (excluded from the unattributed calculation): ${s.runsWithOverlappingSpans.join(', ')}` : 'No overlapping spans were found in any run, so the execute stages are strictly sequential.', '')
  lines.push('## Claim verification', '')
  lines.push('| subset | runs | claims checked | supported | unsupported | unsupported rate |', '|---|---|---|---|---|---|')
  const claimRow = (label, c) => `| ${label} | ${c.runs} | ${c.claimsChecked} | ${c.supported} | ${c.unsupported} | ${c.unsupportedRate == null ? '–' : `${(c.unsupportedRate * 100).toFixed(1)}% (${c.unsupported}/${c.claimsChecked})`} |`
  lines.push(claimRow('all completed runs', s.claims.all))
  lines.push(claimRow('checked against retrieved sources', s.claims.checkedAgainstRetrievedSources))
  lines.push(claimRow('no retrieved sources (auto-supported)', s.claims.withoutRetrievedSources))
  lines.push(claimRow('verifier = model', s.claims.byVerifier.model))
  lines.push(claimRow('verifier = word-overlap fallback', s.claims.byVerifier.local_word_overlap), '')
  lines.push(`Completed runs with zero checkable claims: ${s.claims.runsWithZeroClaims.length ? s.claims.runsWithZeroClaims.join(', ') : 'none'}`, '')
  lines.push('## By category', '')
  lines.push('| category | runs | completed | median latency | claims checked | unsupported |', '|---|---|---|---|---|---|')
  for (const [cat, c] of Object.entries(s.byCategory)) {
    lines.push(`| ${cat} | ${c.runs} | ${c.completed} | ${ms(c.latencyMs.median)} | ${c.claims.claimsChecked} | ${c.claims.unsupported} |`)
  }
  lines.push('', '## Errors and non-ok runs', '')
  const bad = runs.filter((r) => r.status !== 'ok')
  if (!bad.length) lines.push('None.')
  for (const r of bad) lines.push(`- \`${r.id}\` ${r.status}${r.failedStage ? ` at ${r.failedStage}` : ''}: ${r.error}`)
  lines.push('', '## What each number means', '')
  lines.push(...s.meta.definitions.map((d) => `- ${d}`))
  return lines.join('\n') + '\n'
}

const DEFINITIONS = [
  'End-to-end latency: client wall clock from sending the route request to receiving the `done` SSE event (performance.now in this script). Includes network to the server.',
  'route_intent_planning_tool_selection: server time of the route request (Server-Timing header). Intent detection, planning (task list) and tool selection are produced by one Groq JSON call, so they cannot be timed separately. For questions matching the "fresh" keywords, or when the model call fails, keyword rules are used instead and this is near 0 ms (see routed_by).',
  'plan_bookkeeping: the `plan` span inside execute only records the plan from the route step; it is not planning work and is not ranked.',
  'memory_retrieval: embedding the question with the local MiniLM model plus the pgvector similarity query. The store swallows database errors and falls back to a lexical file search, which this benchmark cannot distinguish.',
  'tool_execution: the tool span, summed across attempts. For web search it includes every Tavily request the tool made and the page fetches used to recover publication dates.',
  'reasoning: the answer-writing step, summed across attempts. reasoning_time_to_first_content is from starting the Groq stream request to the first answer token (includes queueing, retries and the model\'s hidden reasoning); reasoning_content_stream is from the first to the last answer token, i.e. response generation. Calculator answers and database "no match" answers are written without a model call (reasoning_used_model = false).',
  'verification: the verifier span, summed across attempts. It splits the answer into claims by taking lines that start with "- ", then asks Groq to mark each one supported or not against the retrieved sources. If Groq fails it falls back to a word-overlap check (verifier = local).',
  'Verifier labels are binary. supported = the verifier judged the claim to be present in the retrieved sources. unsupported = it was not found in those sources; this does not mean the claim is false. There is no uncertain/unverifiable label and no per-claim confidence. heuristicConfidence in the JSON is the app\'s display score, computed from routing method, source count and support rate; it is not a verifier output.',
  'Runs whose tool returns no sources (calculator, database, text analysis, empty search) are verified by the local check, which marks every claim supported without comparing it to anything. They are reported separately and should not be read as evidence of correctness.',
  'replan: the planner call that writes a new search query after a failed verification or empty search, summed across attempts.',
  'unattributed_server: server execute total (tracer start to trace summary) minus the sum of all spans. Covers work between spans, such as SSE writes, and after the last span (overhead_post_span_server: the optional memory write and listing memories). Only computed when spans do not overlap.',
  'overhead_execute_outside_tracer: client execute time minus server execute total. Covers request transit and body parsing before the tracer starts, saving the trace to Postgres, and delivering the done event. It is a difference of two durations measured by different clocks, not a separate timer.',
  'overhead_route_outside_server: route round trip minus route server time, i.e. network and request handling outside the route handler.',
  'Accounting: client total = route round trip + execute client time (plus the few microseconds between them). Route round trip = route server time + route overhead. Execute client time = server execute total + execute overhead outside the tracer.',
  'Status: ok = answer with no error; degraded = an answer was produced but the agent reported an error (for example the model was unavailable and a fallback answer was used); failed = no answer; http_error, network_error, timeout, incomplete = the request did not complete normally.',
  'Results vary between runs: the reasoning model runs at temperature 0.2 and web results change. Re-run to see the spread.',
]

function writeOutputs(dir, meta, runs) {
  const summary = summarize(runs, meta)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ meta, runs }, null, 2))
  fs.writeFileSync(path.join(dir, 'results.csv'), toCsv(runs))
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2))
  fs.writeFileSync(path.join(dir, 'summary.md'), toMarkdown(summary, runs))
  console.log(`\nWrote ${dir}/results.json, results.csv, summary.json, summary.md`)
  console.log(`Completed ${summary.completedCount}/${summary.sampleCount} · median ${summary.endToEndLatencyMs.median} ms · p95 ${summary.endToEndLatencyMs.p95} ms`)
}

async function main() {
  // --from <results.json> rebuilds the summary files from a saved run without calling the agent.
  const from = flag('from')
  if (typeof from === 'string') {
    const saved = JSON.parse(fs.readFileSync(from, 'utf8'))
    writeOutputs(path.dirname(from), { ...saved.meta, definitions: DEFINITIONS }, saved.runs)
    process.exit(0)
  }

  const file = JSON.parse(fs.readFileSync(QUERY_FILE, 'utf8'))
  const queries = file.queries.filter((q) => !ONLY || ONLY === true || q.id.includes(ONLY) || q.category.includes(ONLY))
  if (!queries.length) {
    console.error('No queries matched.')
    process.exit(1)
  }

  let gitCommit = 'unknown'
  try {
    gitCommit = execSync('git rev-parse --short HEAD').toString().trim()
    if (execSync('git status --porcelain').toString().trim()) gitCommit += ' (uncommitted changes present)'
  } catch {
    // not a git checkout
  }

  console.log(`Benchmark: ${queries.length} queries against ${BASE}, config ${JSON.stringify(CONFIG)}`)
  const warmups = []
  for (let i = 0; i < WARMUP; i += 1) {
    const warm = await runOne({ id: `warmup-${i + 1}`, category: 'warmup', query: 'What is 12 * 12?' })
    warmups.push({ status: warm.status, clientTotalMs: warm.timings.clientTotalMs, memoryMs: warm.timings.stages.memory_retrieval })
    console.log(`warm-up ${i + 1}: ${warm.status} ${warm.timings.clientTotalMs} ms (excluded)`)
    await sleep(PAUSE_MS)
  }

  const startedAt = new Date().toISOString()
  const runs = []
  for (const item of queries) {
    const record = await runOne(item)
    runs.push(record)
    const t = record.timings
    console.log(
      `${record.status.padEnd(13)} ${item.id.padEnd(9)} total ${String(t.clientTotalMs ?? '-').padStart(7)} ms · ` +
        `tool ${record.tool ?? '-'} · claims ${record.verification ? `${record.verification.supported}/${record.verification.claimsChecked}` : '-'}` +
        `${record.replans ? ` · replans ${record.replans}` : ''}${record.error ? ` · ${String(record.error).slice(0, 90)}` : ''}`
    )
    await sleep(PAUSE_MS)
  }

  const model = runs.find((r) => r.model)?.model || null

  const meta = {
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl: BASE,
    queryFile: QUERY_FILE,
    queryFileVersion: file.version,
    gitCommit,
    model,
    node: process.version,
    config: CONFIG,
    pauseMs: PAUSE_MS,
    timeoutMs: TIMEOUT_MS,
    warmupRuns: WARMUP,
    warmups,
    percentileMethod: 'nearest-rank',
    definitions: DEFINITIONS,
  }
  writeOutputs(OUT, meta, runs)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
