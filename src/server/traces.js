import { randomUUID } from 'node:crypto'
import { isConfigured, query } from './db.js'

// Groq list price for openai/gpt-oss-120b, USD per 1M tokens. These are
// constants for an *estimate*; check the Groq pricing page before quoting them.
export const PRICE_PER_M = { prompt: 0.15, completion: 0.75 }

const MAX_FIELD = 2400

export function estimateCost(promptTokens, completionTokens) {
  return (promptTokens * PRICE_PER_M.prompt + completionTokens * PRICE_PER_M.completion) / 1_000_000
}

// Keeps stored payloads inspectable without letting one page of scraped text
// bloat the table.
function clip(value, depth = 0) {
  if (value == null) return value
  if (typeof value === 'string') return value.length > MAX_FIELD ? `${value.slice(0, MAX_FIELD)}… [${value.length - MAX_FIELD} more chars]` : value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (depth > 3) return '[nested]'
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => clip(item, depth + 1))
  if (typeof value === 'object') {
    const out = {}
    for (const [key, item] of Object.entries(value)) out[key] = clip(item, depth + 1)
    return out
  }
  return String(value)
}

// Collects token usage across every Groq call in a run.
export function createMeter() {
  return { promptTokens: 0, completionTokens: 0, calls: 0 }
}

export function addUsage(meter, usage) {
  if (!meter || !usage) return
  meter.promptTokens += Number(usage.prompt_tokens ?? usage.input_tokens ?? 0)
  meter.completionTokens += Number(usage.completion_tokens ?? usage.output_tokens ?? 0)
  meter.calls += 1
}

export function createTracer({ query: text, config, injected }) {
  const id = randomUUID()
  const origin = performance.now()
  const meter = createMeter()
  const spans = []
  const startedAt = new Date().toISOString()

  async function span(name, kind, input, fn, { attempt = 1 } = {}) {
    const started = performance.now()
    const before = { prompt: meter.promptTokens, completion: meter.completionTokens }
    const record = {
      seq: spans.length + 1,
      attempt,
      name,
      kind,
      status: 'ok',
      startedMs: Math.round(started - origin),
      durationMs: 0,
      input: clip(input),
      output: null,
      error: null,
      promptTokens: 0,
      completionTokens: 0,
    }
    spans.push(record)
    try {
      const result = await fn(record)
      return result
    } catch (err) {
      record.status = 'error'
      record.error = err.message
      throw err
    } finally {
      record.durationMs = Math.round(performance.now() - started)
      record.promptTokens = meter.promptTokens - before.prompt
      record.completionTokens = meter.completionTokens - before.completion
      if (record.output != null) record.output = clip(record.output)
    }
  }

  function summary(extra = {}) {
    return {
      id,
      createdAt: startedAt,
      query: text,
      config,
      injected: injected || null,
      totalMs: Math.round(performance.now() - origin),
      promptTokens: meter.promptTokens,
      completionTokens: meter.completionTokens,
      estCostUsd: Number(estimateCost(meter.promptTokens, meter.completionTokens).toFixed(6)),
      llmCalls: meter.calls,
      spans,
      ...extra,
    }
  }

  return { id, meter, span, summary }
}

// Persisting must never break a run, so every failure is swallowed and reported.
export async function saveTrace(trace) {
  if (!isConfigured()) return { saved: false, reason: 'DATABASE_URL is not set' }
  try {
    await query(
      `INSERT INTO traces (id, created_at, query, tool, intent_label, routed_by, status, error, attempts, replans,
                           total_ms, prompt_tokens, completion_tokens, est_cost_usd, claims, claims_supported,
                           injected, config, response)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (id) DO NOTHING`,
      [
        trace.id,
        trace.createdAt,
        trace.query,
        trace.tool || null,
        trace.intentLabel || null,
        trace.routedBy || null,
        trace.status,
        trace.error || null,
        trace.attempts || 1,
        trace.replans || 0,
        trace.totalMs,
        trace.promptTokens,
        trace.completionTokens,
        trace.estCostUsd,
        trace.claims || 0,
        trace.claimsSupported || 0,
        trace.injected || null,
        JSON.stringify(trace.config || {}),
        trace.response ? String(trace.response).slice(0, 4000) : null,
      ]
    )
    for (const span of trace.spans) {
      await query(
        `INSERT INTO trace_spans (trace_id, seq, attempt, name, kind, status, started_ms, duration_ms, input, output,
                                  error, prompt_tokens, completion_tokens)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          trace.id,
          span.seq,
          span.attempt,
          span.name,
          span.kind,
          span.status,
          span.startedMs,
          span.durationMs,
          JSON.stringify(span.input ?? null),
          JSON.stringify(span.output ?? null),
          span.error,
          span.promptTokens,
          span.completionTokens,
        ]
      )
    }
    return { saved: true }
  } catch (err) {
    return { saved: false, reason: err.message }
  }
}

function rowToTrace(row) {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    query: row.query,
    tool: row.tool,
    intentLabel: row.intent_label,
    routedBy: row.routed_by,
    status: row.status,
    error: row.error,
    attempts: row.attempts,
    replans: row.replans,
    totalMs: row.total_ms,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    estCostUsd: Number(row.est_cost_usd),
    claims: row.claims,
    claimsSupported: row.claims_supported,
    injected: row.injected,
    config: row.config,
    response: row.response,
  }
}

export async function listTraces(limit = 40) {
  if (!isConfigured()) return []
  const result = await query(`SELECT * FROM traces ORDER BY created_at DESC LIMIT $1`, [limit])
  return result.rows.map(rowToTrace)
}

export async function getTrace(id) {
  if (!isConfigured()) return null
  const head = await query(`SELECT * FROM traces WHERE id = $1`, [id])
  if (!head.rows.length) return null
  const spans = await query(`SELECT * FROM trace_spans WHERE trace_id = $1 ORDER BY seq`, [id])
  return {
    ...rowToTrace(head.rows[0]),
    spans: spans.rows.map((row) => ({
      seq: row.seq,
      attempt: row.attempt,
      name: row.name,
      kind: row.kind,
      status: row.status,
      startedMs: row.started_ms,
      durationMs: row.duration_ms,
      input: row.input,
      output: row.output,
      error: row.error,
      promptTokens: row.prompt_tokens,
      completionTokens: row.completion_tokens,
    })),
  }
}

// Aggregates across stored traces, used by the analytics view.
export async function traceAnalytics() {
  if (!isConfigured()) return null
  const totals = await query(
    `SELECT count(*)::int AS runs,
            count(*) FILTER (WHERE status = 'ok')::int AS ok,
            count(*) FILTER (WHERE status <> 'ok')::int AS failed,
            coalesce(avg(total_ms), 0)::int AS avg_ms,
            coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY total_ms), 0)::int AS p50_ms,
            coalesce(percentile_cont(0.95) WITHIN GROUP (ORDER BY total_ms), 0)::int AS p95_ms,
            coalesce(sum(prompt_tokens), 0)::int AS prompt_tokens,
            coalesce(sum(completion_tokens), 0)::int AS completion_tokens,
            coalesce(sum(est_cost_usd), 0)::float AS cost,
            coalesce(sum(replans), 0)::int AS replans
       FROM traces`
  )
  const stages = await query(
    `SELECT name, count(*)::int AS calls,
            coalesce(avg(duration_ms), 0)::int AS avg_ms,
            coalesce(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms), 0)::int AS p95_ms,
            count(*) FILTER (WHERE status = 'error')::int AS errors
       FROM trace_spans
      GROUP BY name
      ORDER BY avg(duration_ms) DESC`
  )
  const tools = await query(
    `SELECT coalesce(tool, 'unknown') AS tool, count(*)::int AS runs,
            count(*) FILTER (WHERE status <> 'ok')::int AS failed,
            coalesce(avg(total_ms), 0)::int AS avg_ms
       FROM traces
      GROUP BY 1
      ORDER BY 2 DESC`
  )
  return { totals: totals.rows[0], stages: stages.rows, tools: tools.rows }
}
