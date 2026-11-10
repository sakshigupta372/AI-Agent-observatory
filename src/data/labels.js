// Every user-facing name for the agent's parts, in one place. "simple" is for
// first-time visitors; "technical" is the engineering name. `short` is used on
// narrow canvases where the full technical name does not fit.

export const VIEW_MODES = ['simple', 'technical']

const NODE_LABELS = {
  user: { simple: 'You', technical: 'USER' },
  intent: { simple: 'Understand', technical: 'INTENT DETECTION', short: 'INTENT' },
  planner: { simple: 'Plan', technical: 'PLANNER' },
  memory: { simple: 'Memory', technical: 'MEMORY' },
  toolhub: { simple: 'Tools', technical: 'TOOL HUB' },
  llm: { simple: 'Reasoning', technical: 'LLM / REASONING ENGINE', short: 'LLM' },
  verifier: { simple: 'Fact-check', technical: 'VERIFIER' },
  response: { simple: 'Answer', technical: 'RESPONSE' },
  web_search: { simple: 'Web search', technical: 'WEB SEARCH', short: 'WEB' },
  database: { simple: 'Customer data', technical: 'DATABASE' },
  calculator: { simple: 'Calculator', technical: 'CALCULATOR' },
  external_api: { simple: 'Text analysis', technical: 'EXTERNAL API', short: 'TEXT API' },
}

export function nodeLabel(id, mode = 'simple') {
  const entry = NODE_LABELS[id]
  if (!entry) return { text: id, short: undefined }
  return mode === 'technical' ? { text: entry.technical, short: entry.short } : { text: entry.simple, short: undefined }
}

// Trace span names (as recorded by the server) in plain words.
const STEP_NAMES = {
  plan: 'Plan',
  memory_retrieval: 'Memory lookup',
  reasoning: 'Write answer',
  verification: 'Fact-check',
  replan: 'Retry plan',
}

const TOOL_NAMES = {
  web_search: 'Web search',
  calculator: 'Calculator',
  database: 'Customer database',
  external_api: 'Text analysis',
}

export const toolName = (tool) => TOOL_NAMES[tool] || tool
export const stepName = (name) => (name?.startsWith('tool:') ? toolName(name.slice(5)) : STEP_NAMES[name] || name)

// Failure modes a visitor can force, in the order shown in the picker.
export const INJECTIONS = [
  { value: '', label: 'None', hint: 'Run normally' },
  { value: 'tool_timeout', label: 'Search timeout', hint: 'The tool stops responding' },
  { value: 'hallucinated_claim', label: 'Wrong fact', hint: 'A made-up claim is slipped into the answer' },
  { value: 'irrelevant_retrieval', label: 'Wrong pages', hint: 'The search returns off-topic pages' },
  { value: 'empty_retrieval', label: 'Empty search', hint: 'The search returns nothing' },
]
