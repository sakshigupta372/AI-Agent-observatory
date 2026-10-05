export default function MemoryStatsPanel({ stats }) {
  if (!stats) return null

  return (
    <div className="memory-panel">
      <div className="memory-panel-header">MEMORY RETRIEVAL</div>
      <div className="memory-flow">Saved runs in this observatory, matched by the words in your question.</div>
      <div className="memory-stats-grid">
        <div><span>Cluster</span>{stats.clusterLabel}</div>
        <div><span>Retrieved</span>{stats.retrieved}</div>
        <div><span>Latency</span>{stats.latencyMs}ms</div>
      </div>
      <ul className="memory-items">
        {stats.items?.length ? (
          stats.items.map((item) => <li key={item.id}>{item.summary}</li>)
        ) : (
          <li>No earlier run matched. This one is saved into the cluster when it finishes.</li>
        )}
      </ul>
    </div>
  )
}
