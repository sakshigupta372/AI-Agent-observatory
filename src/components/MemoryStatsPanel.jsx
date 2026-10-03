export default function MemoryStatsPanel({ stats }) {
  if (!stats) return null

  return (
    <div className="memory-panel">
      <div className="memory-panel-header">MEMORY RETRIEVAL</div>
      <div className="memory-flow">Query → Embedding → Similarity Search → Top-K Results → Context</div>
      <div className="memory-stats-grid">
        <div><span>Cluster</span>{stats.clusterLabel}</div>
        <div><span>Top-K</span>{stats.topK}</div>
        <div><span>Threshold</span>{stats.threshold}</div>
        <div><span>Retrieved</span>{stats.retrieved} chunks</div>
        <div><span>Latency</span>{stats.latencyMs}ms</div>
      </div>
    </div>
  )
}
