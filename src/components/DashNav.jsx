import { useRef } from 'react'
import SiteHeader from './SiteHeader.jsx'

// [kind, size, top, right, depth]: deeper orbs drift further with the cursor.
const ORBS = [
  ['o5', 150, '-30px', '8%', 30],
  ['o1', 70, '150px', '24%', 18],
  ['o2', 44, '70px', '36%', 12],
  ['o3', 96, '190px', '4%', 24],
  ['o4', 30, '40px', '18%', 8],
]

export default function DashNav({ current, kicker, title, subtitle }) {
  const heroRef = useRef(null)
  const onMove = (e) => {
    const box = heroRef.current.getBoundingClientRect()
    const dx = (e.clientX - box.left) / box.width - 0.5
    const dy = (e.clientY - box.top) / box.height - 0.5
    heroRef.current.querySelectorAll('[data-depth]').forEach((orb) => {
      const depth = Number(orb.dataset.depth)
      orb.style.translate = `${dx * depth}px ${dy * depth}px`
    })
  }

  return (
    <>
      <SiteHeader current={current} />
      <section className="page-hero" ref={heroRef} onPointerMove={onMove} style={{ viewTransitionName: 'page-hero' }}>
        <div className="ph-sky" aria-hidden="true" />
        <div className="ph-orbs" aria-hidden="true">
          {ORBS.map(([kind, size, top, right, depth]) => (
            <span key={kind} className={`orb ${kind}`} data-depth={depth} style={{ width: size, height: size, top, right }} />
          ))}
        </div>
        <div className="ph-copy">
          <span className="ph-tag">[ {kicker} ]</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </section>
    </>
  )
}
