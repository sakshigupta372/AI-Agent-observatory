import { useState } from 'react'
import { EXAMPLE_PROMPTS } from '../data/scenarios.js'

export default function RunConsole({ running, label, onRun }) {
  const [query, setQuery] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const q = query.trim()
    if (!q || running) return
    onRun(q)
  }

  return (
    <div className="run-console">
      {running && (
        <div className="status-line">
          <span className="status-dot" />
          {label}
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
        <button type="submit" disabled={running || !query.trim()}>
          {running ? 'Running...' : 'Run Agent'}
        </button>
      </form>

      <div className="example-chips">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            disabled={running}
            onClick={() => onRun(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
