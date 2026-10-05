import { useEffect, useState } from 'react'

function parseAnswer(text) {
  const lines = String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const bullets = []
  const prose = []

  for (const line of lines) {
    const match = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)/)
    if (match) bullets.push(match[1])
    else prose.push(line)
  }

  if (bullets.length === 0 && prose.length === 1) {
    const sentences = prose[0].split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 20)
    if (sentences.length > 1) {
      return { headline: sentences[0], bullets: sentences.slice(1) }
    }
  }

  return { headline: prose.join(' '), bullets }
}

function verdictFor(point, verdicts) {
  return verdicts.find((verdict) => verdict.text === point || verdict.text.includes(point) || point.includes(verdict.text))
}

export default function ResponsePanel({ response, error, sources = [], asOf, verdicts = [] }) {
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    setClosed(false)
  }, [response, error, asOf])

  if ((!response && !error) || closed) return null

  const answer = response ? parseAnswer(response) : null
  const checked = asOf ? new Date(asOf).toLocaleString() : null

  return (
    <div className={`response-card${error && !response ? ' error' : ''}`}>
      <button className="response-close" onClick={() => setClosed(true)} aria-label="Dismiss response">
        ×
      </button>
      <span className="response-label">{error && !response ? 'COULD NOT ANSWER' : 'RESPONSE'}</span>
      {answer?.headline && <p className="response-headline">{answer.headline}</p>}
      {answer?.bullets.length > 0 && (
        <ul className="response-points">
          {answer.bullets.map((point) => {
            const verdict = verdictFor(point, verdicts)
            const mark = verdict ? (verdict.supported ? 'ok' : 'bad') : ''
            return (
              <li key={point} className={mark} title={verdict?.note || ''}>
                {point}
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="response-error">{error}</p>}
      {checked && <p className="response-asof">Sources checked {checked}</p>}
      {sources.length > 0 && (
        <>
          <span className="source-label">Sources</span>
          <ul className="source-list">
            {sources.map((source) => (
              <li key={source.url || source.title}>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                ) : (
                  <span>{source.title}</span>
                )}
                <em className={source.publishedDate ? '' : 'undated'}>
                  {source.publishedDate
                    ? `${new Date(source.publishedDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}${source.dateFrom ? ` · from ${source.dateFrom}` : ''}`
                    : 'No date published on this page'}
                </em>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
