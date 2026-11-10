import { useEffect, useRef } from 'react'
import { DEMOS } from '../data/demos.js'
import { SITE_LINKS } from './SiteHeader.jsx'
import { useLiveTotals } from '../hooks/useLiveTotals.js'
import '../styles/site.css'

const REPO = 'https://github.com/sakshigupta372/AI-Agent-observatory'
const WORD = 'OBSERVATORY'

const ORBS = [
  ['o5', { width: 120, height: 120, top: -30, right: '12%' }],
  ['o1', { width: 46, height: 46, top: 90, right: '6%' }],
  ['o3', { width: 34, height: 34, top: 40, right: '30%' }],
]

export default function SiteFooter() {
  const wordRef = useRef(null)
  const { totals, online } = useLiveTotals()

  useEffect(() => {
    const el = wordRef.current
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.classList.add('in')
        io.disconnect()
      }
    }, { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <footer className="site-footer">
      <div className="sf-orbs" aria-hidden="true">
        {ORBS.map(([kind, style]) => (
          <span key={kind} className={`orb ${kind}`} style={style} />
        ))}
      </div>

      <div className="sf-top">
        <div className="sf-intro">
          <span className="sf-tag">[ AI Agent Observatory ]</span>
          <p>See why an AI agent got it wrong, and watch it fix itself.</p>
          <a className="sf-btn" href="/observatory?demo">Start a demo <span>→</span></a>
        </div>
        <div className="sf-cols">
          <div>
            <h4>Explore</h4>
            <ul>
              {SITE_LINKS.map(([href, label]) => (
                <li key={href}><a href={href}>{label}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Break it yourself</h4>
            <ul>
              {DEMOS.map((demo) => (
                <li key={demo.id}><a href={`/observatory?demo=${demo.id}`}>{demo.title}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Project</h4>
            <ul>
              <li><a href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a></li>
              <li><a href={`${REPO}/tree/main/benchmarks`} target="_blank" rel="noreferrer">Benchmarks</a></li>
              <li><a href="/evals">How it’s measured</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="sf-word" ref={wordRef} aria-hidden="true">
        {WORD.split('').map((letter, i) => (
          <span key={i} style={{ '--i': i }}>{letter}</span>
        ))}
      </div>

      <div className="sf-bar">
        <span>© {new Date().getFullYear()} Built by Sakshi Gupta</span>
        <span className="sf-live">
          <i style={online === false ? { background: '#a2a0ac', animation: 'none' } : undefined} />
          {online === false ? 'Status unknown' : totals ? `Agent online · ${totals.runs.toLocaleString('en-US')} runs recorded` : 'Agent online'}
        </span>
        <button type="button" className="sf-top-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          Back to top <b>↑</b>
        </button>
      </div>
    </footer>
  )
}
