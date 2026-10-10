import { useEffect, useState } from 'react'
import DashNav from './DashNav.jsx'
import TraceView, { formatCost, formatMs } from './TraceView.jsx'
import '../styles/dashboard.css'

function Analytics({ data }) {
  if (!data) return null
  const { totals, stages, tools } = data
  const maxAvg = Math.max(1, ...stages.map((s) => s.avg_ms))
  const okRate = totals.runs ? Math.round((totals.ok / totals.runs) * 100) : 0
  return (
    <div className="stack" style={{ marginBottom: 18 }}>
      <div className="stat-row" style={{ marginBottom: 0 }}>
        <div className="stat"><b>{totals.runs}</b><span>stored runs</span></div>
        <div className="stat"><b>{okRate}%</b><span>completed without error</span></div>
        <div className="stat"><b>{formatMs(totals.p50_ms)}</b><span>median run time</span></div>
        <div className="stat"><b>{formatMs(totals.p95_ms)}</b><span>p95 run time</span></div>
        <div className="stat"><b>{(totals.prompt_tokens + totals.completion_tokens).toLocaleString()}</b><span>tokens used</span></div>
        <div className="stat"><b>{formatCost(totals.cost)}</b><span>estimated model cost</span></div>
        <div className="stat"><b>{totals.replans}</b><span>replans triggered</span></div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h2>Where the time goes</h2>
          <p className="hint">Average and p95 duration per step, across every stored run. Retried steps are counted separately.</p>
          <table className="table">
            <thead>
              <tr><th>step</th><th className="num">calls</th><th>avg</th><th className="num">avg</th><th className="num">p95</th><th className="num">errors</th></tr>
            </thead>
            <tbody>
              {stages.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td className="num">{row.calls}</td>
                  <td><div className="bar-cell"><span style={{ width: `${(row.avg_ms / maxAvg) * 100}%` }} /></div></td>
                  <td className="num">{formatMs(row.avg_ms)}</td>
                  <td className="num">{formatMs(row.p95_ms)}</td>
                  <td className={`num ${row.errors ? 'bad' : 'muted'}`}>{row.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>By tool</h2>
          <p className="hint">How often each tool ran and how often its runs failed or degraded.</p>
          <table className="table">
            <thead>
              <tr><th>tool</th><th className="num">runs</th><th className="num">not ok</th><th className="num">avg time</th></tr>
            </thead>
            <tbody>
              {tools.map((row) => (
                <tr key={row.tool}>
                  <td>{row.tool}</td>
                  <td className="num">{row.runs}</td>
                  <td className={`num ${row.failed ? 'warn' : 'muted'}`}>{row.failed}</td>
                  <td className="num">{formatMs(row.avg_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function TracesPage() {
  const [traces, setTraces] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('id')
    fetch('/api/traces')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setTraces(data.traces)
        setSelected(wanted || data.traces[0]?.id || null)
      })
      .catch((err) => setError(err.message))
    fetch('/api/traces?view=analytics')
      .then((res) => res.json())
      .then((data) => setAnalytics(data.analytics))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selected) return
    setDetail(null)
    fetch(`/api/traces?id=${selected}`)
      .then((res) => res.json())
      .then((data) => setDetail(data.trace || null))
      .catch(() => setDetail(null))
  }, [selected])

  return (
    <div className="dash">
      <DashNav current="/traces" title="TRACE EXPLORER" subtitle="EVERY RUN, STEP BY STEP, WITH REAL INPUTS AND OUTPUTS" />

      {error && <div className="card bad">Could not load traces: {error}</div>}
      <Analytics data={analytics} />

      {traces && traces.length === 0 && (
        <div className="card empty">No traces stored yet. Run a query on the Observatory page and it will appear here.</div>
      )}

      {traces && traces.length > 0 && (
        <div className="split">
          <div className="run-list">
            {traces.map((trace) => (
              <button key={trace.id} type="button" className={`run-item${selected === trace.id ? ' active' : ''}`} onClick={() => setSelected(trace.id)}>
                <span className="q">{trace.query}</span>
                <span className="meta">
                  <span><i className={`dot ${trace.status}`} />{trace.status}</span>
                  <span>{trace.tool || '–'}</span>
                  <span>{formatMs(trace.totalMs)}</span>
                  {trace.replans > 0 && <span className="chip">{trace.replans} replan</span>}
                  {trace.injected && <span className="chip inject">{trace.injected}</span>}
                </span>
              </button>
            ))}
          </div>
          <div className="card">
            {detail ? (
              <>
                <h2>{detail.query}</h2>
                <p className="hint">
                  {new Date(detail.createdAt).toLocaleString()} · routed by {detail.routedBy || 'unknown'} · intent {detail.intentLabel || 'unknown'}
                </p>
                <TraceView trace={detail} />
                {detail.response && (
                  <div style={{ marginTop: 16 }}>
                    <h2>Final answer</h2>
                    <pre className="tv-json" style={{ maxHeight: 260 }}>{detail.response}</pre>
                  </div>
                )}
              </>
            ) : (
              <div className="empty">Loading trace…</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
