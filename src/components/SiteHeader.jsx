import { useState } from 'react'
import { useLiveTotals } from '../hooks/useLiveTotals.js'
import '../styles/site.css'

export const SITE_LINKS = [
  ['/', 'Home'],
  ['/observatory', 'Observatory'],
  ['/traces', 'Traces'],
  ['/evals', 'Evaluations'],
]

export const REPO_URL = 'https://github.com/sakshigupta372/AI-Agent-observatory'

// pinned: laid over the top of the full-screen Observatory instead of flowing with the page.
export default function SiteHeader({ current = '/', pinned = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { totals, online } = useLiveTotals()

  return (
    <header className={`site-header${pinned ? ' pinned' : ''}`} style={{ viewTransitionName: 'site-header' }}>
      <a href="/" className="sh-logo" aria-label="AI Agent Observatory home">
        <span className="sh-mark" aria-hidden="true"><i /><i /><i /><i /></span>
        <b>Observatory</b>
        <span className="sh-tag">/ AI agents</span>
      </a>

      <nav className="sh-nav" aria-label="Main">
        {SITE_LINKS.map(([href, label]) => (
          <a key={href} href={href} aria-current={href === current ? 'page' : undefined}>
            {label}
          </a>
        ))}
      </nav>

      <div className="sh-actions">
        {totals && online && (
          <a className="sh-live" href="/traces" title="Runs stored so far">
            <i aria-hidden="true" />
            {totals.runs.toLocaleString('en-US')} runs
          </a>
        )}
        <a className="sh-gh" href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub <span aria-hidden="true">↗</span>
        </a>
        <a className="sh-cta" href="/observatory?demo">
          Run a demo →
        </a>
        <button
          type="button"
          className={`sh-burger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          <i />
          <i />
        </button>
      </div>

      <nav className={`sh-menu${menuOpen ? ' open' : ''}`} aria-label="Main">
        {SITE_LINKS.map(([href, label]) => (
          <a key={href} href={href} aria-current={href === current ? 'page' : undefined}>
            {label}
          </a>
        ))}
        <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub ↗</a>
      </nav>

      {!pinned && <span className="sh-progress" aria-hidden="true" />}
    </header>
  )
}
