export default function DashNav({ current, title, subtitle }) {
  const links = [
    ['/', 'Observatory'],
    ['/traces', 'Traces'],
    ['/evals', 'Evaluations'],
  ]
  return (
    <div className="dash-top">
      <div>
        <h1>{title}</h1>
        <span>{subtitle}</span>
      </div>
      <nav className="dash-nav">
        {links.map(([href, label]) => (
          <a key={href} href={href} className={href === current ? 'current' : ''}>
            {label}
          </a>
        ))}
      </nav>
    </div>
  )
}
