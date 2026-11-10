import { useEffect, useRef, useState } from 'react'
import SuccessBars, { latestByConfig } from './SuccessBars.jsx'
import SiteHeader from './SiteHeader.jsx'
import SiteFooter from './SiteFooter.jsx'
import { useLiveTotals } from '../hooks/useLiveTotals.js'
import { DEMOS } from '../data/demos.js'
import { formatMs } from './TraceView.jsx'
import '../styles/landing.css'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const pad = (n) => String(n).padStart(2, '0')

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
      { threshold: 0.15 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

function CountUp({ value, suffix = '', duration = 1600 }) {
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
        setShown(Math.round(value * (1 - (1 - t) ** 4)))
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
  return <span ref={ref}>{value == null ? '—' : `${shown.toLocaleString('en-US')}${suffix}`}</span>
}

function useLiveNumbers() {
  const [runs, setRuns] = useState(null)
  const { totals } = useLiveTotals()
  useEffect(() => {
    fetch('/api/evals')
      .then((res) => res.json())
      .then((data) => setRuns(data.runs || []))
      .catch(() => setRuns([]))
  }, [])
  return { runs, totals }
}

function useCycle(length, ms) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % length), ms)
    return () => clearInterval(timer)
  }, [length, ms, paused])
  return [index, setIndex, setPaused]
}

// The shape of a run with one retry, as the Observatory shows it. Illustrative,
// so it is labelled "Example run"; every number on the page below it is live.
const EXAMPLE_RUN = [
  ['Plan', 'Pick a tool for: “Search the web for the latest AI news”', 'ok', 'OK'],
  ['Memory lookup', 'Check what the agent already knows', 'ok', 'OK'],
  ['Web search', 'Read the top results', 'ok', 'OK'],
  ['Fact-check', 'Claim not supported by the source it cited', 'failed', 'FAILED'],
  ['Retry plan', 'Search again with a narrower query', 'retry', 'RETRY'],
  ['Web search', 'Read the new results', 'ok', 'OK'],
  ['Fact-check', 'Every claim matches its source', 'passed', 'PASSED'],
  ['Write answer', 'Final answer with citations', 'done', 'DONE'],
]

function ExampleRun() {
  const retries = EXAMPLE_RUN.filter(([, , kind]) => kind === 'retry').length
  return (
    <figure className="example-run" aria-label="Example run, step by step">
      <figcaption>
        <span>Example run</span>
        <span>{EXAMPLE_RUN.length} steps · {retries} {retries === 1 ? 'retry' : 'retries'}</span>
      </figcaption>
      <ol>
        {EXAMPLE_RUN.map(([name, text, kind, label], i) => (
          <li key={i} className={kind} style={{ animationDelay: `${0.25 + i * 0.07}s` }}>
            <span className="n">{pad(i + 1)}</span>
            <b>{name}</b>
            <span className="t">{text}</span>
            <span className="s">{label}</span>
          </li>
        ))}
      </ol>
    </figure>
  )
}

const STORY = [
  {
    title: 'The agent searches',
    what: 'Plan & search',
    detail: 'It picks web search and reads three pages about pgvector.',
    lines: [
      ['src', 'github.com/pgvector'],
      ['src', 'postgresql.org'],
      ['src', 'neon.tech/docs'],
    ],
  },
  {
    title: 'A fake fact slips in',
    what: 'Draft answer',
    detail: 'We planted one false sentence in the first draft, on purpose.',
    lines: [
      ['ok', 'pgvector adds a vector column type to Postgres.'],
      ['ok', 'It supports fast similarity search with HNSW indexes.'],
      ['fake', 'It was invented by Napoleon for Atlantis Holdings.'],
    ],
  },
  {
    title: 'The fact-checker catches it',
    what: 'Fact-check',
    detail: 'The claim is not in any source, so the agent goes back to the planner.',
    lines: [
      ['ok', 'pgvector adds a vector column type to Postgres.'],
      ['ok', 'It supports fast similarity search with HNSW indexes.'],
      ['struck', 'It was invented by Napoleon for Atlantis Holdings.'],
    ],
  },
  {
    title: 'A better answer',
    what: 'Retry',
    detail: 'A second search, a new draft, and every claim backed up.',
    lines: [
      ['ok', 'pgvector adds a vector column type to Postgres.'],
      ['ok', 'It supports fast similarity search with HNSW indexes.'],
      ['fresh', 'It runs on Neon, Supabase and Amazon RDS.'],
    ],
  },
]

const MARK = { ok: '✓', fake: '?', struck: '✗', fresh: '✓', src: '◦' }

function Story() {
  const [index, setIndex, setPaused] = useCycle(STORY.length, 4200)
  const step = STORY[index]
  const go = (delta) => {
    setPaused(true)
    setIndex((i) => (i + delta + STORY.length) % STORY.length)
  }
  return (
    <section className="story block" data-reveal>
      <div className="block-head">
        <span className="label">Inside the fact-checker</span>
        <span className="label quiet">“What is pgvector?”</span>
      </div>
      <h2 className="story-title">
        Every claim is checked against
        <br />
        the pages the agent actually read
      </h2>
      <div className="story-card">
        <button type="button" className="arrow left" onClick={() => go(-1)} aria-label="Previous step">‹</button>
        <div className="story-inner" key={index}>
          <div className="story-meta">
            <span>Step {index + 1}</span>
            <div className="story-progress">
              {STORY.map((s, i) => (
                <i key={s.title} className={i === index ? 'on' : ''} />
              ))}
            </div>
          </div>
          <div className="story-main">
            <b>{step.title}</b>
            <div className="story-cols">
              <span>/ {step.what}</span>
              <span>{step.detail}</span>
            </div>
            <ul className="story-lines">
              {step.lines.map(([kind, text], i) => (
                <li key={text} className={kind} style={{ animationDelay: `${i * 0.12}s` }}>
                  <em>{MARK[kind]}</em> {text}
                  {kind === 'struck' && <small>not in any source → retry</small>}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <button type="button" className="arrow right" onClick={() => go(1)} aria-label="Next step">›</button>
      </div>
    </section>
  )
}

export default function LandingPage() {
  const { runs, totals } = useLiveNumbers()

  const latest = runs ? latestByConfig(runs) : []
  const replan = latest.find((row) => row.item.id === 'replan')?.run
  const baseline = latest.find((row) => row.item.id === 'baseline')?.run
  const rate = (run) => (run && run.tasks ? Math.round((run.passed / run.tasks) * 100) : null)
  const okRate = totals?.runs ? Math.round((totals.ok / totals.runs) * 100) : null

  return (
    <div className="landing">
      <SiteHeader current="/" />
      <section className="hero" style={{ viewTransitionName: 'page-hero' }}>
        <div className="hero-copy">
          <h1>
            See why an AI agent got it wrong. <em>Then watch it fix itself.</em>
          </h1>
          <p>Planning, web search, fact-checking and retries, shown step by step on real recorded runs.</p>
          <div className="hero-ctas">
            <a className="btn solid" href="/observatory?demo=hallucinated_claim">Watch it fix a mistake →</a>
            <a className="text-link" href="/observatory">Ask your own question</a>
          </div>
        </div>
        <ExampleRun />
      </section>

      <section className="hero-stats" aria-label="Live numbers from stored runs">
        <div><b><CountUp value={totals?.runs ?? null} /></b><span>stored runs</span></div>
        <div><b><CountUp value={okRate} suffix="%" /></b><span>completed without error</span></div>
        <div><b><CountUp value={totals?.replans ?? null} /></b><span>retries triggered</span></div>
        <div><b>{totals?.p50_ms != null ? formatMs(totals.p50_ms) : '—'}</b><span>median run time</span></div>
      </section>
      <section className="metrics block" data-reveal>
        <span className="label">Measured on the test suite</span>
        <h2>
          Numbers from real,
          <br />
          recorded runs
        </h2>
        <div className="metric-row">
          <div className="metric">
            <b><CountUp value={rate(replan)} suffix="%" /></b>
            <p>
              of test questions answered correctly with fact-checking and retry, up from {rate(baseline) ?? '—'}% without them.
            </p>
          </div>
          <div className="metric">
            <b>
              <CountUp value={replan?.injected ? replan.recoveredByReplan : null} />
              <span className="of">/{replan?.injected ?? '—'}</span>
            </b>
            <p>planted failures fixed by going back to the planner and searching again.</p>
          </div>
          <div className="metric">
            <b><CountUp value={totals?.claims ?? null} /></b>
            <p>individual claims checked against the pages the agent read.</p>
          </div>
        </div>
        <div className="block-foot">
          <span>25 test questions · 3 configurations · graded on facts, not style</span>
          <a className="text-link" href="/evals">See every result →</a>
        </div>
      </section>

      <Story />

      <section className="how" data-reveal>
        <div className="section-head">
          <span className="label">How it works</span>
          <h2>Four steps, and one way back</h2>
        </div>
        <div className="how-grid">
          {[
            ['Plan', 'Reads your question and picks a tool: web search, calculator, customer database or text analysis.'],
            ['Search', 'Runs the tool and pulls in related answers from earlier runs, its memory.'],
            ['Fact-check', 'Writes an answer, then checks every claim against the pages it found.'],
            ['Retry', 'If a claim can’t be backed up, or the search failed, it goes back and tries a better search.'],
          ].map(([title, text], i) => (
            <div key={title} className={`how-card${i === 3 ? ' back' : ''}`} style={{ transitionDelay: `${i * 0.08}s` }}>
              <span className="idx">{pad(i + 1)}</span>
              <b>{title}</b>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="break" data-reveal>
        <div className="section-head split">
          <div>
            <span className="label">Break it yourself</span>
            <h2>Plant a failure. See if it notices.</h2>
          </div>
          <p>Each demo runs a real question with one thing broken on purpose. Sometimes it recovers, sometimes it doesn’t, and you see which.</p>
        </div>
        <div className="break-grid">
          {DEMOS.map((demo, i) => (
            <a key={demo.id} className="break-card" href={`/observatory?demo=${demo.id}`}>
              <span className="idx">{pad(i + 1)}</span>
              <b>{demo.title}</b>
              <p>{demo.plant}</p>
              <span className="break-go">Run demo →</span>
            </a>
          ))}
        </div>
      </section>

      <section className="results" data-reveal>
        <div>
          <span className="label">Does it help?</span>
          <h2>Same questions, three ways</h2>
          <p>
            A question counts as correct when the right tool was used and the answer has the expected facts and none of the
            planted false ones.
          </p>
          <a className="btn solid" href="/evals">Open the evaluations →</a>
        </div>
        <div className="results-card">
          {runs && runs.length > 0 ? <SuccessBars runs={runs} /> : <div className="muted">Loading live evaluation data…</div>}
        </div>
      </section>

      <section className="inspect" data-reveal>
        <span className="label">Look inside</span>
        {[
          ['/observatory', 'Observatory', 'A 3D map of the agent. Each step lights up as it runs, and a red arrow appears only when a retry really happens.'],
          ['/traces', 'Traces', 'Every step of your runs with its input, output, time taken and errors, in plain words and in full detail.'],
          ['/evals', 'Evaluations', 'Test results with and without fact-checking, plus how fast memory search stays as data grows.'],
        ].map(([href, title, text], i) => (
          <a key={href} href={href} className="inspect-row">
            <span className="idx">{pad(i + 1)}</span>
            <b>{title}</b>
            <p>{text}</p>
            <span className="go">→</span>
          </a>
        ))}
      </section>

      <section className="honest" data-reveal>
        <span className="label">What the numbers mean</span>
        <p>
          The test set is small (25 questions written for this project) and is graded by checking for expected facts, not by
          judging writing quality. AI answers and web results change, so results vary between runs. The fact-checker is itself
          an AI and can be wrong; when it is unavailable, a simpler word-matching check is used and the trace says so.
        </p>
      </section>

      <section className="final" data-reveal>
        <h2>
          Go break an agent.
          <br />
          Then watch it recover.
        </h2>
        <a className="btn solid" href="/observatory?demo">Start a demo →</a>
      </section>

      <SiteFooter />
    </div>
  )
}
