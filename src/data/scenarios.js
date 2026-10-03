// Maps a free-text query to a scripted intent + tool + response, and
// expands that into the ordered list of pipeline steps the execution
// engine walks through. The 3D pipeline timing is scripted; the final
// RESPONSE text is generated for real by the backend (see /api/agent),
// using mockContext as tool output for tools that aren't wired to a real
// API (only Web Search hits a real search API).

const TOOL_LABELS = {
  web_search: 'WEB SEARCH',
  database: 'DATABASE',
  calculator: 'CALCULATOR',
  external_api: 'EXTERNAL API',
}

const TOP_K = 5
const SIM_THRESHOLD = 0.78

const SCENARIOS = [
  {
    match: /job|career|hiring|engineer|bangalore/i,
    intentLabel: 'Job Search',
    tool: 'web_search',
    memoryCluster: 'jobs',
    mockContext: '37 AI Engineer listings indexed, posted within the last 14 days.',
    response: '37 matching AI Engineer roles found in Bangalore. Top 5 ranked by relevance and recency.',
    tasks: [
      'Understand job requirements',
      'Search job sources',
      'Filter Bangalore listings',
      'Extract requirements',
      'Rank results',
      'Generate summary',
    ],
  },
  {
    match: /roi|return on investment|invest/i,
    intentLabel: 'Financial Calculation',
    tool: 'calculator',
    memoryCluster: 'projects',
    mockContext: 'Inputs: initial investment $50,000, projected returns $59,200 over 12 months.',
    response: 'Projected ROI: 18.4% over 12 months, based on the provided cash flow inputs.',
    tasks: ['Parse financial inputs', 'Compute cash flow', 'Calculate ROI', 'Generate summary'],
  },
  {
    match: /news|latest|headline/i,
    intentLabel: 'Web Search',
    tool: 'web_search',
    memoryCluster: 'conversations',
    mockContext: '12 recent AI news articles indexed, covering model releases and funding.',
    response: '12 recent AI news articles retrieved and summarized, covering model releases and funding.',
    tasks: ['Understand query', 'Search web sources', 'Filter recent articles', 'Summarize findings'],
  },
  {
    match: /customer|client|account/i,
    intentLabel: 'Customer Lookup',
    tool: 'database',
    memoryCluster: 'users',
    mockContext: 'Customer record #48291: 3 open support tickets, last contact 5 days ago, tier: Enterprise.',
    response: 'Customer record found: 3 open tickets, last contact 5 days ago, tier: Enterprise.',
    tasks: ['Parse customer query', 'Query customer database', 'Compile ticket history', 'Generate summary'],
  },
  {
    match: /document|file|report|pdf|analy/i,
    intentLabel: 'Document Analysis',
    tool: 'external_api',
    memoryCluster: 'documents',
    mockContext: 'Document contains 4 sections: Summary, Requirements, Risks, Recommendations. Sentiment: neutral.',
    response: 'Document analyzed: 4 key sections extracted, sentiment neutral, 2 action items identified.',
    tasks: ['Parse document', 'Extract sections', 'Analyze sentiment', 'Identify action items', 'Generate summary'],
  },
]

const DEFAULT_SCENARIO = {
  intentLabel: 'General Query',
  tool: 'web_search',
  memoryCluster: 'preferences',
  mockContext: 'No specialized tool context available for this request.',
  response: 'Request processed. Relevant information has been compiled and summarized.',
  tasks: ['Understand request', 'Gather information', 'Generate summary'],
}

export const EXAMPLE_PROMPTS = [
  'Find AI Engineer jobs in Bangalore',
  'Calculate the ROI of this investment',
  'Search the web for the latest AI news',
  'Find information about this customer',
  'Analyze this document',
]

export function classify(query) {
  return SCENARIOS.find((s) => s.match.test(query)) ?? DEFAULT_SCENARIO
}

// Every step explicitly declares activeNode/connection/activeTool (using
// null where not applicable) so the execution reducer never has to guess
// whether to carry over previous state.
export function buildSteps(query) {
  const scenario = classify(query)
  const toolId = scenario.tool
  const toolLabel = TOOL_LABELS[toolId]
  const plannerDuration = 500 + scenario.tasks.length * 450

  return [
    { id: 'user', duration: 500, activeNode: 'user', connection: null, activeTool: null, label: 'Incoming request', trace: 'REQUEST_RECEIVED' },
    { id: 'to-intent', duration: 700, activeNode: null, connection: ['user', 'intent'], activeTool: null, label: 'Incoming request' },
    { id: 'intent', duration: 600, activeNode: 'intent', connection: null, activeTool: null, label: `Intent: ${scenario.intentLabel}`, trace: 'INTENT_DETECTED' },
    { id: 'to-planner', duration: 700, activeNode: null, connection: ['intent', 'planner'], activeTool: null, label: `Intent: ${scenario.intentLabel}` },
    { id: 'planner', duration: plannerDuration, activeNode: 'planner', connection: null, activeTool: null, label: 'Planning tool execution...', trace: 'PLAN_CREATED', planner: { tasks: scenario.tasks } },
    { id: 'to-toolhub', duration: 700, activeNode: null, connection: ['planner', 'toolhub'], activeTool: null, label: 'Planning tool execution...' },
    { id: 'toolhub', duration: 500, activeNode: 'toolhub', connection: null, activeTool: null, label: `Routing to ${toolLabel}`, trace: `TOOL_SELECTED: ${toolLabel}` },
    { id: 'to-tool', duration: 900, activeNode: null, connection: ['toolhub', toolId], activeTool: toolId, packetCount: 3, label: `${toolLabel} executing...`, trace: 'TOOL_EXECUTION_STARTED' },
    { id: 'tool-result', duration: 700, activeNode: null, connection: [toolId, 'toolhub'], activeTool: toolId, label: 'Results received', trace: 'TOOL_RESPONSE_RECEIVED' },
    { id: 'to-memory', duration: 700, activeNode: null, connection: ['toolhub', 'memory'], activeTool: null, label: 'Results received' },
    { id: 'memory', duration: 700, activeNode: 'memory', connection: null, activeTool: null, label: 'Retrieving relevant context...', trace: 'MEMORY_RETRIEVAL', memory: { clusterId: scenario.memoryCluster, topK: TOP_K, threshold: SIM_THRESHOLD } },
    { id: 'to-llm', duration: 700, activeNode: null, connection: ['memory', 'llm'], activeTool: null, label: 'Retrieving relevant context...' },
    { id: 'llm', duration: 900, activeNode: 'llm', connection: null, activeTool: null, label: 'Generating response...', trace: 'LLM_REASONING' },
    { id: 'to-response', duration: 700, activeNode: null, connection: ['llm', 'response'], activeTool: null, label: 'Generating response...' },
    { id: 'response', duration: 300, activeNode: 'response', connection: null, activeTool: null, label: 'Response ready', final: true, response: scenario.response, trace: 'RESPONSE_GENERATED' },
  ]
}
