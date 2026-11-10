import { useEffect, useMemo, useState } from 'react'
import DashNav from './DashNav.jsx'
import SiteFooter from './SiteFooter.jsx'
import { formatCost, formatMs } from './TraceView.jsx'
import { EVAL_CONFIGS, EVAL_QUESTIONS, EVAL_TASKS } from '../data/evalSuite.js'
import SuccessBars, { latestByConfig } from './SuccessBars.jsx'
import FlowDiagram from './FlowDiagram.jsx'
import { EVAL_FLOW } from '../data/flows.js'
import '../styles/dashboard.css'

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '–')

function tone(n, d) {
  if (!d) return 'muted'
  const rate = n / d
  return rate >= 0.85 ? 'good' : rate >= 0.6 ? 'warn' : 'bad'
}

function HowTested() {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h2>How the test works</h2>
      <div className="flow-wrap">
        <FlowDiagram {...EVAL_FLOW} />
      </div>
      <details className="more">
        <summary>Questions this project answers ({EVAL_QUESTIONS.length})</summary>
        <div className="q-grid">
          {EVAL_QUESTIONS.map((item) => (
            <div key={item.id} className="q-item">
              <div className="q-ask">{item.ask}</div>
              <div className="q-answer">{item.answer}</div>
              <div className="q-where">{item.where}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}

function Comparison({ runs }) {
  const latest = useMemo(() => latestByConfig(runs), [runs])

  const rows = [
    ['Tasks run', (r) => r.tasks, null],
    ['Task success', (r) => pct(r.passed, r.tasks), (r) => tone(r.passed, r.tasks)],
    ['Tool-selection accuracy', (r) => pct(r.toolOk, r.tasks), (r) => tone(r.toolOk, r.tasks)],
    ['Claims supported by sources', (r) => (r.claims ? pct(r.claimsSupported, r.claims) : 'n/a (verifier off)'), (r) => (r.claims ? tone(r.claimsSupported, r.claims) : 'muted')],
    ['Latency p50', (r) => formatMs(r.p50Ms), null],
    ['Latency p95', (r) => formatMs(r.p95Ms), null],
    ['Estimated cost per successful task', (r) => (r.costPerSuccess == null ? '–' : formatCost(r.costPerSuccess)), null],
    ['Injected failures: detected', (r) => pct(r.detected, r.injected), (r) => tone(r.detected, r.injected)],
    ['Injected failures: localized to right stage', (r) => pct(r.localized, r.injected), (r) => tone(r.localized, r.injected)],
    ['Injected failures: final answer correct', (r) => pct(r.recovered, r.injected), (r) => tone(r.recovered, r.injected)],
    ['Recovered through a replan', (r) => `${r.recoveredByReplan} of ${r.injected}`, null],
  ]

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h2>Does verification and replanning help?</h2>
      <p className="hint">
        Pass = right tool, expected facts, no planted ones. "Injected" rows count only the {EVAL_TASKS.filter((t) => t.inject).length} tasks
        with a planted failure.
      </p>
      <div style={{ maxWidth: 560, margin: '16px 0 22px' }}>
        <SuccessBars runs={runs} />
      </div>
      <div className="table-wrap"><table className="table">
        <thead>
          <tr>
            <th>metric</th>
            {latest.map(({ item }) => (
              <th key={item.id} className="num">{item.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, value, toneOf]) => (
            <tr key={name}>
              <td>{name}</td>
              {latest.map(({ item, run }) => (
                <td key={item.id} className={`num ${run && toneOf ? toneOf(run) : ''}`}>
                  {run ? value(run) : <span className="muted">not run</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  )
}

function TaskTable({ runs }) {
  const [runId, setRunId] = useState(null)
  const [results, setResults] = useState(null)

  useEffect(() => {
    if (!runId && runs.length) setRunId(runs[0].id)
  }, [runs, runId])

  useEffect(() => {
    if (!runId) return
    setResults(null)
    fetch(`/api/evals?run=${runId}`)
      .then((res) => res.json())
      .then((data) => setResults(data.results || []))
      .catch(() => setResults([]))
  }, [runId])

  if (!runs.length) return null
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h2>Task-level results</h2>
      <p className="hint">Every task from a chosen run, with the reason it failed and a link to the full trace.</p>
      <select
        value={runId || ''}
        onChange={(e) => setRunId(Number(e.target.value))}
        className="select"
      >
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            #{run.id} · {run.label} · {new Date(run.createdAt).toLocaleString()} · {pct(run.passed, run.tasks)}
          </option>
        ))}
      </select>
      {!results && <div className="empty">Loading…</div>}
      {results && (
        <div className="table-wrap"><table className="table">
          <thead>
            <tr>
              <th>task</th>
              <th>question</th>
              <th>result</th>
              <th className="num">time</th>
              <th className="num">replans</th>
              <th>stage (truth → diagnosed)</th>
              <th>why it failed</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row, index) => (
              <tr key={`${row.taskId}-${index}`}>
                <td>{row.traceId ? <a href={`/traces?id=${row.traceId}`}>{row.taskId}</a> : row.taskId}</td>
                <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.query}>
                  {row.injected && <span className="chip inject" style={{ marginRight: 6 }}>{row.injected}</span>}
                  {row.query}
                </td>
                <td className={row.success ? 'good' : 'bad'}>{row.success ? 'pass' : 'fail'}</td>
                <td className="num">{formatMs(row.totalMs)}</td>
                <td className="num">{row.replans || 0}</td>
                <td>
                  {row.injected ? (
                    <span className={row.localized ? 'good' : 'warn'}>{row.truthStage} → {row.diagnosedStage}</span>
                  ) : (
                    <span className="muted">–</span>
                  )}
                </td>
                <td className="muted" style={{ maxWidth: 280 }}>{row.failureReason || ''}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  )
}

function Benchmarks({ rows }) {
  const maxMs = Math.max(1, ...rows.map((row) => row.serverP95))
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h2>Memory retrieval latency as the table grows</h2>
      <p className="hint">Top-5 search time on random test vectors. Lower is better.</p>
      <details className="more">
        <summary>About this benchmark</summary>
        <ul className="fine-print">
          <li>Synthetic random 384-dimension vectors in a scratch table, top-5 cosine search.</li>
          <li>"Client" includes the network hop to the hosted database; "server" is the database's own execution time.</li>
          <li>Random vectors have no cluster structure, so recall here is a stress test, not a prediction for real text.</li>
          <li>The app's real memory table holds at most 80 rows.</li>
        </ul>
      </details>
      {rows.length === 0 ? (
        <div className="empty">No benchmark stored yet. Run: <code>node --env-file=.env scripts/benchmarkRetrieval.js</code></div>
      ) : (
        <div className="table-wrap"><table className="table">
          <thead>
            <tr>
              <th className="num">rows</th>
              <th>method</th>
              <th className="num">client p50</th>
              <th className="num">client p95</th>
              <th className="num">server p50</th>
              <th className="num">server p95</th>
              <th>server p95</th>
              <th className="num">recall@5</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.rowCount}-${row.indexType}`}>
                <td className="num">{row.rowCount.toLocaleString()}</td>
                <td>{row.indexType}</td>
                <td className="num">{formatMs(row.clientP50)}</td>
                <td className="num">{formatMs(row.clientP95)}</td>
                <td className="num">{formatMs(row.serverP50)}</td>
                <td className="num">{formatMs(row.serverP95)}</td>
                <td><div className="bar-cell"><span style={{ width: `${(row.serverP95 / maxMs) * 100}%` }} /></div></td>
                <td className={`num ${row.recallAt5 >= 0.9 ? 'good' : row.recallAt5 >= 0.6 ? 'warn' : 'bad'}`}>
                  {row.recallAt5 == null ? '–' : row.recallAt5.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  )
}

export default function EvalsPage() {
  const [runs, setRuns] = useState(null)
  const [benchmarks, setBenchmarks] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/evals')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setRuns(data.runs)
      })
      .catch((err) => setError(err.message))
    fetch('/api/evals?view=benchmarks')
      .then((res) => res.json())
      .then((data) => setBenchmarks(data.benchmarks || []))
      .catch(() => {})
  }, [])

  return (
    <>
      <DashNav
        current="/evals"
        title={<>Measured,<br />not claimed</>}
        subtitle="The same questions with and without fact-checking, plus memory search speed."
      />
    <div className="dash">
      <HowTested />
      {error && <div className="card bad" style={{ marginBottom: 18 }}>Could not load results: {error}</div>}
      {runs && runs.length === 0 && (
        <div className="card empty" style={{ marginBottom: 18 }}>
          No evaluation has been run yet. Start the server, then run <code>node --env-file=.env scripts/runEval.js</code>.
        </div>
      )}
      {runs && runs.length > 0 && (
        <>
          <Comparison runs={runs} />
          <TaskTable runs={runs} />
        </>
      )}
      <Benchmarks rows={benchmarks} />
      <div className="card">
        <h2>How to read these numbers</h2>
        <ul className="caveats">
          <li><b>Small suite</b><span>{EVAL_TASKS.length} tasks. A pass means the expected facts appeared, not that the writing is good.</span></li>
          <li><b>One run is a snapshot</b><span>Model output and web results change. Use <code>--repeat</code> to see the spread.</span></li>
          <li><b>Cost is model tokens only</b><span>List prices; search and hosting are not included.</span></li>
          <li><b>The verifier can be wrong</b><span>It is an AI check, with a word-overlap fallback. The trace says which ran.</span></li>
          <li><b>Stage diagnosis is rule-based</b><span>Read from the trace, scored against where the failure was planted.</span></li>
        </ul>
      </div>
    </div>
      <SiteFooter />
    </>
  )
}
