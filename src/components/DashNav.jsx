import { cn } from '../lib/utils.js'

const LINKS = [
  ['/', 'Observatory'],
  ['/traces', 'Traces'],
  ['/evals', 'Evals'],
]

export default function DashNav({ current, title, subtitle }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="relative flex size-9 items-center justify-center">
          <span className="absolute inset-0 rounded-xl bg-primary/20 blur-md opacity-70" />
          <svg className="relative size-9 text-primary drop-shadow-[0_0_8px_var(--primary)]" viewBox="0 0 36 36" fill="none" aria-hidden="true">
            <circle cx="18" cy="18" r="13" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
            <ellipse cx="18" cy="18" rx="13" ry="5" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />
            <circle cx="18" cy="18" r="3.4" fill="currentColor" />
            <circle cx="29" cy="13" r="1.8" fill="currentColor" />
          </svg>
        </span>
        <div className="flex flex-col leading-tight">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && (
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      <nav className="flex items-center gap-1 self-start rounded-full border border-border bg-card/70 p-1 shadow-lg shadow-black/20 backdrop-blur-xl sm:self-auto">
        {LINKS.map(([href, label]) => {
          const active = href === current
          return (
            <a
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/25'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {label}
            </a>
          )
        })}
      </nav>
    </header>
  )
}
