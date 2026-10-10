import { useEffect, useState } from 'react'
import { EXAMPLE_PROMPTS } from '../data/scenarios.js'

const STEER_TOOLS = [
  ['web_search', 'Web'],
  ['calculator', 'Calculator'],
  ['database', 'Database'],
  ['external_api', 'Document'],
]

const INJECTIONS = [
  ['', 'No failure'],
  ['hallucinated_claim', 'Inject: fake claim'],
  ['irrelevant_retrieval', 'Inject: wrong sources'],
  ['empty_retrieval', 'Inject: empty search'],
  ['tool_timeout', 'Inject: tool timeout'],
]

export default function RunConsole({
  running,
  label,
  onRun,
  awaitingSteer,
  onSteer,
  frames = [],
  onScrub,
  onReplay,
  soundOn,
  onToggleSound,
  onExport,
  canExport,
}) {
  const [query, setQuery] = useState('')
  const [inject, setInject] = useState('')
  const [scrub, setScrub] = useState(frames.length ? frames.length - 1 : 0)

  useEffect(() => {
    setScrub(Math.max(frames.length - 1, 0))
  }, [frames.length])

  const submit = (e) => {
    e.preventDefault()
    const q = query.trim()
    if (!q || running) return
    onRun(q, { inject: inject || undefined })
  }

  return (
    <div className="run-console">
      {running && (
        <div className="status-line">
          <span className="status-dot" />
          {label}
        </div>
      )}

      {awaitingSteer && (
        <div className="steer-row">
          {STEER_TOOLS.map(([id, name]) => (
            <button key={id} type="button" onClick={() => onSteer(id)}>
              {name}
            </button>
          ))}
        </div>
      )}

      {frames.length > 1 && !running && (
        <div className="replay-row">
          <button type="button" onClick={onReplay}>Replay</button>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={Math.min(scrub, frames.length - 1)}
            onChange={(event) => {
              const next = Number(event.target.value)
              setScrub(next)
              onScrub(next)
            }}
          />
          <button type="button" onClick={() => onScrub(null)}>Now</button>
        </div>
      )}

      <form className="run-form" onSubmit={submit}>
        <input
          type="text"
          placeholder="Ask the AI Agent something..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={running}
        />
        <select className="inject-select" value={inject} onChange={(e) => setInject(e.target.value)} disabled={running} title="Force a failure so you can watch the verifier and replanner react">
          {INJECTIONS.map(([value, name]) => (
            <option key={value} value={value}>{name}</option>
          ))}
        </select>
        <button type="button" className={soundOn ? 'on' : ''} onClick={onToggleSound}>
          {soundOn ? 'Sound on' : 'Sound'}
        </button>
        <button type="button" onClick={onExport} disabled={!canExport}>
          Export
        </button>
        <button type="submit" disabled={running || !query.trim()}>
          {running ? 'Running...' : 'Run Agent'}
        </button>
      </form>

      <div className="example-chips">
        {EXAMPLE_PROMPTS.map((p) => (
          <button key={p} type="button" disabled={running} onClick={() => onRun(p, { inject: inject || undefined })}>
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
