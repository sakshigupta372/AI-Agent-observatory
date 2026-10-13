import { useEffect, useState } from 'react'

/**
 * AI Agent Observatory - Project Report Canvas
 * 
 * This component provides a comprehensive overview of the project's architecture,
 * performance metrics, and implementation details. It's designed for showcasing
 * the system's capabilities and design decisions.
 */

interface ProjectMetrics {
  database: {
    totalRuns: number
    totalTraces: number
    avgLatency: number
    p95Latency: number
    totalTokens: number
    estimatedCost: number
  }
  tools: Array<{
    name: string
    calls: number
    avgLatency: number
    successRate: number
  }>
  evaluation?: {
    totalEvals: number
    avgAccuracy: number
    toolSelectionAccuracy: number
    verificationRate: number
  }
}

interface ArchitectureNode {
  id: string
  label: string
  type: 'stage' | 'tool' | 'storage'
  description: string
}

const ARCHITECTURE_FLOW: ArchitectureNode[] = [
  { id: 'user', label: 'User Query', type: 'stage', description: 'Natural language input' },
  { id: 'intent', label: 'Intent Classifier', type: 'stage', description: 'Routes to appropriate tool based on query pattern' },
  { id: 'planner', label: 'Planner', type: 'stage', description: 'Generates execution plan with selected tool' },
  { id: 'tool-hub', label: 'Tool Hub', type: 'stage', description: 'Dispatches to selected tool' },
  { id: 'web', label: 'Web Search (Tavily)', type: 'tool', description: 'Real-time web search for fresh data' },
  { id: 'calc', label: 'Calculator', type: 'tool', description: 'Mathematical computations' },
  { id: 'db', label: 'Database (pgvector)', type: 'tool', description: 'Semantic memory search with embeddings' },
  { id: 'api', label: 'External API', type: 'tool', description: 'Third-party API integration' },
  { id: 'memory', label: 'Memory Store', type: 'storage', description: 'PostgreSQL + pgvector for semantic retrieval' },
  { id: 'reasoning', label: 'Reasoning Engine', type: 'stage', description: 'Groq LLM synthesizes final answer' },
  { id: 'verifier', label: 'Claim Verifier', type: 'stage', description: 'Validates response against sources' },
  { id: 'response', label: 'Response', type: 'stage', description: 'Structured output with confidence score' }
]

const TECH_STACK = {
  frontend: ['Astro', 'React', 'Three.js', 'React Three Fiber'],
  backend: ['Node.js', 'SSE Streaming', 'PostgreSQL', 'pgvector'],
  ai: ['Groq (gpt-oss-120b)', 'Tavily Search API', 'Transformers.js (embeddings)'],
  deployment: ['Neon (PostgreSQL)', 'Render (hosting)']
}

const KEY_FEATURES = [
  {
    title: '3D Real-time Visualization',
    description: 'Watch the agent execute in real-time with particle effects, orbital animations, and dynamic node highlighting'
  },
  {
    title: 'Semantic Memory with pgvector',
    description: 'Vector embeddings enable fast semantic search across historical data and user context'
  },
  {
    title: 'Claim-level Verification',
    description: 'Every factual claim in responses is verified against tool outputs for accuracy'
  },
  {
    title: 'Execution Tracing',
    description: 'Full span-based tracing with latency breakdown, token usage, and cost estimation'
  },
  {
    title: 'Evaluation Suite',
    description: 'Automated testing across tool categories with injected failure detection'
  },
  {
    title: 'Adaptive Replanning',
    description: 'Agent detects tool failures and replans execution path automatically'
  }
]

export default function AIAgentObservatoryReport() {
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMetrics() {
      try {
        // Fetch real metrics from the API
        const [tracesRes, evalsRes] = await Promise.all([
          fetch('/api/traces/analytics').catch(() => null),
          fetch('/api/evals').catch(() => null)
        ])

        const traces = tracesRes?.ok ? await tracesRes.json() : null
        const evals = evalsRes?.ok ? await evalsRes.json() : null

        setMetrics({
          database: {
            totalRuns: traces?.totals?.runs || 0,
            totalTraces: traces?.totals?.runs || 0,
            avgLatency: traces?.totals?.p50_ms || 0,
            p95Latency: traces?.totals?.p95_ms || 0,
            totalTokens: (traces?.totals?.prompt_tokens || 0) + (traces?.totals?.completion_tokens || 0),
            estimatedCost: traces?.totals?.cost || 0
          },
          tools: traces?.tools?.map((t: any) => ({
            name: t.tool,
            calls: t.runs,
            avgLatency: t.avg_ms,
            successRate: t.runs > 0 ? ((t.runs - t.failed) / t.runs) * 100 : 0
          })) || [],
          evaluation: evals?.runs?.length > 0 ? {
            totalEvals: evals.runs.length,
            avgAccuracy: evals.runs[0]?.passed / evals.runs[0]?.tasks * 100 || 0,
            toolSelectionAccuracy: evals.runs[0]?.toolOk / evals.runs[0]?.tasks * 100 || 0,
            verificationRate: evals.runs[0]?.claims > 0 ? evals.runs[0]?.claimsSupported / evals.runs[0]?.claims * 100 : 0
          } : undefined
        })
      } catch (error) {
        console.error('Failed to load metrics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>AI Agent Observatory</h1>
        <p style={styles.subtitle}>Real-time 3D Observability for Autonomous AI Agents</p>
      </header>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Project Overview</h2>
        <p style={styles.text}>
          AI Agent Observatory is a production-ready observability platform that visualizes
          AI agent execution in real-time using 3D graphics. Unlike traditional logging tools,
          it shows the <strong>actual execution path</strong> from intent detection through
          tool selection, memory retrieval, reasoning, and verification.
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Architecture Flow</h2>
        <div style={styles.flowContainer}>
          {ARCHITECTURE_FLOW.map((node, idx) => (
            <div key={node.id} style={styles.flowNode}>
              <div style={{
                ...styles.nodeBox,
                backgroundColor: node.type === 'tool' ? '#1e3a8a' : node.type === 'storage' ? '#065f46' : '#4c1d95'
              }}>
                <div style={styles.nodeLabel}>{node.label}</div>
                <div style={styles.nodeDesc}>{node.description}</div>
              </div>
              {idx < ARCHITECTURE_FLOW.length - 1 && node.type !== 'tool' && (
                <div style={styles.arrow}>↓</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Key Features</h2>
        <div style={styles.grid}>
          {KEY_FEATURES.map((feature) => (
            <div key={feature.title} style={styles.featureCard}>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDesc}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Technology Stack</h2>
        <div style={styles.techStack}>
          {Object.entries(TECH_STACK).map(([category, technologies]) => (
            <div key={category} style={styles.techCategory}>
              <h4 style={styles.techCategoryTitle}>{category.toUpperCase()}</h4>
              <div style={styles.techList}>
                {technologies.map((tech) => (
                  <span key={tech} style={styles.techBadge}>{tech}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {!loading && metrics && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Live System Metrics</h2>
          <div style={styles.metricsGrid}>
            <MetricCard
              title="Total Runs"
              value={metrics.database.totalRuns.toLocaleString()}
              subtitle="Executed agent runs"
            />
            <MetricCard
              title="Avg Latency"
              value={`${Math.round(metrics.database.avgLatency)}ms`}
              subtitle="p50 execution time"
            />
            <MetricCard
              title="p95 Latency"
              value={`${Math.round(metrics.database.p95Latency)}ms`}
              subtitle="95th percentile"
            />
            <MetricCard
              title="Total Tokens"
              value={metrics.database.totalTokens.toLocaleString()}
              subtitle="Processed by LLM"
            />
            <MetricCard
              title="Estimated Cost"
              value={`$${metrics.database.estimatedCost.toFixed(4)}`}
              subtitle="Total API cost"
            />
            {metrics.evaluation && (
              <>
                <MetricCard
                  title="Tool Accuracy"
                  value={`${Math.round(metrics.evaluation.toolSelectionAccuracy)}%`}
                  subtitle="Correct tool selection"
                />
                <MetricCard
                  title="Task Success"
                  value={`${Math.round(metrics.evaluation.avgAccuracy)}%`}
                  subtitle="Overall accuracy"
                />
                <MetricCard
                  title="Verification Rate"
                  value={`${Math.round(metrics.evaluation.verificationRate)}%`}
                  subtitle="Claims verified"
                />
              </>
            )}
          </div>

          {metrics.tools.length > 0 && (
            <div style={styles.toolsSection}>
              <h3 style={styles.subsectionTitle}>Tool Performance</h3>
              <div style={styles.toolsGrid}>
                {metrics.tools.map((tool) => (
                  <div key={tool.name} style={styles.toolCard}>
                    <div style={styles.toolName}>{tool.name}</div>
                    <div style={styles.toolStats}>
                      <span>{tool.calls} calls</span>
                      <span>{Math.round(tool.avgLatency)}ms avg</span>
                      <span>{Math.round(tool.successRate)}% success</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Implementation Highlights</h2>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <strong>Streaming SSE Architecture:</strong> Real-time event streaming enables
            live visualization updates as the agent executes
          </li>
          <li style={styles.listItem}>
            <strong>pgvector Semantic Search:</strong> 384-dimensional embeddings with HNSW
            indexing for sub-10ms similarity search at scale
          </li>
          <li style={styles.listItem}>
            <strong>Groq LLM Integration:</strong> Fast inference with gpt-oss-120b model,
            including automatic retry with exponential backoff
          </li>
          <li style={styles.listItem}>
            <strong>React Three Fiber 3D:</strong> WebGL-based visualization with orbital
            controls, particle systems, and shader effects
          </li>
          <li style={styles.listItem}>
            <strong>Span-based Tracing:</strong> Full execution traces with token usage,
            latency breakdown, and cost estimation per stage
          </li>
          <li style={styles.listItem}>
            <strong>Evaluation Framework:</strong> Automated testing with injected failures
            to measure detection, localization, and recovery
          </li>
        </ul>
      </section>

      <footer style={styles.footer}>
        <p>Built with Astro, React, Three.js, PostgreSQL, and pgvector</p>
        <p style={styles.muted}>
          Open-source AI agent observability platform · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  )
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricTitle}>{title}</div>
      <div style={styles.metricValue}>{value}</div>
      <div style={styles.metricSubtitle}>{subtitle}</div>
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#e8eaed',
    backgroundColor: '#0a0e1a',
    lineHeight: 1.6
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '60px',
    borderBottom: '2px solid #1e293b',
    paddingBottom: '30px'
  },
  title: {
    fontSize: '48px',
    fontWeight: 700,
    margin: 0,
    background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  subtitle: {
    fontSize: '20px',
    color: '#94a3b8',
    marginTop: '12px'
  },
  section: {
    marginBottom: '50px'
  },
  sectionTitle: {
    fontSize: '32px',
    fontWeight: 600,
    marginBottom: '20px',
    color: '#f1f5f9',
    borderLeft: '4px solid #3b82f6',
    paddingLeft: '16px'
  },
  subsectionTitle: {
    fontSize: '24px',
    fontWeight: 600,
    marginTop: '30px',
    marginBottom: '16px',
    color: '#cbd5e1'
  },
  text: {
    fontSize: '16px',
    color: '#cbd5e1',
    lineHeight: 1.8
  },
  flowContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    alignItems: 'center'
  },
  flowNode: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    width: '100%',
    maxWidth: '600px'
  },
  nodeBox: {
    padding: '16px 24px',
    borderRadius: '8px',
    width: '100%',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
  },
  nodeLabel: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '4px'
  },
  nodeDesc: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)'
  },
  arrow: {
    fontSize: '24px',
    color: '#475569',
    margin: '4px 0'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px'
  },
  featureCard: {
    padding: '24px',
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    border: '1px solid #334155'
  },
  featureTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#60a5fa',
    marginTop: 0,
    marginBottom: '12px'
  },
  featureDesc: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0
  },
  techStack: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '24px'
  },
  techCategory: {
    padding: '20px',
    backgroundColor: '#1e293b',
    borderRadius: '8px'
  },
  techCategoryTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#94a3b8',
    marginTop: 0,
    marginBottom: '12px',
    letterSpacing: '0.05em'
  },
  techList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px'
  },
  techBadge: {
    padding: '6px 12px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '4px',
    fontSize: '13px',
    color: '#e2e8f0'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '20px'
  },
  metricCard: {
    padding: '20px',
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    textAlign: 'center' as const,
    border: '1px solid #334155'
  },
  metricTitle: {
    fontSize: '14px',
    color: '#94a3b8',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em'
  },
  metricValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#60a5fa',
    marginBottom: '4px'
  },
  metricSubtitle: {
    fontSize: '12px',
    color: '#64748b'
  },
  toolsSection: {
    marginTop: '30px'
  },
  toolsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px'
  },
  toolCard: {
    padding: '16px',
    backgroundColor: '#0f172a',
    borderRadius: '6px',
    border: '1px solid #334155'
  },
  toolName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#e2e8f0',
    marginBottom: '8px'
  },
  toolStats: {
    display: 'flex',
    gap: '12px',
    fontSize: '13px',
    color: '#94a3b8',
    flexWrap: 'wrap' as const
  },
  list: {
    listStyle: 'none',
    padding: 0
  },
  listItem: {
    padding: '12px 0',
    fontSize: '15px',
    color: '#cbd5e1',
    borderBottom: '1px solid #1e293b'
  },
  footer: {
    marginTop: '60px',
    paddingTop: '30px',
    borderTop: '2px solid #1e293b',
    textAlign: 'center' as const,
    color: '#64748b',
    fontSize: '14px'
  },
  muted: {
    color: '#475569',
    marginTop: '8px'
  }
}
