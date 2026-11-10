import { useEffect, useState } from 'react'
import SuccessBars, { latestByConfig } from './SuccessBars.jsx'
import { DEMOS } from '../data/demos.js'
import '../styles/landing.css'

const PHASES = [
  { active: ['plan', 'search'], edge: 'plan-search', caption: 'The agent plans, then searches the web.' },
  { active: ['check'], edge: 'search-check', caption: 'A fake fact slips into the draft answer.', fake: true },
  { active: ['check', 'plan'], edge: 'loop', caption: 'The fact-checker catches it and sends it back to the planner.', fake: true },
  { active: ['search', 'check', 'answer'], edge: 'check-answer', caption: 'Better search, new answer. Fake fact gone.', fixed: true },
]

function LoopDiagram() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 2400)
    return () => clearInterval(timer)
  }, [])
  const current = PHASES[phase]
  const on = (id) => (current.active.includes(id) ? ' on' : '')
  const edge = (id) => (current.edge === id ? ' on' : '')

  const nodes = [
    ['plan', 'Plan', 70],
    ['search', 'Search', 220],
    ['check', 'Fact-check', 370],
    ['answer', 'Answer', 520],
  ]

  return (
    <div className="loop">
      <svg viewBox="0 0 590 220" role="img" aria-label="Plan, search, fact-check, answer, with a retry loop from fact-check back to plan">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="arrow-head" />
          </marker>
          <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="arrow-head red" />
          </marker>
        </defs>
        <line x1="112" y1="140" x2="176" y2="140" className={`edge${edge('plan-search')}`} markerEnd="url(#arrow)" />
        <line x1="262" y1="140" x2="318" y2="140" className={`edge${edge('search-check')}`} markerEnd="url(#arrow)" />
        <line x1="422" y1="140" x2="476" y2="140" className={`edge${edge('check-answer')}`} markerEnd="url(#arrow)" />
        <path d="M370 112 C 340 30, 100 30, 72 110" className={`edge loop-edge${edge('loop')}`} markerEnd="url(#arrow-red)" />
        <text x="221" y="44" className={`loop-label${edge('loop')}`}>retry with a better search</text>
        {nodes.map(([id, label, x]) => (
          <g key={id} className={`node${on(id)}${id === 'check' && current.fake ? ' alert' : ''}${id === 'answer' && current.fixed ? ' fixed' : ''}`}>
            <rect x={x - 46} y="116" width="92" height="48" rx="14" />
            <text x={x} y="145">{label}</text>
          </g>
        ))}
        {current.fake && phase === 1 && (
          <g className="fake-chip">
            <rect x="318" y="176" width="104" height="26" rx="13" />
            <text x="370" y="193">fake fact</text>
          </g>
        )}
        {current.fixed && (
          <g className="fixed-chip">
            <rect x="472" y="176" width="96" height="26" rx="13" />
            <text x="520" y="193">fixed ✓</text>
          </g>
        )}
      </svg>
      <div className="loop-caption" key={phase}>
        <span>{phase + 1}/4</span> {current.caption}
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

export default function LandingPage() {
  const { runs, totals } = useLiveNumbers()
  const replan = runs ? latestByConfig(runs).find((row) => row.item.id === 'replan')?.run : null
  const baseline = runs ? latestByConfig(runs).find((row) => row.item.id === 'baseline')?.run : null
  const rate = (run) => (run && run.tasks ? Math.round((run.passed / run.tasks) * 100) : null)

  return (
    <div className="landing">
      <header className="landing-nav">
        <a href="/" className="brand">AI AGENT OBSERVATORY</a>
        <nav>
          <a href="/observatory">Observatory</a>
          <a href="/traces">Traces</a>
          <a href="/evals">Evaluations</a>
          <a href="https://github.com/sakshigupta372/AI-Agent-observatory" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-text">
          <span className="kicker">Open the black box of an AI agent</span>
          <h1>
            See why an AI agent got it wrong, <em>and watch it fix itself.</em>
          </h1>
          <p>
            Ask a question and follow the agent step by step: what it planned, what it searched, which claims it could
            prove, and when it went back to try again. Every run is recorded and measured.
          </p>
          <div className="cta-row">
            <a className="cta primary" href="/observatory?demo=hallucinated_claim">Watch it fix a mistake</a>
            <a className="cta" href="/observatory">Ask your own question</a>
          </div>
        </div>
        <LoopDiagram />
      </section>

      <section className="proof">
        <div className="proof-item">
          <b>{baseline && replan ? `${rate(baseline)}% → ${rate(replan)}%` : '—'}</b>
          <span>correct answers on the test set, without vs with fact-checking + retry</span>
        </div>
        <div className="proof-item">
          <b>{replan && replan.injected ? `${replan.recoveredByReplan} of ${replan.injected}` : '—'}</b>
          <span>planted failures fixed by retrying with a better search</span>
        </div>
        <div className="proof-item">
          <b>{totals ? totals.claims.toLocaleString('en-US') : '—'}</b>
          <span>claims checked against sources across {totals ? totals.runs.toLocaleString('en-US') : '—'} recorded runs</span>
        </div>
      </section>

      <section className="steps">
        <h2>How it works</h2>
        <div className="step-grid">
          {[
            ['1', 'Plan', 'Reads your question and picks a tool: web search, calculator, customer database or text analysis.'],
            ['2', 'Search', 'Runs the tool and pulls in related answers from earlier runs (its memory).'],
            ['3', 'Fact-check', 'Writes an answer, then checks every claim against the pages it found.'],
            ['4', 'Retry', 'If a claim can’t be backed up, or the search failed, it tries again with a better search.'],
          ].map(([n, title, text]) => (
            <div key={n} className="step">
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="break">
        <h2>Break it yourself</h2>
        <p className="section-sub">Pick a failure. We plant it on purpose, and you watch whether the agent notices and recovers.</p>
        <div className="break-grid">
          {DEMOS.map((demo) => (
            <a key={demo.id} className="break-card" href={`/observatory?demo=${demo.id}`}>
              <span className="icon">{demo.icon}</span>
              <h3>{demo.title}</h3>
              <p>{demo.plant}</p>
              <span className="go">Run this demo →</span>
            </a>
          ))}
        </div>
      </section>

      <section className="results">
        <div>
          <h2>Measured, not claimed</h2>
          <p className="section-sub">
            The same {replan?.tasks || 25} test questions, run three ways. Success means the right tool was used and the answer
            contained the expected facts and none of the planted false ones.
          </p>
          <a className="text-link" href="/evals">See every question and result →</a>
        </div>
        {runs && runs.length > 0 ? <SuccessBars runs={runs} /> : <div className="muted-box">Results load from the live evaluation data.</div>}
      </section>

      <section className="inspect">
        <h2>Look inside any run</h2>
        <div className="inspect-grid">
          <a href="/observatory">
            <h3>Observatory</h3>
            <p>A 3D map of the agent. Each step lights up as it runs, and the red arrow appears only when a retry really happens.</p>
          </a>
          <a href="/traces">
            <h3>Traces</h3>
            <p>Every step of your runs with its input, output, time taken and errors, in plain words and in full detail.</p>
          </a>
          <a href="/evals">
            <h3>Evaluations</h3>
            <p>Test results with and without fact-checking, plus how fast memory search stays as data grows.</p>
          </a>
        </div>
      </section>

      <section className="honest">
        <h2>What the numbers mean</h2>
        <p>
          The test set is small (25 questions written for this project) and is graded by checking for expected facts, not by
          judging writing quality. AI answers and web results change, so results vary between runs. The fact-checker is itself
          an AI and can be wrong; when it is unavailable, a simpler word-matching check is used and the trace says so.
        </p>
      </section>

      <footer className="landing-footer">
        <span>Built by Sakshi Gupta</span>
        <a href="https://github.com/sakshigupta372/AI-Agent-observatory" target="_blank" rel="noreferrer">Source on GitHub</a>
      </footer>
    </div>
  )
}
