import { useEffect, useRef, useState } from 'react'
import SuccessBars, { latestByConfig } from './SuccessBars.jsx'
import { DEMOS } from '../data/demos.js'
import '../styles/landing.css'

const REPO = 'https://github.com/sakshigupta372/AI-Agent-observatory'
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Drifting points joined by faint lines; they lean towards the cursor.
function Constellation() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const mouse = { x: -9999, y: -9999 }
    let points = []
    let frame = 0
    let width = 0
    let height = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round(Math.min(90, (width * height) / 16000))
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        hue: Math.random() < 0.5 ? '167, 139, 250' : Math.random() < 0.6 ? '34, 211, 238' : '244, 114, 182',
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      for (const p of points) {
        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const d = Math.hypot(dx, dy)
        if (d < 180) {
          p.x += dx * 0.004
          p.y += dy * 0.004
        }
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > width) p.vx *= -1
        if (p.y < 0 || p.y > height) p.vy *= -1
      }
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i]
          const b = points[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < 130) {
            ctx.strokeStyle = `rgba(${a.hue}, ${0.16 * (1 - d / 130)})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
      for (const p of points) {
        ctx.fillStyle = `rgba(${p.hue}, 0.75)`
        ctx.beginPath()
        ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const loop = () => {
      draw()
      frame = requestAnimationFrame(loop)
    }
    const onMove = (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }

    resize()
    if (reducedMotion()) draw()
    else loop()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])
  return <canvas ref={ref} className="constellation" aria-hidden="true" />
}

// Adds `.in` to every [data-reveal] element once it scrolls into view.
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            io.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.18 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

function CountUp({ value, suffix = '', duration = 1400 }) {
  const [shown, setShown] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    if (value == null) return
    if (reducedMotion()) return setShown(value)
    let raf = 0
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration)
        setShown(Math.round(value * (1 - (1 - t) ** 3)))
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })
    io.observe(ref.current)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [value, duration])
  return (
    <span ref={ref}>
      {value == null ? '—' : `${shown.toLocaleString('en-US')}${suffix}`}
    </span>
  )
}

const PHASES = [
  { caption: 'Plans the question, then searches the web', packet: 'M75 150 L225 150', active: ['plan', 'search'], edge: 'plan-search' },
  { caption: 'Writes a draft. A fake fact slips in', packet: 'M225 150 L375 150', active: ['check'], edge: 'search-check', alert: true },
  { caption: 'Fact-checker catches it and sends it back', packet: 'M375 124 C 345 26, 105 26, 75 124', active: ['check', 'plan'], edge: 'loop', alert: true, red: true },
  { caption: 'Searches again. Fake fact gone', packet: 'M225 150 L525 150', active: ['search', 'check', 'answer'], edge: 'check-answer', fixed: true },
]

const DRAFT = [
  { id: 'a', text: 'pgvector adds a vector column type to Postgres.' },
  { id: 'b', text: 'It supports fast similarity search with HNSW indexes.' },
]

function DraftPanel({ phase }) {
  if (phase === 0) {
    return (
      <div className="draft">
        <div className="draft-title">Searching the web…</div>
        {['github.com/pgvector', 'postgresql.org', 'neon.tech/docs'].map((src, i) => (
          <div key={src} className="draft-source" style={{ animationDelay: `${i * 0.25}s` }}>
            <i /> {src}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="draft">
      <div className="draft-title">{phase === 3 ? 'Final answer' : 'Draft answer'}</div>
      {DRAFT.map((line) => (
        <div key={line.id} className="draft-line ok">
          <b>✓</b> {line.text}
        </div>
      ))}
      {phase < 3 ? (
        <div className={`draft-line fake${phase === 2 ? ' struck' : ''}`}>
          <b>{phase === 2 ? '✗' : '?'}</b> It was invented by Napoleon for Atlantis Holdings.
          {phase === 2 && <em>not in any source → retry</em>}
        </div>
      ) : (
        <div className="draft-line ok fresh">
          <b>✓</b> It runs on Neon, Supabase and Amazon RDS.
        </div>
      )}
    </div>
  )
}

function LoopShowcase() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 2800)
    return () => clearInterval(timer)
  }, [])
  const current = PHASES[phase]
  const on = (id) => (current.active.includes(id) ? ' on' : '')
  const edge = (id) => (current.edge === id ? ' on' : '')
  const nodes = [
    ['plan', 'Plan', 75],
    ['search', 'Search', 225],
    ['check', 'Fact-check', 375],
    ['answer', 'Answer', 525],
  ]

  return (
    <div className="showcase" data-reveal>
      <div className="showcase-bar">
        <span className="dots"><i /><i /><i /></span>
        <span className="showcase-q">“What is pgvector?”</span>
        <span className="live-pill"><i /> live replay</span>
      </div>
      <div className="showcase-body">
        <svg viewBox="0 0 600 230" className="loop-svg" role="img" aria-label="Plan, search, fact-check and answer, with a retry loop from fact-check back to plan">
          <defs>
            <linearGradient id="edgeGrad" x1="0" x2="1">
              <stop offset="0" stopColor="#a78bfa" />
              <stop offset="1" stopColor="#22d3ee" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path d="M127 150 L173 150" className={`edge${edge('plan-search')}`} />
          <path d="M277 150 L323 150" className={`edge${edge('search-check')}`} />
          <path d="M427 150 L473 150" className={`edge${edge('check-answer')}`} />
          <path d="M375 124 C 345 26, 105 26, 75 124" className={`edge loop-edge${edge('loop')}`} />
          <text x="225" y="40" className={`loop-label${edge('loop')}`}>↺ retry with a better search</text>

          <circle key={phase} r="6" className={`packet${current.red ? ' red' : ''}`} filter="url(#glow)">
            <animateMotion dur="1.4s" repeatCount="indefinite" path={current.packet} />
          </circle>

          {nodes.map(([id, label, x]) => (
            <g
              key={id}
              className={`node${on(id)}${id === 'check' && current.alert ? ' alert' : ''}${id === 'answer' && current.fixed ? ' fixed' : ''}`}
            >
              <rect x={x - 52} y="124" width="104" height="52" rx="16" />
              <text x={x} y="155">{label}</text>
            </g>
          ))}
        </svg>
        <DraftPanel phase={phase} />
      </div>
      <div className="showcase-foot">
        <div className="phase-dots">
          {PHASES.map((p, i) => (
            <span key={p.caption} className={i === phase ? 'on' : i < phase ? 'done' : ''} />
          ))}
        </div>
        <span className="caption" key={phase}>
          <b>{phase + 1}/4</b> {current.caption}
        </span>
      </div>
    </div>
  )
}

function useLiveNumbers() {
  const [runs, setRuns] = useState(null)
  const [totals, setTotals] = useState(null)
  useEffect(() => {
    fetch('/api/evals')
      .then((res) => res.json())
      .then((data) => setRuns(data.runs || []))
      .catch(() => setRuns([]))
    fetch('/api/traces?view=analytics')
      .then((res) => res.json())
      .then((data) => setTotals(data.analytics?.totals || null))
      .catch(() => {})
  }, [])
  return { runs, totals }
}

// Moves the radial highlight on .spot cards to follow the cursor.
function trackSpot(e) {
  const card = e.target.closest?.('.spot')
  if (!card) return
  const box = card.getBoundingClientRect()
  card.style.setProperty('--mx', `${e.clientX - box.left}px`)
  card.style.setProperty('--my', `${e.clientY - box.top}px`)
}

const STACK = ['Groq · gpt-oss-120b', 'Tavily web search', 'Neon Postgres', 'pgvector · HNSW', 'MiniLM embeddings', 'React Three Fiber', 'Astro SSR', 'Server-sent events']

export default function LandingPage() {
  const { runs, totals } = useLiveNumbers()
  useReveal()
  const latest = runs ? latestByConfig(runs) : []
  const replan = latest.find((row) => row.item.id === 'replan')?.run
  const baseline = latest.find((row) => row.item.id === 'baseline')?.run
  const rate = (run) => (run && run.tasks ? Math.round((run.passed / run.tasks) * 100) : null)

  return (
    <div className="landing" onPointerMove={trackSpot}>
      <div className="aurora" aria-hidden="true">
        <span className="a1" />
        <span className="a2" />
        <span className="a3" />
      </div>
      <div className="grid-floor" aria-hidden="true" />
      <Constellation />

      <header className="landing-nav">
        <a href="/" className="brand">
          <span className="brand-mark" /> Agent Observatory
        </a>
        <nav>
          <a href="/observatory">Observatory</a>
          <a href="/traces">Traces</a>
          <a href="/evals">Evaluations</a>
          <a href={REPO} target="_blank" rel="noreferrer" className="nav-gh">GitHub ↗</a>
        </nav>
      </header>

      <section className="hero">
        <a className="kicker" href="/traces">
          <i /> {totals ? `${totals.runs.toLocaleString('en-US')} runs recorded so far` : 'Every run is recorded'} <span>→</span>
        </a>
        <h1>
          See why an AI agent <span className="grad">got it wrong</span>
          <br />
          and watch it <span className="grad alt">fix itself.</span>
        </h1>
        <p>
          Follow the agent step by step: what it planned, what it searched, which claims it could prove, and the moment it
          went back to try again.
        </p>
        <div className="cta-row">
          <a className="cta primary" href="/observatory?demo=hallucinated_claim">
            <span>▶ Watch it fix a mistake</span>
          </a>
          <a className="cta ghost" href="/observatory">Ask your own question</a>
        </div>
        <LoopShowcase />
      </section>

      <div className="marquee" aria-label="Built with">
        <div className="marquee-track">
          {[...STACK, ...STACK].map((item, i) => (
            <span key={i}>{item}</span>
          ))}
        </div>
      </div>

      <section className="proof">
        <div className="proof-item spot" data-reveal>
          <b>
            <CountUp value={rate(baseline)} suffix="%" /> <small>→</small> <span className="grad"><CountUp value={rate(replan)} suffix="%" /></span>
          </b>
          <span>correct answers on the test set, without vs with fact-checking and retry</span>
        </div>
        <div className="proof-item spot" data-reveal style={{ transitionDelay: '0.1s' }}>
          <b>
            <CountUp value={replan?.injected ? replan.recoveredByReplan : null} /> <small>of {replan?.injected ?? '—'}</small>
          </b>
          <span>planted failures fixed by going back and searching again</span>
        </div>
        <div className="proof-item spot" data-reveal style={{ transitionDelay: '0.2s' }}>
          <b>
            <CountUp value={totals?.claims ?? null} />
          </b>
          <span>claims checked against their sources, one by one</span>
        </div>
      </section>

      <section className="steps">
        <div className="section-head" data-reveal>
          <span className="eyebrow">How it works</span>
          <h2>Four steps, and one way back</h2>
        </div>
        <div className="step-grid">
          <div className="step-line" aria-hidden="true"><span /></div>
          {[
            ['01', 'Plan', 'Reads your question and picks a tool: web search, calculator, customer database or text analysis.'],
            ['02', 'Search', 'Runs the tool and pulls in related answers from earlier runs, its memory.'],
            ['03', 'Fact-check', 'Writes an answer, then checks every claim against the pages it found.'],
            ['04', 'Retry', 'If a claim can’t be backed up, or the search failed, it goes back and tries a better search.'],
          ].map(([n, title, text], i) => (
            <div key={n} className={`step spot${i === 3 ? ' retry' : ''}`} data-reveal style={{ transitionDelay: `${i * 0.1}s` }}>
              <span className="step-n">{n}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="break">
        <div className="section-head" data-reveal>
          <span className="eyebrow red">Break it yourself</span>
          <h2>Plant a failure. See if it notices.</h2>
          <p className="section-sub">Each demo runs a real question with one thing broken on purpose. Sometimes it recovers, sometimes it doesn’t, and you see which.</p>
        </div>
        <div className="break-grid">
          {DEMOS.map((demo, i) => (
            <a key={demo.id} className="break-card spot" href={`/observatory?demo=${demo.id}`} data-reveal style={{ transitionDelay: `${i * 0.08}s` }}>
              <span className="icon">{demo.icon}</span>
              <h3>{demo.title}</h3>
              <p>{demo.plant}</p>
              <span className="go">Run this demo <i>→</i></span>
            </a>
          ))}
        </div>
      </section>

      <section className="results" data-reveal>
        <div>
          <span className="eyebrow">Measured, not claimed</span>
          <h2>Does fact-checking actually help?</h2>
          <p className="section-sub">
            The same {replan?.tasks || 25} test questions, run three ways. A question counts as correct when the right tool was
            used and the answer has the expected facts and none of the planted false ones.
          </p>
          <a className="text-link" href="/evals">See every question and result →</a>
        </div>
        <div className="results-card spot">
          {runs && runs.length > 0 ? <SuccessBars runs={runs} /> : <div className="muted-box">Loading live evaluation data…</div>}
        </div>
      </section>

      <section className="inspect">
        <div className="section-head" data-reveal>
          <span className="eyebrow">Look inside</span>
          <h2>Three ways to see a run</h2>
        </div>
        <div className="inspect-grid">
          {[
            ['/observatory', '🪐', 'Observatory', 'A 3D map of the agent. Each step lights up as it runs, and the red arrow appears only when a retry really happens.'],
            ['/traces', '🧾', 'Traces', 'Every step of your runs with its input, output, time taken and errors, in plain words and in full detail.'],
            ['/evals', '📊', 'Evaluations', 'Test results with and without fact-checking, plus how fast memory search stays as data grows.'],
          ].map(([href, icon, title, text], i) => (
            <a key={href} href={href} className="spot" data-reveal style={{ transitionDelay: `${i * 0.1}s` }}>
              <span className="icon">{icon}</span>
              <h3>{title} <i>→</i></h3>
              <p>{text}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="honest" data-reveal>
        <h2>What the numbers mean</h2>
        <p>
          The test set is small (25 questions written for this project) and is graded by checking for expected facts, not by
          judging writing quality. AI answers and web results change, so results vary between runs. The fact-checker is itself
          an AI and can be wrong; when it is unavailable, a simpler word-matching check is used and the trace says so.
        </p>
      </section>

      <section className="final-cta" data-reveal>
        <h2>
          Go break an agent. <span className="grad">Then watch it recover.</span>
        </h2>
        <a className="cta primary" href="/observatory?demo">
          <span>Start a demo</span>
        </a>
      </section>

      <footer className="landing-footer">
        <span>Built by Sakshi Gupta</span>
        <a href={REPO} target="_blank" rel="noreferrer">Source on GitHub ↗</a>
      </footer>
    </div>
  )
}
