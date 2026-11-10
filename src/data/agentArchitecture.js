// Central definition of the 8 pipeline nodes and 4 tools (12 in total).
// Positions are laid out as a 3D network (not a flat line) so the
// architecture reads as infrastructure rather than a flowchart.

// One colour per role; nodes take their colour from their role so the
// legend is always accurate. Red is reserved for the retry edge and failures.
export const ROLES = [
  { id: 'input', label: 'Input', hint: 'Your question and what it is asking for', color: '#efe6d6' },
  { id: 'planning', label: 'Planning', hint: 'Decides the steps and which tool to use', color: '#e6b450' },
  { id: 'memory', label: 'Memory', hint: 'Answers from earlier runs (pgvector)', color: '#c3a6d8' },
  { id: 'tools', label: 'Tools', hint: 'Web search, database, calculator, text analysis', color: '#e8925a' },
  { id: 'reasoning', label: 'Reasoning', hint: 'The language model writes the answer', color: '#8fc7b5' },
  { id: 'verification', label: 'Fact-check', hint: 'Checks every claim against the sources', color: '#a9bfe3' },
  { id: 'output', label: 'Output', hint: 'The final answer', color: '#7cc495' },
]

export const ROLE_COLOR = Object.fromEntries(ROLES.map((role) => [role.id, role.color]))

const BASE_NODES = [
  {
    id: 'user',
    label: 'USER',
    position: [-7, 2.2, 3],
    role: 'input',
    description: 'The human entry point that issues a natural-language request into the agent system.',
    status: 'IDLE',
    tech: 'Captures raw input and forwards it as an unstructured request payload to Intent Detection.',
  },
  {
    id: 'intent',
    label: 'INTENT DETECTION',
    position: [-4, 0.6, 5.2],
    role: 'input',
    description: 'Classifies what the user actually wants — the task type behind the words.',
    status: 'IDLE',
    tech: 'Runs a lightweight classification pass (embedding similarity or small LLM call) to tag intent + extract slots.',
  },
  {
    id: 'planner',
    label: 'PLANNER',
    position: [-1, -0.4, 2.5],
    role: 'planning',
    description: 'Breaks the intent into an ordered sequence of executable steps.',
    status: 'IDLE',
    tech: 'Produces a directed task graph, deciding which tools and context sources are needed, and in what order.',
  },
  {
    id: 'toolhub',
    label: 'TOOL HUB',
    position: [2.2, -0.6, 4.6],
    role: 'tools',
    description: 'Central orchestrator that routes planner steps to the right external tool.',
    status: 'IDLE',
    tech: 'Dispatches function-calling requests to registered tools via schema-validated input/output contracts.',
  },
  {
    id: 'memory',
    label: 'MEMORY',
    position: [0.5, 1.6, -2.4],
    role: 'memory',
    description: 'Long-term vector store holding prior conversations, documents, and user context.',
    status: 'IDLE',
    tech: 'Performs embedding similarity search (top-K retrieval) over a vector index to assemble relevant context.',
  },
  {
    id: 'llm',
    label: 'LLM / REASONING ENGINE',
    position: [4.4, 1.8, -0.4],
    role: 'reasoning',
    description: 'The core model that reasons over assembled context to produce a decision or answer.',
    status: 'IDLE',
    tech: 'Receives an assembled context window (system + query + memory + tool results) and generates the output.',
  },
  {
    id: 'verifier',
    label: 'VERIFIER',
    position: [6.0, 2.3, 1.15],
    role: 'verification',
    description: 'A second pass that checks each bullet against the retrieved sources.',
    status: 'IDLE',
    tech: 'Marks a claim supported only when the same fact appears in a source the tool just retrieved.',
  },
  {
    id: 'response',
    label: 'RESPONSE',
    position: [7.6, 2.7, 2.8],
    role: 'output',
    description: 'The final answer delivered back to the user.',
    status: 'IDLE',
    tech: 'Formats and streams the model output back through the interface to the originating request.',
  },
]

export const NODES = BASE_NODES.map((node) => ({ ...node, color: ROLE_COLOR[node.role] }))

export const TOOLS = [
  {
    id: 'web_search',
    label: 'WEB SEARCH',
    parent: 'toolhub',
    position: [4.6, -2.4, 7.4],
    role: 'tools',
    color: ROLE_COLOR.tools,
  },
  {
    id: 'database',
    label: 'DATABASE',
    parent: 'toolhub',
    position: [1.0, -2.8, 7.0],
    role: 'tools',
    color: ROLE_COLOR.tools,
  },
  {
    id: 'calculator',
    label: 'CALCULATOR',
    parent: 'toolhub',
    position: [3.4, -3.4, 3.2],
    role: 'tools',
    color: ROLE_COLOR.tools,
  },
  {
    id: 'external_api',
    label: 'EXTERNAL API',
    parent: 'toolhub',
    position: [0.2, -3.2, 3.6],
    role: 'tools',
    color: ROLE_COLOR.tools,
  },
]

// Main pipeline edges, in the order the server runs them: memory is
// searched before the tool is called (see the span order in /api/agent).
export const CONNECTIONS = [
  ['user', 'intent'],
  ['intent', 'planner'],
  ['planner', 'memory'],
  ['memory', 'toolhub'],
  ['toolhub', 'llm'],
  ['llm', 'verifier'],
  ['verifier', 'response'],
]

export const TOOL_CONNECTIONS = TOOLS.map((t) => [t.parent, t.id])

const ZONE_NAMES = {
  user: 'User space',
  intent: 'Intent space',
  planner: 'Planner space',
  toolhub: 'Tool space',
  web_search: 'Tool space · Web search',
  database: 'Tool space · Database',
  calculator: 'Tool space · Calculator',
  external_api: 'Tool space · External API',
  memory: 'Memory space',
  llm: 'Reasoning space',
  verifier: 'Verifier space',
  response: 'Response space',
}

const roleOf = (id) => BASE_NODES.find((node) => node.id === id)?.role || 'tools'

export const ZONES = Object.fromEntries(
  Object.entries(ZONE_NAMES).map(([id, name]) => [id, { name, color: ROLE_COLOR[roleOf(id)] }])
)