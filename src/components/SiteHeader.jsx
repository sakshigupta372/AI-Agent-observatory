import { useState } from 'react'
import '../styles/site.css'

export const SITE_LINKS = [
  ['/', 'Home'],
  ['/observatory', 'Observatory'],
  ['/traces', 'Traces'],
  ['/evals', 'Evaluations'],
]

// pinned: laid over the top of the full-screen Observatory instead of flowing with the page.
export default function SiteHeader({ current = '/', pinned = false }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className={`site-header${pinned ? ' pinned' : ''}`} style={{ viewTransitionName: 'site-header' }}>
      <a href="/" className="sh-logo" aria-label="AI Agent Observatory home">
        Observatory
      </a>

      <nav className="sh-nav" aria-label="Main">
        {SITE_LINKS.map(([href, label]) => (
          <a key={href} href={href} aria-current={href === current ? 'page' : undefined}>
            {label}
          </a>
        ))}
      </nav>

      <div className="sh-actions">
        <a className="sh-cta" href="/observatory?demo">
          Run a demo
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
      </nav>

      {!pinned && <span className="sh-progress" aria-hidden="true" />}
    </header>
  )
}
