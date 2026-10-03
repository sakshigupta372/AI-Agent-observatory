import { useEffect, useRef, useState } from 'react'

function formatLatency(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

// Developer-style live execution trace, right side of the screen.
// Click a row to expand its underlying technical detail.
export default function TracePanel({ trace, running }) {
  const [expandedId, setExpandedId] = useState(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [trace])

  return (
    <div className="trace-panel">
      <div className="trace-header">
        <span>AGENT TRACE</span>
        {running && <span className="trace-live">● LIVE</span>}
      </div>

      <div className="trace-list" ref={listRef}>
        {trace.length === 0 && (
          <div className="trace-empty">No execution yet. Run the agent to see live events.</div>
        )}

        {trace.map((entry) => {
          const expanded = expandedId === entry.id
          return (
            <div key={entry.id} className="trace-entry">
              <button
                className="trace-row"
                onClick={() => setExpandedId(expanded ? null : entry.id)}
              >
                <span className="trace-time">[{entry.time}]</span>
                <span className="trace-event">{entry.event}</span>
                <span className="trace-latency">{formatLatency(entry.latency)}</span>
              </button>

              {expanded && (
                <div className="trace-detail">
                  <div><span>step</span>{entry.detail.step}</div>
                  {entry.detail.activeNode && <div><span>node</span>{entry.detail.activeNode}</div>}
                  {entry.detail.activeTool && <div><span>tool</span>{entry.detail.activeTool}</div>}
                  {entry.detail.connection && (
                    <div><span>edge</span>{entry.detail.connection.join(' → ')}</div>
                  )}
                  <div><span>phase</span>{entry.detail.phase}</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
