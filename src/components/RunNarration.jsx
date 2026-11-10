import { useEffect, useRef, useState } from 'react'
import { NODES, TOOLS } from '../data/agentArchitecture.js'
import ResponsePanel from './ResponsePanel.jsx'
import TracePanel from './TracePanel.jsx'
import MemoryStatsPanel from './MemoryStatsPanel.jsx'

const COLOR = Object.fromEntries([...NODES, ...TOOLS].map((item) => [item.id, item.color]))
const MARK = { live: '', ok: '✓', warn: '!', failed: '✕' }
const STATUS_WORD = { live: 'in progress', ok: 'done', warn: 'warning', failed: 'failed' }

const formatMs = (ms) => (ms == null ? '' : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`)

function Intro() {
  return (
    <div className="narr-intro">
      <p>Ask a question below. Each step the agent takes is explained here while it happens, and lights up in the 3D map.</p>
      <ol>
        <li><b>Understand</b> the question and plan</li>
        <li><b>Look up</b> memory, then use a tool such as web search</li>
        <li><b>Write</b> an answer and <b>fact-check</b> every claim</li>
        <li><b>Retry</b> with a better search if the check fails</li>
      </ol>
    </div>
  )
}

export default function RunNarration({ exec, details, onInspect, children }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const listRef = useRef(null)
  const { story, running, summary } = exec
  const current = running ? exec.label || 'Working…' : summary ? `${summary.title}${summary.lines[0] ? ` · ${summary.lines[0]}` : ''}` : 'Ask the agent a question'

  useEffect(() => {
    if (summary) setSheetOpen(true)
  }, [summary])

  useEffect(() => {
    const list = listRef.current
    if (list && running) list.lastElementChild?.scrollIntoView({ block: 'nearest' })
  }, [story.length, running])

  const hasRun = Boolean(exec.query) || story.length > 0

  return (
    <aside className={`obs-side${sheetOpen ? ' open' : ''}`} aria-label="Run narration">
      <button
        type="button"
        className="obs-side-handle"
        onClick={() => setSheetOpen((open) => !open)}
        aria-expanded={sheetOpen}
        aria-controls="obs-side-body"
      >
        <span className={`handle-dot${running ? ' live' : summary ? ` ${summary.status}` : ''}`} aria-hidden="true" />
        <span className="handle-text">{current}</span>
        <span className="handle-caret" aria-hidden="true">{sheetOpen ? '▾' : '▴'}</span>
      </button>

      <div className="obs-side-body" id="obs-side-body">
        {children}

        <section className="narr">
          <header className="narr-head">
            <h2>{running ? 'Live run' : summary ? 'Last run' : 'How it works'}</h2>
            {running && <span className="narr-live">Live</span>}
          </header>
          <p className="sr-only" aria-live="polite">{running ? exec.label : summary ? summary.title : ''}</p>

          {!hasRun && <Intro />}
          {exec.query && <p className="narr-query">“{exec.query}”</p>}

          {story.length > 0 && (
            <ol className="narr-steps" ref={listRef}>
              {story.map((item) => (
                <li key={item.key} className={`${item.status}${item.retry ? ' retry' : ''}`}>
                  <span className="narr-mark" style={{ '--node': COLOR[item.node] || '#a2a0ac' }} aria-label={STATUS_WORD[item.status]}>
                    {MARK[item.status]}
                  </span>
                  <span className="narr-text">
                    {item.text}
                    {item.detail && <small>{item.detail}</small>}
                  </span>
                  {item.ms != null && <em>{formatMs(item.ms)}</em>}
                </li>
              ))}
            </ol>
          )}

          {running && exec.streamText && (
            <div className="narr-draft">
              <span>Draft answer, not yet fact-checked</span>
              <p>{exec.streamText}</p>
            </div>
          )}

          {!running && summary && (
            <div className={`narr-summary ${summary.status}`}>
              <b>{summary.title}</b>
              {summary.lines.length > 0 && <span>{summary.lines.join(' · ')}</span>}
              {summary.error && summary.status !== 'ok' && <span className="narr-error">{summary.error}</span>}
            </div>
          )}

          {!running && exec.response && (
            <ResponsePanel response={exec.response} sources={exec.sources} asOf={exec.asOf} verdicts={exec.verdicts} embedded />
          )}

          {!running && exec.runTrace?.id && (
            <div className="narr-actions">
              <button type="button" className="btn-ghost" onClick={onInspect}>Inspect every step</button>
              <a className="btn-ghost" href={`/traces?id=${exec.runTrace.id}`}>Open in Traces →</a>
            </div>
          )}
        </section>

        {details && exec.memoryStats && <MemoryStatsPanel stats={exec.memoryStats} />}
        {details && (
          <TracePanel trace={exec.trace} running={running} canInspect={Boolean(exec.runTrace) && !running} onInspect={onInspect} />
        )}
      </div>
    </aside>
  )
}
