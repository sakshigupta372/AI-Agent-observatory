// Evaluation suite. Every task has a reference-based check: the expected tool,
// patterns the final answer must match, and patterns it must not contain.
// Patterns are regex sources (strings) so this file can be shared between the
// Node runner and the browser dashboard.
//
// Injection tasks also carry the stage where the failure was planted
// (`truthStage`) so failure localization can be scored against ground truth.

export const EVAL_QUESTIONS = [
  {
    id: 'verify-replan',
    ask: 'Does the Verifier send failed runs back to the Planner?',
    answer: 'Yes. When claims are unsupported, the planner writes a revised search, the tool re-runs, and the answer is re-verified. Retry limit: 2. The red edge in the scene only appears when it really happened.',
    where: '/  ·  /traces',
  },
  {
    id: 'inspect-tools',
    ask: 'Can I inspect tool inputs, outputs and latency?',
    answer: 'Yes. Every run is stored as a trace of spans with input, output, status, duration, tokens and errors. Open INSPECT RUN after any query, or browse /traces.',
    where: '/traces',
  },
  {
    id: 'memory-latency',
    ask: 'How slow is memory retrieval as the table grows?',
    answer: 'Measured on synthetic vectors at several table sizes, with an exact scan as the baseline. See the retrieval benchmark below.',
    where: '/evals',
  },
  {
    id: 'failure-modes',
    ask: 'How does the agent behave under tool failure, empty or wrong retrieval, and hallucinated claims?',
    answer: 'Each failure can be injected on demand. The suite scores whether it was detected, localized to the right stage, and recovered.',
    where: '/evals',
  },
  {
    id: 'is-verifier-worth-it',
    ask: 'Does verification and replanning actually help?',
    answer: 'The same tasks run under three configurations (no verifier, verifier only, verifier + replan) so the difference is measured, not claimed.',
    where: '/evals',
  },
]

export const EVAL_CONFIGS = [
  { id: 'baseline', label: 'No verifier', config: { verify: false, replan: false, remember: false } },
  { id: 'verify', label: 'Verifier only', config: { verify: true, replan: false, remember: false } },
  { id: 'replan', label: 'Verifier + replan', config: { verify: true, replan: true, maxRetries: 1, remember: false } },
]

export const TRUTH_STAGE = {
  tool_timeout: 'tool',
  empty_retrieval: 'retrieval',
  irrelevant_retrieval: 'retrieval',
  hallucinated_claim: 'reasoning',
}

export const EVAL_TASKS = [
  // Calculator
  { id: 'calc-1', category: 'calculator', query: 'What is 1200 * 1.18?', expectedTool: 'calculator', all: ['1,?416'] },
  { id: 'calc-2', category: 'calculator', query: 'Calculate 18% of 2500', expectedTool: 'calculator', all: ['\\b450\\b'] },
  { id: 'calc-3', category: 'calculator', query: 'What is 15% of 80?', expectedTool: 'calculator', all: ['\\b12\\b'] },
  { id: 'calc-4', category: 'calculator', query: 'What is 2500 + 340?', expectedTool: 'calculator', all: ['2,?840'] },
  { id: 'calc-5', category: 'calculator', query: 'What is 144 / 12?', expectedTool: 'calculator', all: ['\\b12\\b'] },
  { id: 'calc-6', category: 'calculator', query: 'What is 7.5% of 640?', expectedTool: 'calculator', all: ['\\b48\\b'] },

  // Database
  { id: 'db-1', category: 'database', query: 'How many open tickets does Daniel Osei have?', expectedTool: 'database', all: ['Daniel', '\\b5\\b'] },
  { id: 'db-2', category: 'database', query: 'What tier is Aarti Deshmukh on?', expectedTool: 'database', all: ['Enterprise'] },
  { id: 'db-3', category: 'database', query: "Show me Leena Kapoor's account", expectedTool: 'database', all: ['Starter'] },
  { id: 'db-4', category: 'database', query: 'Which plan is Rohan Mehta on?', expectedTool: 'database', all: ['Growth'] },
  {
    id: 'db-5',
    category: 'database',
    query: 'Tell me about customer Zorbax Quillfeather',
    expectedTool: 'database',
    all: ['no customer|not found|did not match'],
    forbid: ['Enterprise tier|Growth tier|Starter tier'],
  },

  // Text analysis
  {
    id: 'doc-1',
    category: 'document',
    query: 'Summarize this text: The Observatory stores each run as a trace made of spans. Each span records timing, inputs, outputs and errors. Traces can be inspected later.',
    expectedTool: 'external_api',
    all: ['span', 'trace'],
  },
  {
    id: 'doc-2',
    category: 'document',
    query: 'Analyze this text and list the key points: Postgres with pgvector stores embeddings and answers similarity queries using HNSW indexes.',
    expectedTool: 'external_api',
    all: ['pgvector|HNSW'],
  },
  {
    id: 'doc-3',
    category: 'document',
    query: 'Analyze the tone of this text: I loved the fast setup but the documentation was confusing and support was slow.',
    expectedTool: 'external_api',
    all: ['mixed|both|positive', 'negative|confus|slow'],
  },

  // Web search
  { id: 'web-1', category: 'web_search', query: 'What is pgvector?', expectedTool: 'web_search', all: ['vector', 'postgres'] },
  { id: 'web-2', category: 'web_search', query: 'What is the HNSW index in pgvector?', expectedTool: 'web_search', all: ['graph|hierarch|nearest'] },
  { id: 'web-3', category: 'web_search', query: 'Who created the Python programming language?', expectedTool: 'web_search', all: ['Guido'] },
  { id: 'web-4', category: 'web_search', query: 'What is the capital of Australia?', expectedTool: 'web_search', all: ['Canberra'] },
  { id: 'web-5', category: 'web_search', query: 'What does the Groq API provide?', expectedTool: 'web_search', all: ['Groq', 'inference|LPU|API'] },
  { id: 'web-6', category: 'web_search', query: 'What is retrieval augmented generation?', expectedTool: 'web_search', all: ['retriev', 'generat'] },

  // Injected failures (web search only)
  {
    id: 'inj-hallucination-1',
    category: 'injected',
    query: 'What is pgvector?',
    expectedTool: 'web_search',
    inject: 'hallucinated_claim',
    all: ['vector'],
    forbid: ['Atlantis|Napoleon'],
  },
  {
    id: 'inj-hallucination-2',
    category: 'injected',
    query: 'What is retrieval augmented generation?',
    expectedTool: 'web_search',
    inject: 'hallucinated_claim',
    all: ['retriev'],
    forbid: ['Atlantis|Napoleon'],
  },
  {
    id: 'inj-wrong-sources',
    category: 'injected',
    query: 'Who created the Python programming language?',
    expectedTool: 'web_search',
    inject: 'irrelevant_retrieval',
    all: ['Guido'],
  },
  {
    id: 'inj-empty-search',
    category: 'injected',
    query: 'What is the capital of Australia?',
    expectedTool: 'web_search',
    inject: 'empty_retrieval',
    all: ['Canberra'],
  },
  {
    id: 'inj-tool-timeout',
    category: 'injected',
    query: 'What is pgvector?',
    expectedTool: 'web_search',
    inject: 'tool_timeout',
    all: ['vector'],
  },
]

// Returns { ok, reason } for a final answer. Reference-based and deliberately
// simple: it checks for required and forbidden content, nothing subjective.
export function gradeAnswer(task, answer) {
  const text = String(answer || '')
  if (!text.trim()) return { ok: false, reason: 'No answer was produced' }
  for (const source of task.all || []) {
    if (!new RegExp(source, 'i').test(text)) return { ok: false, reason: `Answer is missing /${source}/` }
  }
  for (const source of task.forbid || []) {
    if (new RegExp(source, 'i').test(text)) return { ok: false, reason: `Answer contains forbidden /${source}/` }
  }
  return { ok: true, reason: null }
}

// Reads where the first attempt went wrong, using only what the trace recorded.
// Returns 'tool', 'retrieval', 'reasoning', or 'none'.
export function diagnoseStage(spans) {
  const first = (spans || []).filter((span) => (span.attempt || 1) === 1)
  const tool = first.find((span) => span.name.startsWith('tool:'))
  if (tool?.status === 'error') return 'tool'
  if (tool && tool.output?.sourceCount === 0) return 'retrieval'
  if (typeof tool?.output?.relevance === 'number' && tool.output.relevance < 0.2) return 'retrieval'
  const verify = first.find((span) => span.name === 'verification')
  if (verify?.output?.unsupported?.length) return 'reasoning'
  return 'none'
}
