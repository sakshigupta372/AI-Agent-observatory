import { useState } from 'react'
import { ROLES } from '../data/agentArchitecture.js'

const KEY = 'observatory_legend_open'

export default function Legend() {
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem(KEY)
    return saved == null ? window.innerWidth > 720 : saved === '1'
  })

  const toggle = () => {
    setOpen((value) => {
      localStorage.setItem(KEY, value ? '0' : '1')
      return !value
    })
  }

  return (
    <div className={`obs-legend${open ? ' open' : ''}`}>
      <button type="button" className="obs-legend-toggle" onClick={toggle} aria-expanded={open} aria-controls="obs-legend-list">
        <span className="obs-legend-dots" aria-hidden="true">
          {ROLES.slice(0, 4).map((role) => (
            <i key={role.id} style={{ background: role.color }} />
          ))}
        </span>
        Legend
        <span className="obs-legend-caret" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ul id="obs-legend-list">
          {ROLES.map((role) => (
            <li key={role.id} title={role.hint}>
              <i style={{ background: role.color }} aria-hidden="true" />
              <b>{role.label}</b>
              <span className="sr-only">: {role.hint}</span>
            </li>
          ))}
          <li title="Fact-check sent it back to the planner. Only drawn when it really happens.">
            <i className="line retry" aria-hidden="true" />
            <b>Retry</b>
            <span className="sr-only">: fact-check sent it back to the planner, only drawn when it happens</span>
          </li>
          <li title="Arrowheads and moving pulses show the order of the steps.">
            <i className="line flow" aria-hidden="true" />
            <b>Flow →</b>
            <span className="sr-only">: arrows and pulses show the order of the steps</span>
          </li>
        </ul>
      )}
    </div>
  )
}
