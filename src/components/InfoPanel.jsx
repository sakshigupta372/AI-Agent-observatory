// HTML overlay panel shown when a node is hovered or selected.
export default function InfoPanel({ node }) {
  if (!node) return null

  return (
    <div className="info-panel">
      <h2>{node.label}</h2>
      <span className="status">{node.status}</span>
      <p>{node.description}</p>
      <div className="tech">{node.tech}</div>
    </div>
  )
}
