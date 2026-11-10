// Keyword fallback when the routing model is unavailable, and the example prompts.

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
