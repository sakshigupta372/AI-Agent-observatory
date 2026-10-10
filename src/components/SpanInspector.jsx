import TraceView from './TraceView.jsx'

// Slide-over panel that opens on top of the 3D scene with the run's full trace.
export default function SpanInspector({ trace, onClose }) {
  if (!trace) return null
  return (
    <div className="inspector">
      <div className="inspector-head">
        <div>
          <span className="inspector-kicker">RUN INSPECTOR</span>
          <p>{trace.query}</p>
        </div>
        <div className="inspector-actions">
          {trace.persisted && (
            <a href={`/traces?id=${trace.id}`} target="_blank" rel="noreferrer">
              Open in Traces
            </a>
          )}
          <button type="button" onClick={onClose} aria-label="Close inspector">
            ×
          </button>
        </div>
      </div>
      <div className="inspector-body">
        <TraceView trace={trace} />
      </div>
    </div>
  )
}
