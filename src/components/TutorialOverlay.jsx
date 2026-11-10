import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const SEEN_KEY = 'observatory_tour_v2_seen'

// Each step points at a real element; `fallback` is tried when the first
// target is hidden (for example the nav links inside the mobile menu).
const STEPS = [
  {
    target: '.obs-stage',
    title: 'This is the agent',
    body: 'Each glowing node is one step it takes. Arrows show the order: understand, plan, check memory, use a tool, write, fact-check, answer.',
  },
  {
    target: '.run-form input',
    title: 'Ask it something',
    body: 'Type a question or tap an example. The step that is running lights up, and the panel explains it in plain words.',
  },
  {
    target: '.inject-select',
    title: 'Break it on purpose',
    body: 'Plant a failure, such as a fake fact or an empty search, and watch whether the fact-check notices and the agent retries.',
  },
  {
    target: '.site-header .sh-nav a[href="/traces"]',
    fallback: '.site-header .sh-burger',
    title: 'Every run is recorded',
    body: 'Traces shows each step of every run with its timings and errors. Evaluations shows the measured test results.',
  },
]

function findTarget(step) {
  for (const selector of [step.target, step.fallback].filter(Boolean)) {
    const el = document.querySelector(selector)
    if (el && el.getClientRects().length) return el
  }
  return null
}

export default function TutorialOverlay({ suppressed = false, replayKey = 0 }) {
  const [step, setStep] = useState(0)
  const [show, setShow] = useState(false)
  const [rect, setRect] = useState(null)
  const nextRef = useRef(null)

  useEffect(() => {
    if (suppressed || localStorage.getItem(SEEN_KEY)) return
    const timer = setTimeout(() => setShow(true), 900)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!replayKey) return
    setStep(0)
    setShow(true)
  }, [replayKey])

  const close = useCallback(() => {
    localStorage.setItem(SEEN_KEY, '1')
    setShow(false)
  }, [])

  const measure = useCallback(() => {
    const el = findTarget(STEPS[step])
    if (!el) return setRect(null)
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [step])

  useLayoutEffect(() => {
    if (!show) return
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [show, measure])

  useEffect(() => {
    if (show) nextRef.current?.focus()
  }, [show, step])

  if (!show) return null

  const last = step === STEPS.length - 1
  const next = () => (last ? close() : setStep(step + 1))
  const current = STEPS[step]

  const pad = 8
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardWidth = Math.min(340, vw - 24)
  let cardStyle = { width: cardWidth, left: (vw - cardWidth) / 2, top: vh / 2 - 90 }
  if (rect) {
    const below = rect.top + rect.height + pad + 12
    const fitsBelow = below + 190 < vh
    const big = rect.height > vh * 0.5
    const top = big ? rect.top + rect.height / 2 - 90 : fitsBelow ? below : Math.max(12, rect.top - pad - 12 - 190)
    const left = Math.min(vw - cardWidth - 12, Math.max(12, rect.left + rect.width / 2 - cardWidth / 2))
    cardStyle = { width: cardWidth, left, top }
  }

  return (
    <div
      className={`tour${rect ? '' : ' no-spot'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          close()
        }
        if (event.key === 'ArrowRight') next()
        if (event.key === 'ArrowLeft' && step > 0) setStep(step - 1)
      }}
    >
      <div className="tour-backdrop" onClick={close} />
      {rect && (
        <div
          className="tour-spot"
          aria-hidden="true"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      )}
      <div className="tour-card" style={cardStyle}>
        <span className="tour-count">
          {step + 1} / {STEPS.length}
        </span>
        <h2 id="tour-title">{current.title}</h2>
        <p>{current.body}</p>
        <div className="tour-actions">
          <button type="button" className="btn-ghost" onClick={close}>
            Skip tour
          </button>
          {step > 0 && (
            <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button type="button" className="btn-primary" ref={nextRef} onClick={next}>
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
