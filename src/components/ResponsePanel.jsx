import { useEffect, useState } from 'react'
import { parseAnswer } from '../data/parseAnswer.js'

function verdictFor(point, verdicts) {
  return verdicts.find((verdict) => verdict.text === point || verdict.text.includes(point) || point.includes(verdict.text))
}

export default function ResponsePanel({ response, error, sources = [], asOf, verdicts = [], embedded = false }) {
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    setClosed(false)
  }, [response, error, asOf])

  if ((!response && !error) || closed) return null

  const answer = response ? parseAnswer(response) : null
  const checked = asOf ? new Date(asOf).toLocaleString() : null

  return (
    <div className={`response-card${error && !response ? ' error' : ''}${embedded ? ' embedded' : ''}`}>
      {!embedded && (
        <button className="response-close" onClick={() => setClosed(true)} aria-label="Dismiss response">
          ×
        </button>
      )}
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
