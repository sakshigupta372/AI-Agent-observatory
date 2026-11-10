import '../styles/flow.css'

// A left-to-right flow of steps with an optional loop arrow back to an
// earlier step. Stacks vertically on narrow screens or when `vertical` is set.
// steps: [{ id, title, note, Icon }]
// loop:  { from, to, label } (step ids)
// broken: id of a step drawn as the failure point
export default function FlowDiagram({ steps, loop, broken, vertical = false, label }) {
  const index = (id) => steps.findIndex((step) => step.id === id)
  const from = loop ? index(loop.from) : -1
  const to = loop ? index(loop.to) : -1

  return (
    <figure
      className={`flow${vertical ? ' vertical' : ''}`}
      style={{ '--count': steps.length }}
      aria-label={label}
    >
      <ol className="flow-steps">
        {steps.map(({ id, title, note, Icon }, i) => {
          const classes = [id === broken && 'broken', i === from && 'loop-from', i === to && 'loop-to'].filter(Boolean).join(' ')
          return (
            <li key={id} className={classes || undefined} style={{ '--i': i }}>
              <span className="flow-icon" aria-hidden="true">
                {Icon ? <Icon size={vertical ? 16 : 20} strokeWidth={1.8} /> : i + 1}
              </span>
              <b>{title}</b>
              {note && <span className="flow-note">{note}</span>}
              {i === from && loop && <span className="flow-loop-tag">↺ {loop.label}</span>}
            </li>
          )
        })}
      </ol>
      {loop && from > to && to >= 0 && (
        <div
          className="flow-loop"
          style={{ gridColumn: `${to + 1} / ${from + 2}`, '--span': from - to + 1 }}
          aria-hidden="true"
        >
          <span>{loop.label}</span>
        </div>
      )}
    </figure>
  )
}
