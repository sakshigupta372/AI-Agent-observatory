// HTML overlay panel shown when a node is hovered or selected.
export default function InfoPanel({ node }) {
  if (!node) return null

  return (
    <div className="info-panel">
      <h2>{node.label}</h2>
      <span className="status">{node.status}</span>
      <p>{node.description}</p>
      <div className="tech">{node.tech}</div>
      {node.memories?.length > 0 && (
        <ul className="info-memories">
          {node.memories.map((memory) => (
            <li key={memory.id}>{memory.summary}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
