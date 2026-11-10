import { useState } from 'react'
import '../styles/traceview.css'
import { stepName, toolName } from '../data/labels.js'

export { stepName, toolName }

const KIND_COLOR = {
  planner: '#a78bff',
  memory: '#ff8fd0',
  tool: '#ffb168',
  llm: '#6effc7',
  verifier: '#d7c4ff',
}

export const STATUS_PLAIN = { ok: 'answered', degraded: 'answered with fallback', failed: 'failed' }

const TOOL_PLAIN = {
  web_search: 'web search',
  calculator: 'the calculator',
  database: 'the customer database',
  external_api: 'text analysis',
}

const INJECT_PLAIN = {
  hallucinated_claim: 'a fake fact slipped into the answer',
  irrelevant_retrieval: 'off-topic search results',
  empty_retrieval: 'an empty search',
  tool_timeout: 'a tool timeout',
}


// One short paragraph a non-engineer can read before the detailed timeline.
export function describeRun(trace) {
  const parts = []
  const tool = TOOL_PLAIN[trace.tool]
  if (trace.injected) parts.push(`A failure was planted on purpose: ${INJECT_PLAIN[trace.injected] || trace.injected}.`)
  parts.push(tool ? `The agent chose ${tool}.` : 'The agent planned the question.')
  const failed = trace.spans.filter((s) => s.status === 'error')
  if (failed.length) {
    const first = failed[0]
    const reason = first.error ? ` (${first.error.length > 90 ? `…` : first.error})` : ''
    parts.push(`${failed.map((s) => stepName(s.name)).join(', ')} went wrong${reason}.`)
  }
  if (trace.replans > 0) {
    parts.push(`It noticed a problem and went back to retry ${trace.replans === 1 ? 'once' : ` times`}.`)
  }
  if (trace.claims) {
    parts.push(`The fact-checker backed up ${trace.claimsSupported} of ${trace.claims} claims with its sources.`)
  }
  if (trace.status === 'ok') parts.push(`Answered in ${formatMs(trace.totalMs)}.`)
  else if (trace.status === 'degraded') parts.push(`It still answered, using a fallback, in ${formatMs(trace.totalMs)}.`)
  else parts.push('It could not answer.')
  return parts.join(' ')
}

export function formatMs(ms) {
  if (ms == null) return '–'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

export function formatCost(usd) {
  if (!usd) return '$0'
  return usd < 0.01 ? `$${usd.toFixed(5)}` : `$${usd.toFixed(3)}`
}

function Json({ value }) {
  if (value == null) return <span className="tv-none">none recorded</span>
  return <pre className="tv-json">{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</pre>
}

function Metric({ label, value, tone }) {
  return (
    <div className={`tv-metric${tone ? ` ${tone}` : ''}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )
}

// Inspectable view of one run: summary numbers, a timing waterfall, and every
// span's real input, output and error. Used by the in-scene inspector and /traces.
export default function TraceView({ trace }) {
  const [open, setOpen] = useState(null)
  if (!trace) return <div className="tv-empty">Run the agent to see its trace.</div>

  const total = Math.max(trace.totalMs || 1, ...trace.spans.map((s) => s.startedMs + s.durationMs))
  const failedSpans = trace.spans.filter((s) => s.status === 'error')

  return (
    <div className="tv">
      <p className={`tv-plain ${trace.status}`}>{describeRun(trace)}</p>
      <div className="tv-summary">
        <Metric label="result" value={STATUS_PLAIN[trace.status] || trace.status} tone={trace.status === 'ok' ? 'good' : trace.status === 'failed' ? 'bad' : 'warn'} />
        <Metric label="total" value={formatMs(trace.totalMs)} />
        <Metric label="attempts" value={trace.attempts ?? 1} />
        <Metric label="replans" value={trace.replans ?? 0} tone={trace.replans ? 'warn' : ''} />
        <Metric label="tokens in/out" value={`${trace.promptTokens}/${trace.completionTokens}`} />
        <Metric label="est. cost" value={formatCost(trace.estCostUsd)} />
        <Metric
          label="claims supported"
          value={trace.claims ? `${trace.claimsSupported}/${trace.claims}` : 'n/a'}
          tone={trace.claims && trace.claimsSupported < trace.claims ? 'warn' : ''}
        />
      </div>

      {trace.injected && (
        <div className="tv-note">
          Failure injected for this run: <b>{trace.injected}</b>. The trace below shows how the agent behaved.
        </div>
      )}
      {failedSpans.length > 0 && (
        <div className="tv-note bad">
          {failedSpans.length} step{failedSpans.length > 1 ? 's' : ''} failed: {failedSpans.map((s) => stepName(s.name)).join(', ')}
        </div>
      )}

      <div className="tv-spans">
        {trace.spans.map((span) => {
          const expanded = open === span.seq
          const left = (span.startedMs / total) * 100
          const width = Math.max(1.2, (span.durationMs / total) * 100)
          return (
            <div key={span.seq} className="tv-span">
              <button type="button" className={`tv-row${span.status === 'error' ? ' failed' : ''}`} onClick={() => setOpen(expanded ? null : span.seq)}>
                <span className="tv-seq">{span.seq}</span>
                <span className="tv-name">
                  {stepName(span.name)}
                  {span.attempt > 1 && <i>retry {span.attempt - 1}</i>}
                </span>
                <span className="tv-bar">
                  <span
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: span.status === 'error' ? '#ff6b86' : KIND_COLOR[span.kind] || '#7fd9ff',
                    }}
                  />
                </span>
                <span className="tv-dur">{formatMs(span.durationMs)}</span>
              </button>
              {expanded && (
                <div className="tv-detail">
                  <div className="tv-meta">
                    <span>kind {span.kind}</span>
                    <span>started +{formatMs(span.startedMs)}</span>
                    <span>status {span.status}</span>
                    {(span.promptTokens > 0 || span.completionTokens > 0) && (
                      <span>
                        tokens {span.promptTokens}/{span.completionTokens}
                      </span>
                    )}
                  </div>
                  {span.error && (
                    <div className="tv-block">
                      <h4>Error</h4>
                      <pre className="tv-json err">{span.error}</pre>
                    </div>
                  )}
                  <div className="tv-block">
                    <h4>Input</h4>
                    <Json value={span.input} />
                  </div>
                  <div className="tv-block">
                    <h4>Output</h4>
                    <Json value={span.output} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="tv-foot">
        Bars show when each step started and how long it ran, on one shared timeline of {formatMs(total)}. Cost is an estimate from token counts at Groq list prices; the Tavily search credits are not included.
      </div>
    </div>
  )
}
