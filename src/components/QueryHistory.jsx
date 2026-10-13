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

export default function QueryHistory({ history, isOpen, onToggle, onClear, onSelectQuery, currentQuery }) {
  const handleClear = () => {
    if (confirm('Clear all query history?')) onClear()
  }

  return (
    <>
      <button
        type="button"
        className="history-toggle"
        onClick={onToggle}
        aria-label="Toggle query history"
        title="Query History (H)"
      >
        {isOpen ? '✕' : '📜'}
        <span className="history-count">{history.length}</span>
      </button>

      <div className={`query-history ${isOpen ? 'open' : ''}`}>
        <div className="history-header">
          <h3>Query History</h3>
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
              >
                <div className="history-item-header">
                  <span className="history-tool">{getToolIcon(entry.tool)}</span>
                  <span className="history-time">{formatTime(entry.timestamp)}</span>
                </div>
                <div className="history-query">{entry.query}</div>
                {entry.result && <div className="history-result">{entry.result}...</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
