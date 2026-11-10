import { EVAL_CONFIGS } from '../data/evalSuite.js'
import '../styles/successbars.css'

const PLAIN_LABEL = {
  baseline: 'No fact-checking',
  verify: 'Fact-checking only',
  replan: 'Fact-checking + retry',
}

// The newest stored run for each configuration, in suite order.
export function latestByConfig(runs = []) {
  const byConfig = new Map()
  for (const run of runs) {
    const id = run.config?.id
    if (id && !byConfig.has(id)) byConfig.set(id, run)
  }
  return EVAL_CONFIGS.map((item) => ({ item, run: byConfig.get(item.id) || null }))
}

export default function SuccessBars({ runs, compact = false }) {
  const rows = latestByConfig(runs).filter((row) => row.run && row.run.tasks)
  if (!rows.length) return null
  return (
    <div className={`success-bars${compact ? ' compact' : ''}`}>
      {rows.map(({ item, run }) => {
        const rate = Math.round((run.passed / run.tasks) * 100)
        return (
          <div key={item.id} className={`success-bar ${item.id}`}>
            <div className="success-bar-label">
              <span>{PLAIN_LABEL[item.id] || item.label}</span>
              <b>{rate}%</b>
            </div>
            <div className="success-bar-track">
              <span style={{ width: `${rate}%` }} />
            </div>
            <div className="success-bar-note">
              {run.passed} of {run.tasks} test questions answered correctly
            </div>
          </div>
        )
      })}
    </div>
  )
}
