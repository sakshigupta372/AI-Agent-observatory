// Central definition of the 7 core nodes in the agent pipeline.
// Positions are laid out as a 3D network (not a flat line) so the
// architecture reads as infrastructure rather than a flowchart.

export const NODES = [
  {
    id: 'user',
    label: 'USER',
    position: [-7, 2.2, 3],
    color: '#6ea8ff',
    description: 'The human entry point that issues a natural-language request into the agent system.',
    status: 'IDLE',
    tech: 'Captures raw input and forwards it as an unstructured request payload to Intent Detection.',
  },
  {
    id: 'intent',
    label: 'INTENT DETECTION',
    position: [-4, 0.6, 5.2],
    color: '#8fd3ff',
    description: 'Classifies what the user actually wants — the task type behind the words.',
    status: 'IDLE',
    tech: 'Runs a lightweight classification pass (embedding similarity or small LLM call) to tag intent + extract slots.',
  },
  {
    id: 'planner',
    label: 'PLANNER',
    position: [-1, -0.4, 2.5],
    color: '#a78bff',
    description: 'Breaks the intent into an ordered sequence of executable steps.',
    status: 'IDLE',
    tech: 'Produces a directed task graph, deciding which tools and context sources are needed, and in what order.',
  },
  {
    id: 'toolhub',
    label: 'TOOL HUB',
    position: [2.2, -0.6, 4.6],
    color: '#ffb168',
    description: 'Central orchestrator that routes planner steps to the right external tool.',
    status: 'IDLE',
    tech: 'Dispatches function-calling requests to registered tools via schema-validated input/output contracts.',
  },
  {
    id: 'memory',
    label: 'MEMORY',
    position: [0.5, 1.6, -2.4],
    color: '#ff8fd0',
    description: 'Long-term vector store holding prior conversations, documents, and user context.',
    status: 'IDLE',
    tech: 'Performs embedding similarity search (top-K retrieval) over a vector index to assemble relevant context.',
  },
  {
    id: 'llm',
    label: 'LLM / REASONING ENGINE',
    position: [4.4, 1.8, -0.4],
    color: '#6effc7',
    description: 'The core model that reasons over assembled context to produce a decision or answer.',
    status: 'IDLE',
    tech: 'Receives an assembled context window (system + query + memory + tool results) and generates the output.',
  },
  {
    id: 'response',
    label: 'RESPONSE',
    position: [7.2, 2.6, 2.4],
    color: '#6effc7',
    description: 'The final answer delivered back to the user.',
    status: 'IDLE',
    tech: 'Formats and streams the model output back through the interface to the originating request.',
  },
]

export const TOOLS = [
  {
    id: 'web_search',
    label: 'WEB SEARCH',
    parent: 'toolhub',
    position: [4.6, -2.4, 7.4],
    color: '#ffb168',
  },
  {
    id: 'database',
    label: 'DATABASE',
    parent: 'toolhub',
    position: [1.0, -2.8, 7.0],
    color: '#ffb168',
  },
  {
    id: 'calculator',
    label: 'CALCULATOR',
    parent: 'toolhub',
    position: [3.4, -3.4, 3.2],
    color: '#ffb168',
  },
  {
    id: 'external_api',
    label: 'EXTERNAL API',
    parent: 'toolhub',
    position: [0.2, -3.2, 3.6],
    color: '#ffb168',
  },
]

// Main pipeline edges, in execution order.
export const CONNECTIONS = [
  ['user', 'intent'],
  ['intent', 'planner'],
  ['planner', 'toolhub'],
  ['toolhub', 'memory'],
  ['memory', 'llm'],
  ['llm', 'response'],
]

export const TOOL_CONNECTIONS = TOOLS.map((t) => [t.parent, t.id])
