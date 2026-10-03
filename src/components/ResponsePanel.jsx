import { useEffect, useState } from 'react'

// Small dismissible card for the final agent answer. Re-appears
// automatically whenever a new response arrives, even if the previous one
// was closed, so it never permanently hides output on later runs.
export default function ResponsePanel({ response }) {
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    setClosed(false)
  }, [response])

  if (!response || closed) return null

  return (
    <div className="response-card">
      <button className="response-close" onClick={() => setClosed(true)} aria-label="Dismiss response">
        ×
      </button>
      <span className="response-label">RESPONSE</span>
      <p>{response}</p>
    </div>
  )
}
