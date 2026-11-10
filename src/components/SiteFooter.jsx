import { REPO_URL } from './SiteHeader.jsx'
import { useLiveTotals } from '../hooks/useLiveTotals.js'
import '../styles/site.css'

const PRODUCT = [
  ['/observatory', 'Observatory'],
  ['/traces', 'Traces'],
  ['/evals', 'Evaluations'],
  ['/observatory?demo', 'Run a demo'],
]

const BUILT_WITH = ['Astro', 'React Three Fiber', 'Groq', 'pgvector + SSE']

export default function SiteFooter() {
  const { totals, online } = useLiveTotals()

  return (
    <footer className="site-footer">
      <div className="sf-inner">
        <div className="sf-cta">
          <h2>
            Break an agent. <em>Watch it recover.</em>
          </h2>
          <a className="sf-btn" href="/observatory?demo">Run a demo →</a>
        </div>

        <div className="sf-cols">
          <div className="sf-brand">
            <b>Observatory</b>
            <p>A 3D observability and evaluation platform for AI agent pipelines.</p>
          </div>
          <div>
            <h4>Product</h4>
            <ul>
              {PRODUCT.map(([href, label]) => (
                <li key={href}><a href={href}>{label}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Built with</h4>
            <ul>
              {BUILT_WITH.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Connect</h4>
            <ul>
              <li><a href={REPO_URL} target="_blank" rel="noreferrer">GitHub ↗</a></li>
              <li><a href={`${REPO_URL}/tree/main/benchmarks`} target="_blank" rel="noreferrer">Benchmarks ↗</a></li>
            </ul>
          </div>
        </div>

        <div className="sf-bar">
          <span>© {new Date().getFullYear()} Built by Sakshi Gupta</span>
          <span className={`sf-live${online === false ? ' down' : ''}`}>
            <i />
            {online === false ? 'Status unknown' : totals ? `Agent online · ${totals.runs.toLocaleString('en-US')} runs recorded` : 'Agent online'}
          </span>
          <button type="button" className="sf-top-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Back to top ↑
          </button>
        </div>
      </div>
    </footer>
  )
}
