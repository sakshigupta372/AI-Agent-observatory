import { useEffect, useRef } from 'react'
import { parseAnswer } from '../data/parseAnswer.js'

function formatTime(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return date.toLocaleDateString()
}

function getToolIcon(tool) {
  const icons = {
    web_search: '🌐',
    calculator: '🧮',
    database: '💾',
    external_api: '🔌',
  }
  return icons[tool] || '❓'
}

const PREVIEW_POINTS = 3

function AnswerPreview({ result }) {
  const { headline, bullets } = parseAnswer(String(result).replace(/`/g, ''))
  const shown = bullets.slice(0, PREVIEW_POINTS)
  const more = bullets.length - shown.length
  return (
    <div className="history-result">
      {headline && <p className="history-headline">{headline}</p>}
      {shown.length > 0 && (
        <ul className="history-points">
          {shown.map((point, index) => (
            <li key={index}>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && <span className="history-more">+{more} more {more === 1 ? 'point' : 'points'}</span>}
    </div>
  )
}

export default function QueryHistory({ history, isOpen, onToggle, onClear, onSelectQuery, currentQuery, showToggle = true }) {
  const panel = useRef(null)
  // A closed drawer must not take keyboard focus (React 18 has no inert prop).
  useEffect(() => {
    panel.current?.toggleAttribute('inert', !isOpen)
  }, [isOpen])

  const handleClear = () => {
    if (confirm('Clear all query history?')) onClear()
  }

  return (
    <>
      {showToggle && <button
        type="button"
        className="history-toggle"
        onClick={onToggle}
        aria-label="Toggle query history"
        title="Query History (H)"
      >
        {isOpen ? '✕' : '📜'}
        <span className="history-count">{history.length}</span>
      </button>}

      <div ref={panel} className={`query-history ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
        <div className="history-header">
          <h3>Query History</h3>
          {!showToggle && (
            <button type="button" className="clear-history" onClick={onToggle} aria-label="Close history">
              Close
            </button>
          )}
          <button type="button" className="clear-history" onClick={handleClear} disabled={history.length === 0}>
            Clear
          </button>
        </div>

        <div className="history-list">
          {history.length === 0 ? (
            <div className="history-empty">
              <p>No queries yet</p>
              <span>Your query history will appear here</span>
            </div>
          ) : (
            history.map((entry) => (
              <div
                key={entry.id}
                className={`history-item ${entry.query === currentQuery ? 'active' : ''}`}
                onClick={() => onSelectQuery(entry.query)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectQuery(entry.query)
                  }
                }}
                role="button"
                tabIndex={isOpen ? 0 : -1}
              >
                <div className="history-item-header">
                  <span className="history-tool">{getToolIcon(entry.tool)}</span>
                  <span className="history-time">{formatTime(entry.timestamp)}</span>
                </div>
                <div className="history-query">{entry.query}</div>
                {entry.result && <AnswerPreview result={entry.result} />}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
