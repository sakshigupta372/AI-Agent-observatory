import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLiveTotals } from '../hooks/useLiveTotals.js'
import '../styles/site.css'

export const SITE_LINKS = [
  ['/', 'Home'],
  ['/observatory', 'Observatory'],
  ['/traces', 'Traces'],
  ['/evals', 'Evaluations'],
]

export default function SiteHeader({ current = '/' }) {
  const [solid, setSolid] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pill, setPill] = useState(null)
  const progressRef = useRef(null)
  const navRef = useRef(null)
  const { totals, online } = useLiveTotals()

  useEffect(() => {
    let lastY = window.scrollY
    let ticking = false
    const update = () => {
      const y = window.scrollY
      setSolid(y > 40)
      if (y < 240 || y < lastY - 4) setHidden(false)
      else if (y > lastY + 4) setHidden(true)
      lastY = y
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${max > 0 ? y / max : 0})`
      ticking = false
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const moveTo = (el) => setPill(el ? { href: el.getAttribute('href'), x: el.offsetLeft, w: el.offsetWidth } : null)
  const resetPill = () => moveTo(navRef.current?.querySelector('a[aria-current="page"]'))

  useLayoutEffect(() => {
    resetPill()
    document.fonts?.ready.then(resetPill)
  }, [current])

  return (
    <header className={`site-header${solid ? ' solid' : ''}${hidden && !menuOpen ? ' hidden' : ''}`}>
      <a href="/" className="sh-chip sh-logo" aria-label="AI Agent Observatory home">
        <span className="sh-mark" aria-hidden="true"><i /><i /><i /><i /></span>
        Observatory <span className="dim">/ AI agents</span>
      </a>

      <nav className="sh-nav" ref={navRef} onMouseLeave={resetPill}>
        <span
          className="sh-indicator"
          style={pill ? { transform: `translateX(${pill.x - 3}px)`, width: pill.w } : { opacity: 0, width: 0 }}
          aria-hidden="true"
        />
        {SITE_LINKS.map(([href, label]) => (
          <a
            key={href}
            href={href}
            className={pill?.href === href ? 'on' : ''}
            aria-current={href === current ? 'page' : undefined}
            onMouseEnter={(e) => moveTo(e.currentTarget)}
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="sh-actions">
        <a className={`sh-chip sh-status${online === false ? ' down' : ''}`} href="/traces" title="Runs recorded so far">
          <i />
          {online === false ? 'Offline' : totals ? `${totals.runs.toLocaleString('en-US')} runs` : 'Live'}
        </a>
        <a className="sh-chip sh-cta" href="/observatory?demo">
          <span className="long">Run a demo</span> <span>→</span>
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

      <div className={`sh-menu${menuOpen ? ' open' : ''}`}>
        {SITE_LINKS.map(([href, label]) => (
          <a key={href} href={href} className={href === current ? 'on' : ''}>
            {label}
          </a>
        ))}
      </div>

      <span className="sh-progress" ref={progressRef} aria-hidden="true" />
    </header>
  )
}
