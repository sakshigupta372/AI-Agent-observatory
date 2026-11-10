import { useEffect, useState } from 'react'
import { Download, Volume2, VolumeX } from 'lucide-react'
import { EXAMPLE_CHIPS } from '../data/scenarios.js'
import { INJECTIONS } from '../data/labels.js'

const STEER_TOOLS = [
  ['web_search', 'Web'],
  ['calculator', 'Calculator'],
  ['database', 'Database'],
  ['external_api', 'Document'],
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
  inputRef,
  prefillQuery,
  onBreakIt,
  children,
}) {
  const [query, setQuery] = useState('')
  const [inject, setInject] = useState('')
  const [scrub, setScrub] = useState(frames.length ? frames.length - 1 : 0)

  useEffect(() => {
    setScrub(Math.max(frames.length - 1, 0))
  }, [frames.length])

  useEffect(() => {
    if (prefillQuery) setQuery(prefillQuery.text)
  }, [prefillQuery])

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
          ref={inputRef}
          type="text"
          placeholder="Ask the AI Agent something..."
          aria-label="Your question"
          value={query}
          maxLength={4000}
          onChange={(e) => setQuery(e.target.value)}
          disabled={running}
        />
        <label className={`inject-field${inject ? ' armed' : ''}`} title="Force a failure so you can watch the fact-check and retry react">
          <span>Inject a failure</span>
          <select className="inject-select" value={inject} onChange={(e) => setInject(e.target.value)} disabled={running}>
            {INJECTIONS.map((option) => (
              <option key={option.value} value={option.value} title={option.hint}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary run-btn" disabled={running || !query.trim()}>
          {running ? 'Running…' : 'Run Agent'}
        </button>
        {onBreakIt && (
          <button type="button" className="btn-ghost break-btn" onClick={onBreakIt}>
            Break it yourself
          </button>
        )}
      </form>

      <div className="console-row">
        <div className="example-chips" role="group" aria-label="Example questions">
          <span className="chips-label">Try</span>
          {EXAMPLE_CHIPS.map((chip) => (
            <button key={chip.prompt} type="button" disabled={running} title={chip.prompt} onClick={() => onRun(chip.prompt, { inject: inject || undefined })}>
              {chip.label}
            </button>
          ))}
        </div>
        <div className="console-actions">
          {children}
          <button type="button" className={`btn-ghost icon-btn${soundOn ? ' on' : ''}`} onClick={onToggleSound} aria-pressed={soundOn} title={soundOn ? 'Turn sound off' : 'Turn sound on'}>
            {soundOn ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />}
            <span>Sound</span>
          </button>
          <button type="button" className="btn-ghost icon-btn" onClick={onExport} disabled={!canExport} title="Download this run as an HTML report">
            <Download size={15} aria-hidden="true" />
            <span>Export</span>
          </button>
        </div>
      </div>
    </div>
  )
}
