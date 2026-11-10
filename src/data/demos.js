// Guided "break it yourself" demos. Each one runs a normal question with one
// failure planted on purpose, using the agent's existing failure injection.
// `fixed` decides the honest outcome shown at the end of the demo.
export const DEMOS = [
  {
    id: 'hallucinated_claim',
    title: 'Fake fact',
    icon: '🎭',
    query: 'What is pgvector?',
    plant: 'A made-up sentence about "Atlantis Holdings" and Napoleon is slipped into the first answer.',
    watch: 'The fact-checker compares every claim with the web pages. The fake one is not in any of them.',
    fixed: (answer) => Boolean(answer) && !/atlantis|napoleon/i.test(answer),
    fixedText: 'The fake sentence is gone from the final answer.',
  },
  {
    id: 'empty_retrieval',
    title: 'Search finds nothing',
    icon: '🕳️',
    query: 'What is the capital of Australia?',
    plant: 'The first web search is forced to come back empty.',
    watch: 'With nothing to read, the agent should not guess. It should search again.',
    fixed: (answer) => /canberra/i.test(answer || ''),
    fixedText: 'The final answer says Canberra, found on a second search.',
  },
  {
    id: 'irrelevant_retrieval',
    title: 'Wrong web pages',
    icon: '🧭',
    query: 'Who created the Python programming language?',
    plant: 'The search results are swapped for pages about medieval pottery.',
    watch: 'The pages barely mention the question, so the agent should notice they are off-topic.',
    fixed: (answer) => /guido/i.test(answer || ''),
    fixedText: 'The final answer names Guido van Rossum, from the right pages.',
  },
  {
    id: 'tool_timeout',
    title: 'Tool crashes',
    icon: '⏱️',
    query: 'What is pgvector?',
    plant: 'The search tool is made to time out on the first try.',
    watch: 'A crashed tool should be retried instead of ending the run.',
    fixed: (answer) => /vector/i.test(answer || ''),
    fixedText: 'The search ran again and the agent answered normally.',
  },
]

export const demoById = (id) => DEMOS.find((demo) => demo.id === id) || null
