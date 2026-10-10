import { classify } from '../../data/scenarios.js'
import { addMemory, listMemories, searchCustomers, searchMemories } from '../../server/memoryStore.js'
import { addUsage, createTracer, saveTrace } from '../../server/traces.js'

const GROQ_API_KEY = import.meta.env.GROQ_API_KEY
const TAVILY_API_KEY = import.meta.env.TAVILY_API_KEY
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'openai/gpt-oss-120b'

const TOOLS = new Set(['web_search', 'calculator', 'database', 'external_api'])
const CLUSTERS = new Set(['jobs', 'users', 'projects', 'conversations', 'documents', 'preferences'])

function todayLabel() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function isFreshQuery(query) {
  return /news|latest|today|headline|current|this week|breaking|recent|weather|score|price/i.test(query)
}

function datedQuery(query) {
  const now = new Date()
  const year = String(now.getFullYear())
  if (query.includes(year)) return query
  const month = now.toLocaleString('en-US', { month: 'long' })
  return `${query} ${month} ${year}`
}

const RETRY_STATUS = new Set([429, 500, 502, 503, 529])
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Groq asks callers to back off exponentially on 429/503, so one slow
// retry is better than surfacing a capacity blip as a failed run.
async function groqFetch(body, attempts = 3) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set')
  let lastDetail = ''
  let lastStatus = 0

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
    })
    if (res.ok) return res

    lastStatus = res.status
    lastDetail = await res.text()
    if (!RETRY_STATUS.has(res.status) || attempt === attempts - 1) break
    await sleep(600 * 2 ** attempt)
  }

  const capacity = lastStatus === 503 || lastStatus === 429
  throw new Error(
    capacity
      ? `The reasoning model is over capacity right now (Groq ${lastStatus}). The tool result below is unchanged.`
      : `Groq error ${lastStatus}: ${lastDetail.slice(0, 180)}`
  )
}

async function askGroq(messages, { jsonMode = false, temperature = 0.2, meter = null } = {}) {
  const body = {
    model: MODEL,
    temperature,
    max_tokens: 1400,
    messages,
  }
  if (jsonMode) body.response_format = { type: 'json_object' }

  const res = await groqFetch(body)
  const data = await res.json()
  addUsage(meter, data.usage)
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

function fallbackPlan(query) {
  const scenario = classify(query)
  return {
    intentLabel: scenario.intentLabel,
    tool: scenario.tool,
    memoryCluster: scenario.memoryCluster,
    tasks: scenario.tasks,
    routedBy: 'keywords',
  }
}

function sanitizePlan(raw, query) {
  const tool = TOOLS.has(raw?.tool) ? raw.tool : null
  const memoryCluster = CLUSTERS.has(raw?.memoryCluster) ? raw.memoryCluster : null
  const tasks = Array.isArray(raw?.tasks) ? raw.tasks.map(String).filter(Boolean).slice(0, 6) : []
  if (!tool || !memoryCluster || tasks.length < 2) return fallbackPlan(query)
  return {
    intentLabel: String(raw.intentLabel || 'General Query').slice(0, 60),
    tool,
    memoryCluster,
    tasks,
    routedBy: raw?.routedBy === 'keywords' ? 'keywords' : 'model',
    steered: raw?.steered === true,
  }
}

async function routeQuery(query) {
  if (isFreshQuery(query)) {
    const base = fallbackPlan(query)
    return { ...base, tool: 'web_search', routedBy: base.routedBy }
  }
  try {
    const text = await askGroq(
      [
        {
          role: 'system',
          content:
            'You route one user request through an agent observatory. Return JSON only with keys intentLabel, tool, memoryCluster, tasks. ' +
            'tool must be web_search, calculator, database, or external_api. ' +
            'memoryCluster must be jobs, users, projects, conversations, documents, or preferences. ' +
            'tasks is 3 to 6 short strings. ' +
            'Use web_search for news, current events, jobs, prices, weather, sports, and any fact that can change. ' +
            'Use calculator only for arithmetic or ROI on numbers the user typed. ' +
            'Use database only for a saved customer or account. ' +
            'Use external_api when the user asks to analyze text they provided. ' +
            'Use memoryCluster jobs for hiring, users for customers, projects for math and finance, documents for pasted text, conversations for news, and preferences for anything else.',
        },
        { role: 'user', content: query },
      ],
      { jsonMode: true, temperature: 0 }
    )
    return sanitizePlan(JSON.parse(text), query)
  } catch {
    return fallbackPlan(query)
  }
}

async function tavilyOnce(query, extra) {
  if (!TAVILY_API_KEY) throw new Error('TAVILY_API_KEY is not set')
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      max_results: 6,
      include_answer: false,
      ...extra,
    }),
  })
  if (!res.ok) {
    const detail = (await res.text()).replace(/tvly-[A-Za-z0-9_-]+/g, '[key]').slice(0, 300)
    throw new Error(`Tavily error ${res.status}: ${detail}`)
  }
  const data = await res.json()
  return (data.results ?? []).map((result) => ({
    title: result.title || 'Untitled',
    url: result.url || '',
    publishedDate: normalizeDate(result.published_date || result.publishedDate || ''),
    dateFrom: result.published_date || result.publishedDate ? 'search index' : '',
    content: String(result.content || '').slice(0, 700),
  }))
}

const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december'

function normalizeDate(value) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  if (parsed.getTime() > Date.now() + 86400000) return ''
  if (parsed.getFullYear() < 1990) return ''
  return parsed.toISOString().slice(0, 10)
}

function dateFromUrl(url) {
  const slash = url.match(/\/(20\d{2})\/(\d{1,2})\/(\d{1,2})(?:\/|$|[-_.])/)
  if (slash) return normalizeDate(`${slash[1]}-${slash[2]}-${slash[3]}`)
  const dash = url.match(/(20\d{2})-(\d{2})-(\d{2})/)
  if (dash) return normalizeDate(`${dash[1]}-${dash[2]}-${dash[3]}`)
  const monthOnly = url.match(/\/(20\d{2})\/(\d{1,2})\//)
  if (monthOnly) return normalizeDate(`${monthOnly[1]}-${monthOnly[2]}-01`)
  return ''
}

function dateFromText(text) {
  if (!text) return ''
  const iso = text.match(/(20\d{2})-(\d{2})-(\d{2})/)
  if (iso) return normalizeDate(iso[0])
  const longForm = text.match(new RegExp(`(${MONTHS})\\s+(\\d{1,2}),?\\s+(20\\d{2})`, 'i'))
  if (longForm) return normalizeDate(`${longForm[1]} ${longForm[2]}, ${longForm[3]}`)
  const dayFirst = text.match(new RegExp(`(\\d{1,2})\\s+(${MONTHS})\\s+(20\\d{2})`, 'i'))
  if (dayFirst) return normalizeDate(`${dayFirst[2]} ${dayFirst[1]}, ${dayFirst[3]}`)
  return ''
}

const PAGE_DATE_PATTERNS = [
  [/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)/i, 'page metadata'],
  [/<meta[^>]+name=["'](?:date|pubdate|publish-date|publication_date|DC\.date\.issued)["'][^>]+content=["']([^"']+)/i, 'page metadata'],
  [/<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)/i, 'page metadata'],
  [/"datePublished"\s*:\s*"([^"]+)"/i, 'page metadata'],
  [/<meta[^>]+property=["']article:modified_time["'][^>]+content=["']([^"']+)/i, 'last updated'],
  [/"dateModified"\s*:\s*"([^"]+)"/i, 'last updated'],
  [/last edited on\s*([0-9]{1,2}\s+[A-Za-z]+\s+20[0-9]{2})/i, 'last edited'],
  [/last modified on\s*([0-9]{1,2}\s+[A-Za-z]+\s+20[0-9]{2})/i, 'last edited'],
  [/<time[^>]+datetime=["']([^"']+)/i, 'page timestamp'],
]

async function dateFromPage(url) {
  if (!url) return null
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgentObservatory/1.0)' },
      signal: AbortSignal.timeout(3500),
    })
    if (!res.ok) return null
    const html = (await res.text()).slice(0, 200000)
    for (const [pattern, label] of PAGE_DATE_PATTERNS) {
      const match = html.match(pattern)
      const normalized = normalizeDate(match?.[1] || '')
      if (normalized) return { date: normalized, label }
    }
    return null
  } catch {
    return null
  }
}

// Tavily only reports published_date for news-topic hits, so recover the
// date from the URL, the snippet, then the page's own metadata.
async function enrichDates(sources) {
  return Promise.all(
    sources.map(async (source) => {
      if (source.publishedDate) return source

      const fromUrl = dateFromUrl(source.url)
      if (fromUrl) return { ...source, publishedDate: fromUrl, dateFrom: 'URL' }

      const fromText = dateFromText(source.content)
      if (fromText) return { ...source, publishedDate: fromText, dateFrom: 'page text' }

      const fromPage = await dateFromPage(source.url)
      if (fromPage) return { ...source, publishedDate: fromPage.date, dateFrom: fromPage.label }

      return { ...source, publishedDate: '', dateFrom: '' }
    })
  )
}

async function tavilySearch(query) {
  const fresh = isFreshQuery(query)
  const searchQuery = fresh ? datedQuery(query) : query
  const attempts = fresh
    ? [
        { topic: 'news', days: 3 },
        { topic: 'news', days: 7 },
        { topic: 'news', time_range: 'month' },
      ]
    : [
        { topic: 'general', time_range: 'month' },
        { topic: 'general' },
      ]

  let lastError = null
  for (const extra of attempts) {
    try {
      const results = await tavilyOnce(searchQuery, extra)
      if (results.length) return { results: await enrichDates(results), window: extra.time_range || 'open' }
    } catch (err) {
      lastError = err
    }
  }
  if (lastError && !fresh) throw lastError
  if (lastError) throw lastError
  return { results: [], window: 'none' }
}

function formatSources(sources) {
  if (!sources.length) return 'No sources were retrieved.'
  return sources
    .map((source, index) => {
      const date = source.publishedDate
        ? `${source.publishedDate} (from ${source.dateFrom})`
        : 'the source page does not publish a date'
      return `${index + 1}. ${source.title}\nPublished: ${date}\nURL: ${source.url}\n${source.content}`
    })
    .join('\n\n')
}

function customerSummary(rows) {
  const lines = rows.map(
    (row) =>
      `- ${row.name} — ${row.tier} tier, ${row.openTickets} open ticket(s), last contact ${row.lastContact || 'unknown'}`
  )
  return `Matching customer records from Postgres\n${lines.join('\n')}`
}

function sourceSummary(sources) {
  const lines = sources.slice(0, 4).map((source) => {
    const date = source.publishedDate || 'no date on the source page'
    return `${source.title} (${date})`
  })
  return `Newest matching sources\n${lines.map((line) => `- ${line}`).join('\n')}`
}

// Small recursive-descent evaluator (no eval). Supports + - * / parentheses,
// unary minus, and percent literals: "100 + 18%" adds 18% of the left side,
// while a bare "18%" elsewhere means 0.18.
function evaluateExpression(text) {
  const tokens = text.match(/\d+(?:\.\d+)?%?|[()+\-*/]/g) || []
  if (!tokens.length || tokens.join('') !== text.replace(/\s+/g, '')) return null
  let i = 0
  const peek = () => tokens[i]

  const factor = () => {
    const token = tokens[i++]
    if (token === undefined) throw new Error('incomplete')
    if (token === '(') {
      const inner = expr()
      if (tokens[i++] !== ')') throw new Error('unbalanced')
      return { value: inner.value, pct: false }
    }
    if (token === '-') return { value: -factor().value, pct: false }
    if (/^\d/.test(token)) {
      return token.endsWith('%')
        ? { value: parseFloat(token) / 100, pct: true }
        : { value: Number(token), pct: false }
    }
    throw new Error('unexpected')
  }

  const term = () => {
    let left = factor()
    while (peek() === '*' || peek() === '/') {
      const op = tokens[i++]
      const right = factor()
      if (op === '/' && right.value === 0) throw new Error('zero')
      left = { value: op === '*' ? left.value * right.value : left.value / right.value, pct: false }
    }
    return left
  }

  const expr = () => {
    let left = term()
    while (peek() === '+' || peek() === '-') {
      const op = tokens[i++]
      const right = term()
      const amount = right.pct ? left.value * right.value : right.value
      left = { value: op === '+' ? left.value + amount : left.value - amount, pct: false }
    }
    return left
  }

  const result = expr()
  return i === tokens.length ? result.value : null
}

// Turns phrasing like "18% GST on 45,000 plus a 2% fee" into arithmetic.
// Returns null when the query is not a calculation it can fully account for,
// so the caller can fall back to the simple pattern or ask for numbers.
function computeNatural(query) {
  let text = query
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/[₹$]|\brs\.?(?=\s*\d)|\binr\b/g, ' ')
    .replace(/(\d+(?:\.\d+)?)\s*%\s*(?:[a-z]+\s+)?(?:of|on)\s+(\d+(?:\.\d+)?)/g, '(($2)*($1)/100)')
    .replace(/\b(?:plus|added to|add)\b/g, '+')
    .replace(/\b(?:minus|less|subtract(?:ed)?)\b/g, '-')
    .replace(/\b(?:multiplied by|times)\b|×/g, '*')
    .replace(/\b(?:divided by|over)\b|÷/g, '/')
    .replace(/(?<=\d)\s*x\s*(?=\d)/g, '*')

  text = text.replace(/[^0-9.%+\-*/()\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!/[+\-*/]/.test(text)) return null

  try {
    const value = evaluateExpression(text)
    if (value === null || !Number.isFinite(value)) return null
    const shown = Number(value.toFixed(4)).toLocaleString('en-US', { maximumFractionDigits: 4 })
    return `Result from the numbers you typed\n- ${text.replace(/\s+/g, ' ')} = ${shown}`
  } catch (error) {
    return error.message === 'zero' ? 'Cannot divide by zero.' : null
  }
}

function compute(query) {
  const numbers = [...query.matchAll(/-?\d[\d,]*(?:\.\d+)?%?/g)]
    .map((match) => {
      const raw = match[0].replace(/,/g, '')
      const percent = raw.endsWith('%')
      const value = Number(raw.replace('%', ''))
      return percent ? value / 100 : value
    })
    .filter((value) => Number.isFinite(value))

  if (/roi|return on investment/i.test(query)) {
    if (numbers.length < 2) {
      return 'Type both amounts, for example "ROI of 50000 returning 62000". No result was invented.'
    }
    const [initial, finalValue] = numbers
    if (initial === 0) return 'ROI is undefined because the initial amount is 0.'
    const gain = finalValue - initial
    const roi = (gain / initial) * 100
    return [
      'ROI from the numbers you typed',
      `- Initial: ${initial.toLocaleString('en-US')}`,
      `- Final: ${finalValue.toLocaleString('en-US')}`,
      `- Gain: ${gain.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      `- ROI: ${roi.toFixed(2)}%`,
    ].join('\n')
  }

  const natural = computeNatural(query)
  if (natural) return natural

  const expr = query.match(/(-?\d[\d,]*(?:\.\d+)?)\s*([+\-*/x×÷])\s*(-?\d[\d,]*(?:\.\d+)?)/)
  if (!expr) {
    return 'No complete calculation was found. Include the numbers, for example "1200 * 1.18".'
  }
  const a = Number(expr[1].replace(/,/g, ''))
  const b = Number(expr[3].replace(/,/g, ''))
  const op = expr[2]
  if ((op === '/' || op === '÷') && b === 0) return 'Cannot divide by zero.'
  const value =
    op === '+' ? a + b : op === '-' ? a - b : op === '*' || op === 'x' || op === '×' ? a * b : a / b
  return `Result from the numbers you typed\n- ${a} ${op} ${b} = ${Number(value.toFixed(4))}`
}

async function runTool(query, plan) {
  const started = performance.now()
  if (plan.tool === 'calculator') {
    return {
      sources: [],
      toolContext: compute(query),
      searchMs: Math.round(performance.now() - started),
      answerFrom: 'calculator',
    }
  }

  if (plan.tool === 'database') {
    const rows = await searchCustomers(query)
    const toolContext = rows.length
      ? rows
          .map(
            (row) =>
              `${row.name} <${row.email}> — ${row.tier} tier, ${row.openTickets} open ticket(s), last contact ${row.lastContact || 'unknown'}. ${row.notes}`
          )
          .join('\n')
      : 'No customer matched this query in the Postgres customers table. Do not invent a customer, ticket count, or account tier.'
    return {
      sources: [],
      toolContext,
      rows,
      searchMs: Math.round(performance.now() - started),
      answerFrom: 'database',
    }
  }

  if (plan.tool === 'external_api') {
    return {
      sources: [],
      toolContext: `Analyze only the text the user provided. Do not add sections, dates, or facts that are not in it.\n\n${query}`,
      searchMs: Math.round(performance.now() - started),
      answerFrom: 'model',
    }
  }

  const { results, window } = await tavilySearch(query)
  return {
    sources: results,
    toolContext: formatSources(results),
    searchWindow: window,
    searchMs: Math.round(performance.now() - started),
    answerFrom: 'model',
  }
}

function reasonMessages(query, plan, toolContext, memories) {
  const today = todayLabel()
  const memoryNotes = memories.length
    ? memories.map((item) => `- ${item.createdAt}: ${item.summary}`).join('\n')
    : 'No earlier observatory runs matched this request.'

  return [
    {
      role: 'system',
      content:
        `Today is ${today}. You answer for the AI Agent Observatory. ` +
        'Use only the retrieved sources and memory notes in the user message. ' +
        'Do not add news, prices, jobs, dates, or events from your training data. ' +
        'If a source has a published date, say that date. If the sources are older than today, say so. ' +
        'If the sources do not contain the answer, say what is missing. ' +
        'Format the answer as one headline sentence, then 3 to 5 bullet lines that each start with "- ". ' +
        'Each bullet is one fact and includes the source date when there is one. Do not invent URLs.',
    },
    {
      role: 'user',
      content:
        `User request: ${query}\nIntent: ${plan.intentLabel}\nTool: ${plan.tool}\n\n` +
        `Retrieved sources:\n${toolContext}\n\nObservatory memory:\n${memoryNotes}`,
    },
  ]
}

async function streamGroq(messages, onDelta, meter = null) {
  const res = await groqFetch({
    model: MODEL,
    temperature: 0.2,
    max_tokens: 1400,
    stream: true,
    stream_options: { include_usage: true },
    messages,
  })
  if (!res.body) throw new Error('Groq returned no response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  let lastUsage = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const chunk = JSON.parse(payload)
        const reported = chunk.usage || chunk.x_groq?.usage
        if (reported) lastUsage = reported
        const delta = chunk.choices?.[0]?.delta?.content || ''
        if (delta) {
          full += delta
          onDelta(delta)
        }
      } catch {
        // Ignore a partial SSE line that was not JSON.
      }
    }
  }
  addUsage(meter, lastUsage)
  if (!full.trim()) throw new Error('The model returned an empty stream')
  return full.trim()
}

function localVerdicts(response, sources) {
  const bullets = String(response)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2))
  const haystack = sources.map((source) => `${source.title} ${source.content} ${source.publishedDate}`).join(' ').toLowerCase()
  return bullets.map((text) => {
    if (!sources.length) return { text, supported: true, note: 'Checked against the computed result' }
    const words = text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3)
    const hits = words.filter((word) => haystack.includes(word)).length
    const supported = hits >= 2
    return {
      text,
      supported,
      note: supported ? 'Matches a retrieved source' : 'Not found in the retrieved sources',
    }
  })
}

async function verify(response, sources, meter = null) {
  const local = localVerdicts(response, sources)
  if (!sources.length || !local.length) return { verdicts: local, via: 'local', note: 'No sources to compare against' }
  try {
    const text = await askGroq(
      [
        {
          role: 'system',
          content:
            'You verify claims against sources. Return JSON only: {"verdicts":[{"text":"bullet text","supported":true,"note":"short reason"}]}. ' +
            'supported is true only when the claim is present in the sources. Do not add claims.',
        },
        {
          role: 'user',
          content: `Claims:\n${local.map((item) => `- ${item.text}`).join('\n')}\n\nSources:\n${formatSources(sources)}`,
        },
      ],
      { jsonMode: true, temperature: 0, meter }
    )
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed.verdicts) || !parsed.verdicts.length) return { verdicts: local, via: 'local', note: 'Model returned no verdicts' }
    const modelVerdicts = parsed.verdicts.map((verdict, index) => ({
      text: String(verdict.text || local[index]?.text || ''),
      supported: Boolean(verdict.supported),
      note: String(verdict.note || ''),
    }))
    return { verdicts: modelVerdicts, via: 'model', note: null }
  } catch (err) {
    return { verdicts: local, via: 'local', note: `Model verification failed (${err.message.slice(0, 120)}), used word-overlap check` }
  }
}

function confidenceFor({ routedBy, tool, sources, verdicts, error }) {
  const intent = routedBy === 'keywords' ? 62 : 88
  const toolScore = error ? 20 : tool === 'web_search' ? (sources.length ? Math.min(96, 48 + sources.length * 8) : 24) : 92
  const answer = verdicts.length
    ? Math.round((verdicts.filter((item) => item.supported).length / verdicts.length) * 100)
    : error ? 15 : 70
  return { intent, tool: toolScore, answer, verifier: answer }
}

function sse(handler) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      try {
        await handler(send)
      } catch (err) {
        send({ type: 'done', error: err.message, response: null, sources: [], verdicts: [], confidence: null })
      }
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}

async function emitText(send, text) {
  const parts = text.match(/[\s\S]{1,16}/g) || [text]
  for (const part of parts) send({ type: 'token', text: part })
}

const INJECTIONS = new Set(['tool_timeout', 'empty_retrieval', 'irrelevant_retrieval', 'hallucinated_claim'])
const IRRELEVANT_QUERY = 'history of medieval pottery kilns in northern Europe'
const FABRICATED_CLAIM = '- The company announced a merger with Atlantis Holdings in 1850, according to its founder Napoleon Bonaparte.'

function normalizeConfig(raw) {
  const retries = Number(raw?.maxRetries ?? 1)
  return {
    verify: raw?.verify !== false,
    replan: raw?.replan !== false,
    maxRetries: Math.min(2, Math.max(0, Number.isFinite(retries) ? Math.round(retries) : 1)),
    remember: raw?.remember !== false,
  }
}

const STOP = new Set(['what', 'which', 'who', 'when', 'where', 'does', 'this', 'that', 'with', 'from', 'about', 'tell', 'show', 'give', 'latest', 'news', 'best', 'have', 'many'])

// Share of the question's content words that appear anywhere in the retrieved
// text. A cheap, transparent signal for "did search return the right topic".
function relevanceOf(query, sources) {
  const words = [...new Set(String(query).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)))]
  if (!words.length || !sources.length) return 0
  const haystack = sources.map((s) => `${s.title} ${s.content}`).join(' ').toLowerCase()
  return Number((words.filter((w) => haystack.includes(w)).length / words.length).toFixed(2))
}

async function planRetry({ query, reason, unsupported, sources, meter }) {
  const fallback = { reason, searchQuery: isFreshQuery(query) ? `${query} official updates` : `${query} overview` }
  try {
    const text = await askGroq(
      [
        {
          role: 'system',
          content:
            'You are the planner of a web-search agent. The previous attempt failed verification. ' +
            'Return JSON only: {"reason":"one short sentence on what went wrong","searchQuery":"a better web search query"}. ' +
            'The new query must target the facts the user actually asked about.',
        },
        {
          role: 'user',
          content:
            `User request: ${query}\nFailure: ${reason}\n` +
            `Unsupported claims:\n${unsupported.map((item) => `- ${item.text}`).join('\n') || '- none'}\n` +
            `Previous source titles:\n${sources.map((s) => `- ${s.title}`).join('\n') || '- none'}`,
        },
      ],
      { jsonMode: true, temperature: 0, meter }
    )
    const parsed = JSON.parse(text)
    let searchQuery = String(parsed.searchQuery || '').trim()
    if (!searchQuery) return fallback
    if (isFreshQuery(query) && !isFreshQuery(searchQuery)) searchQuery += ' latest'
    return { reason: String(parsed.reason || reason).slice(0, 220), searchQuery: searchQuery.slice(0, 200) }
  } catch {
    return fallback
  }
}

const supportRate = (verdicts) => (verdicts.length ? verdicts.filter((item) => item.supported).length / verdicts.length : 1)

export async function POST({ request }) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const query = typeof body?.query === 'string' ? body.query.trim() : ''
  if (!query) return json({ error: 'Missing query' }, 400)

  if (body?.phase === 'route') {
    const plan = await routeQuery(query)
    if (isFreshQuery(query)) plan.tool = 'web_search'
    return json(plan)
  }

  const plan = sanitizePlan(body?.plan, query)
  if (isFreshQuery(query) && !plan.steered) plan.tool = 'web_search'
  const config = normalizeConfig(body?.config)
  const inject = INJECTIONS.has(body?.inject) && plan.tool === 'web_search' ? body.inject : null

  return sse(async (send) => {
    const tracer = createTracer({ query, config, injected: inject })
    const { meter, span } = tracer

    const finish = async ({ status, error = null, response = null, sources = [], verdicts = [], retrieved = [], searchWindow = null, timings, attempts, replans }) => {
      const memories = await listMemories()
      const trace = tracer.summary({
        tool: plan.tool,
        intentLabel: plan.intentLabel,
        routedBy: plan.routedBy,
        status,
        error,
        attempts,
        replans: replans.length,
        claims: verdicts.length,
        claimsSupported: verdicts.filter((item) => item.supported).length,
        response,
      })
      const saved = await saveTrace(trace)
      send({
        type: 'done',
        response,
        error,
        sources,
        retrieved,
        memories,
        verdicts,
        confidence: confidenceFor({ routedBy: plan.routedBy, tool: plan.tool, sources, verdicts, error: status === 'failed' ? error : null }),
        asOf: new Date().toISOString(),
        searchWindow,
        timings,
        intentLabel: plan.intentLabel,
        tool: plan.tool,
        attempts,
        replans,
        traceId: trace.id,
        trace: { ...trace, persisted: saved.saved, persistNote: saved.reason || null },
      })
    }

    await span('plan', 'planner', { query, note: 'Routing happened in the earlier /route request' }, async (rec) => {
      rec.output = { tool: plan.tool, intent: plan.intentLabel, routedBy: plan.routedBy, tasks: plan.tasks, steered: Boolean(plan.steered), injected: inject }
    })

    const memoryStarted = performance.now()
    const retrieved = await span('memory_retrieval', 'memory', { query, cluster: plan.memoryCluster }, async (rec) => {
      const hits = await searchMemories(query, plan.memoryCluster)
      rec.output = { hits: hits.length, scores: hits.map((hit) => hit.score), matches: hits.map((hit) => hit.query) }
      return hits
    })
    const memoryMs = Math.round(performance.now() - memoryStarted)

    const replans = []
    let attempt = 1
    let searchQuery = query
    let toolResult = null
    let best = null
    let lastError = null
    let searchMs = 0
    let reasonMs = 0
    const canReplan = () => config.replan && plan.tool === 'web_search' && replans.length < config.maxRetries

    const announceReplan = async (reason, unsupported, previousSources) => {
      const planned = await span(
        'replan',
        'planner',
        { reason, unsupported: unsupported.map((item) => item.text), previousSources: previousSources.map((s) => s.title) },
        async (rec) => {
          const next = await planRetry({ query, reason, unsupported, sources: previousSources, meter })
          rec.output = next
          return next
        },
        { attempt }
      )
      replans.push({ attempt, reason: planned.reason, unsupported: unsupported.map((item) => item.text), revisedQuery: planned.searchQuery })
      send({ type: 'replan', ...replans[replans.length - 1], retriesLeft: config.maxRetries - replans.length })
      searchQuery = planned.searchQuery
      attempt += 1
    }

    while (true) {
      let toolError = null
      toolResult = null
      try {
        toolResult = await span(
          `tool:${plan.tool}`,
          'tool',
          { tool: plan.tool, query: attempt === 1 ? query : searchQuery, injectedFailure: attempt === 1 ? inject : null },
          async (rec) => {
            let result
            if (attempt === 1 && inject === 'tool_timeout') {
              await sleep(1500)
              throw new Error('Injected failure: the search tool timed out after 1500 ms')
            } else if (attempt === 1 && inject === 'empty_retrieval') {
              result = { sources: [], toolContext: formatSources([]), searchMs: 0, answerFrom: 'model', searchWindow: 'none' }
            } else if (attempt === 1 && inject === 'irrelevant_retrieval') {
              result = await runTool(IRRELEVANT_QUERY, plan)
            } else if (attempt > 1) {
              const started = performance.now()
              const found = await tavilySearch(searchQuery)
              result = {
                sources: found.results,
                toolContext: formatSources(found.results),
                searchWindow: found.window,
                searchMs: Math.round(performance.now() - started),
                answerFrom: 'model',
              }
            } else {
              result = await runTool(query, plan)
            }
            rec.output = {
              sourceCount: result.sources.length,
              titles: result.sources.map((s) => s.title),
              relevance: plan.tool === 'web_search' ? relevanceOf(query, result.sources) : null,
              window: result.searchWindow || null,
              rows: result.rows?.map((row) => row.name) || null,
              preview: String(result.toolContext || '').slice(0, 500),
            }
            return result
          },
          { attempt }
        )
        searchMs += toolResult.searchMs || 0
      } catch (err) {
        toolError = err.message
      }

      const empty = !toolError && plan.tool === 'web_search' && toolResult.sources.length === 0
      if (toolError || empty) {
        const reason = toolError || 'The search returned no sources'
        if (canReplan()) {
          await announceReplan(reason, [], toolResult?.sources || [])
          continue
        }
        if (best) break
        lastError = toolError || 'No current web sources were returned, so no news was filled in from model memory.'
        send({ type: 'sources', sources: [] })
        await finish({
          status: 'failed',
          error: lastError,
          retrieved,
          timings: { searchMs, reasonMs: 0, memoryMs },
          attempts: attempt,
          replans,
        })
        return
      }

      send({ type: 'sources', sources: toolResult.sources })

      const reasonStarted = performance.now()
      let response = null
      let error = null
      const direct =
        plan.tool === 'calculator' ||
        (plan.tool === 'database' && toolResult.toolContext.startsWith('No customer matched'))
      const retryNote = replans.length
        ? `\n\nA previous draft was rejected because these claims were not supported by any source: ${replans[replans.length - 1].unsupported.join(' | ') || 'the earlier search returned nothing usable'}. Write a new answer using only the sources above.`
        : ''
      if (attempt > 1) send({ type: 'reset' })

      try {
        await span(
          'reasoning',
          'llm',
          { tool: plan.tool, sourceCount: toolResult.sources.length, retry: attempt > 1, model: MODEL },
          async (rec) => {
            if (direct) {
              response = toolResult.toolContext
              await emitText(send, response)
            } else {
              const messages = reasonMessages(query, plan, toolResult.toolContext, retrieved)
              if (retryNote) messages[1].content += retryNote
              response = await streamGroq(messages, (delta) => send({ type: 'token', text: delta }), meter)
            }
            if (attempt === 1 && inject === 'hallucinated_claim') {
              response = `${response}\n${FABRICATED_CLAIM}`
              await emitText(send, `\n${FABRICATED_CLAIM}`)
              rec.input.injectedFailure = 'hallucinated_claim'
            }
            rec.output = { chars: response.length, answer: response }
          },
          { attempt }
        )
      } catch (err) {
        error = err.message
        if (plan.tool === 'web_search' && toolResult.sources.length) {
          response = sourceSummary(toolResult.sources)
          error = `${err.message} This summary is built only from the source titles and dates.`
          await emitText(send, response)
        } else if (plan.tool === 'database' && toolResult.rows?.length) {
          response = customerSummary(toolResult.rows)
          error = `${err.message} These rows come straight from the database.`
          await emitText(send, response)
        } else if (plan.tool === 'calculator') {
          response = toolResult.toolContext
          error = null
          await emitText(send, response)
        }
      }
      reasonMs += Math.round(performance.now() - reasonStarted)

      let verdicts = []
      if (response && config.verify) {
        send({ type: 'status', label: 'Verifier reading sources...' })
        verdicts = await span(
          'verification',
          'verifier',
          { claims: String(response).split('\n').filter((line) => line.trim().startsWith('- ')).length, sourceCount: toolResult.sources.length },
          async (rec) => {
            const checked = await verify(response, toolResult.sources, meter)
            const result = checked.verdicts
            rec.output = {
              via: checked.via,
              fallbackNote: checked.note,
              supported: result.filter((item) => item.supported).length,
              unsupported: result.filter((item) => !item.supported).map((item) => item.text),
              verdicts: result,
            }
            return result
          },
          { attempt }
        )
      }

      const rate = supportRate(verdicts)
      if (!best || rate >= best.rate) {
        best = { response, error, verdicts, sources: toolResult.sources, searchWindow: toolResult.searchWindow || null, rate }
      }

      const unsupported = verdicts.filter((item) => !item.supported)
      if (config.verify && unsupported.length && toolResult.sources.length && canReplan()) {
        await announceReplan(`${unsupported.length} claim(s) were not supported by the retrieved sources`, unsupported, toolResult.sources)
        continue
      }
      break
    }

    const finalAnswer = best
    if (config.remember && !inject && finalAnswer.response) {
      await addMemory({
        query,
        clusterId: plan.memoryCluster,
        summary: finalAnswer.response.slice(0, 320),
        intentLabel: plan.intentLabel,
        tool: plan.tool,
      })
    }

    await finish({
      status: !finalAnswer.response ? 'failed' : finalAnswer.error ? 'degraded' : 'ok',
      error: finalAnswer.error,
      response: finalAnswer.response,
      sources: finalAnswer.sources,
      verdicts: finalAnswer.verdicts,
      retrieved,
      searchWindow: finalAnswer.searchWindow,
      timings: { searchMs, reasonMs, memoryMs },
      attempts: attempt,
      replans,
    })
  })
}
