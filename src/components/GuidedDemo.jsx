import { useEffect, useRef, useState } from 'react'
import { DEMOS } from '../data/demos.js'

// Which narration step is live, derived only from what the run has really done.
function progressOf(exec, finished) {
  const retried = exec.feedbackCount > 0 || exec.replans.length > 0
  if (finished) return { step: 4, retried }
  if (retried) return { step: 3, retried }
  if (exec.activeNodeId === 'verifier' || exec.activeNodeId === 'response') return { step: 2, retried }
  return { step: 1, retried }
}

function DemoPicker({ onPick, onClose }) {
  return (
    <div className="guided-demo">
      <div className="guided-head">
        <span>BREAK IT YOURSELF</span>
        <button type="button" onClick={onClose} aria-label="Close demo">×</button>
      </div>
      <p className="guided-intro">Pick a failure. We plant it on purpose, and you watch whether the agent notices and recovers.</p>
      <div className="guided-picks">
        {DEMOS.map((demo) => (
          <button key={demo.id} type="button" onClick={() => onPick(demo.id)}>
            <span>{demo.icon}</span>
            <b>{demo.title}</b>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function GuidedDemo({ demo, exec, onPick, onClose, onInspect }) {
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const sawRunning = useRef(false)

  useEffect(() => {
    setStarted(false)
    setFinished(false)
    sawRunning.current = false
  }, [demo?.id])

  useEffect(() => {
    if (!started) return
    if (exec.running) sawRunning.current = true
    else if (sawRunning.current) setFinished(true)
  }, [started, exec.running])

  if (!demo) return <DemoPicker onPick={onPick} onClose={onClose} />

  const start = () => {
    setFinished(false)
    sawRunning.current = false
    setStarted(true)
    exec.run(demo.query, { inject: demo.id })
  }

  const { step, retried } = progressOf(exec, finished)
  const fixed = finished && !exec.error && demo.fixed(exec.response)
  const steps = [
    ['Ask the question', `“${demo.query}”`],
    ['Plant the failure', demo.plant],
    ['Watch the check', demo.watch],
    [
      retried ? 'Problem caught, retrying' : 'Retry if needed',
      retried
        ? 'The agent went back to the planner. The red arrow in the 3D view is this retry.'
        : 'If the check fails, the agent goes back to the planner and searches again.',
    ],
  ]

  return (
    <div className="guided-demo">
      <div className="guided-head">
        <span>
          {demo.icon} DEMO · {demo.title.toUpperCase()}
        </span>
        <button type="button" onClick={onClose} aria-label="Close demo">×</button>
      </div>

      <ol className="guided-steps">
        {steps.map(([title, text], index) => {
          let state = !started ? 'todo' : index < step ? 'done' : index === step ? 'live' : 'todo'
          if (finished && index === 3 && !retried) state = 'skipped'
          return (
            <li key={title} className={state}>
              <b>{title}</b>
              <span>{text}</span>
            </li>
          )
        })}
      </ol>

      {!started && (
        <button type="button" className="guided-start" onClick={start} disabled={exec.running}>
          Start demo
        </button>
      )}

      {started && !finished && <div className="guided-live">{exec.label || 'Running…'}</div>}

      {finished && (
        <div className={`guided-result ${fixed ? 'ok' : 'bad'}`}>
          {exec.error ? (
            <>
              <b>The run did not finish.</b>
              <span>{exec.error}</span>
            </>
          ) : fixed ? (
            <>
              <b>{retried ? 'Caught and fixed ✓' : 'Answered correctly ✓'}</b>
              <span>
                {demo.fixedText}
                {retried ? '' : ' It got there without needing a retry this time.'}
              </span>
            </>
          ) : (
            <>
              <b>Not fixed this time</b>
              <span>
                {retried
                  ? 'The agent noticed the problem and retried, but the final answer still looks wrong.'
                  : 'The agent did not notice the problem on this run.'}{' '}
                AI runs vary. Open the run to see exactly where it went wrong.
              </span>
            </>
          )}
          <div className="guided-actions">
            <button type="button" onClick={onInspect}>See every step</button>
            <button type="button" onClick={start} disabled={exec.running}>Run again</button>
            <button type="button" onClick={() => onPick(null)}>Try another failure</button>
          </div>
        </div>
      )}
    </div>
  )
}
