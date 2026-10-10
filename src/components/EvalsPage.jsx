import { useEffect, useMemo, useState } from 'react'
import DashNav from './DashNav.jsx'
import { formatCost, formatMs } from './TraceView.jsx'
import { EVAL_CONFIGS, EVAL_QUESTIONS, EVAL_TASKS } from '../data/evalSuite.js'
import '../styles/dashboard.css'

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '–')

function tone(n, d) {
  if (!d) return 'muted'
  const rate = n / d
  return rate >= 0.85 ? 'good' : rate >= 0.6 ? 'warn' : 'bad'
}

function Questions() {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h2>Questions this project is built to answer</h2>
      <p className="hint">Each question raised about the agent maps to something you can run or measure here.</p>
      <div className="grid-2">
        {EVAL_QUESTIONS.map((item) => (
          <div key={item.id} style={{ padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ color: '#e8eefc', fontSize: 13.5, marginBottom: 4 }}>{item.ask}</div>
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>{item.answer}</div>
            <div style={{ marginTop: 4, fontFamily: 'Consolas, monospace', fontSize: 11, color: '#7fd9ff' }}>{item.where}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Comparison({ runs }) {
  const latest = useMemo(() => {
    const byConfig = new Map()
    for (const run of runs) {
      const id = run.config?.id
      if (id && !byConfig.has(id)) byConfig.set(id, run)
    }
    return EVAL_CONFIGS.map((item) => ({ item, run: byConfig.get(item.id) }))
  }, [runs])

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
        The same {EVAL_TASKS.length} tasks under three configurations. Success means the right tool was chosen, the answer contains the
        reference facts and none of the forbidden ones. "Injected" rows only count the {EVAL_TASKS.filter((t) => t.inject).length} tasks
        where a failure was planted on purpose.
      </p>
      <table className="table">
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
      </table>
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
        className="inject-select"
        style={{ marginBottom: 12, color: '#cfe3ff', background: 'rgba(10,16,28,0.8)', borderColor: 'rgba(120,170,255,0.3)' }}
      >
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            #{run.id} · {run.label} · {new Date(run.createdAt).toLocaleString()} · {pct(run.passed, run.tasks)}
          </option>
        ))}
      </select>
      {!results && <div className="empty">Loading…</div>}
      {results && (
        <table className="table">
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
                <td>{row.traceId ? <a href={`/traces?id=${row.traceId}`} style={{ color: '#7fd9ff' }}>{row.taskId}</a> : row.taskId}</td>
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
        </table>
      )}
    </div>
  )
}

function Benchmarks({ rows }) {
  const maxMs = Math.max(1, ...rows.map((row) => row.serverP95))
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h2>Memory retrieval latency as the table grows</h2>
      <p className="hint">
        Synthetic random 384-dimension vectors in a scratch table, top-5 cosine search. "Client" includes the network hop to the hosted
        database; "server" is the database's own execution time. Random vectors have no cluster structure, so recall here is a stress
        test and not a prediction for real text. The app's real memory table holds at most 80 rows.
      </p>
      {rows.length === 0 ? (
        <div className="empty">No benchmark stored yet. Run: <code>node --env-file=.env scripts/benchmarkRetrieval.js</code></div>
      ) : (
        <table className="table">
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
        </table>
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
    <div className="dash">
      <DashNav current="/evals" title="EVALUATION" subtitle="MEASURED RESULTS, NOT CLAIMS" />
      <Questions />
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
        <p className="hint" style={{ marginBottom: 0 }}>
          The suite is small ({EVAL_TASKS.length} tasks) and graded by reference patterns, so a pass means the expected facts appeared and
          forbidden ones did not, not that the prose is good. Model output varies between runs and web results change, so a single pass is a
          snapshot; repeat runs with <code>--repeat</code> to see the spread. Cost uses list prices for the model's tokens and excludes
          search and hosting. The verifier is an LLM check, not ground truth, and falls back to a word-overlap check when the model is
          unavailable; the trace marks which one ran. Stage localization is a rule-based diagnosis read from the trace and is scored
          against the stage where each failure was planted.
        </p>
      </div>
    </div>
  )
}
