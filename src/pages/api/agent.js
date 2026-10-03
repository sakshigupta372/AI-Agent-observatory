import { classify } from '../../data/scenarios.js'

const GROQ_API_KEY = import.meta.env.GROQ_API_KEY
const TAVILY_API_KEY = import.meta.env.TAVILY_API_KEY

async function tavilySearch(query) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      max_results: 5,
    }),
  })
  if (!res.ok) throw new Error(`Tavily error: ${res.status}`)
  const data = await res.json()
  return (data.results ?? [])
    .map((r, i) => `${i + 1}. ${r.title} — ${r.content}`)
    .join('\n')
}

async function askGroq(query, scenario, toolContext) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content:
            'You are the reasoning engine of an autonomous AI agent pipeline called the AI Agent Observatory. ' +
            'You are given the user request plus context already retrieved by upstream tools. ' +
            'Respond with a concise, confident final answer in 2-4 sentences, as the agent speaking directly to the user. ' +
            'Do not mention that you are an AI model or describe the pipeline internals.',
        },
        {
          role: 'user',
          content: `User request: ${query}\n\nIntent: ${scenario.intentLabel}\nTool used: ${scenario.tool}\nRetrieved context:\n${toolContext}\n\nRespond with the final answer only.`,
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Groq error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

export async function POST({ request }) {
  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const query = typeof body?.query === 'string' ? body.query.trim() : ''
  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query' }), { status: 400 })
  }

  const scenario = classify(query)

  let toolContext = scenario.mockContext
  if (scenario.tool === 'web_search') {
    try {
      toolContext = await tavilySearch(query)
    } catch {
      toolContext = scenario.mockContext
    }
  }

  try {
    const response = await askGroq(query, scenario, toolContext)
    return new Response(
      JSON.stringify({ response, intentLabel: scenario.intentLabel, tool: scenario.tool }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Agent reasoning failed', detail: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
