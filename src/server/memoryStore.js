import fs from 'node:fs'
import path from 'node:path'
import { isConfigured, query } from './db.js'
import { embed, toVectorLiteral, warmEmbedder } from './embeddings.js'

const FILE = path.join(process.cwd(), 'data', 'observatory-memory.json')

if (isConfigured()) warmEmbedder()

// Postgres + pgvector is the real store. The JSON file stays as a
// fallback so the observatory still runs before DATABASE_URL is set.
function readFileStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeFileStore(items) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(items, null, 2))
}

function tokens(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2)
  )
}

function lexicalScore(queryText, item) {
  const wanted = tokens(queryText)
  if (!wanted.size) return 0
  const haystack = tokens(`${item.query} ${item.summary}`)
  let hits = 0
  for (const word of wanted) if (haystack.has(word)) hits += 1
  return hits / wanted.size
}

function rowToMemory(row) {
  return {
    id: `mem_${row.id}`,
    createdAt: new Date(row.created_at).toISOString(),
    query: row.query,
    clusterId: row.cluster_id,
    intentLabel: row.intent_label,
    tool: row.tool,
    summary: row.summary,
    ...(row.score != null ? { score: Number(Number(row.score).toFixed(3)) } : {}),
  }
}

export async function listMemories() {
  if (!isConfigured()) return readFileStore()
  try {
    const result = await query(
      `SELECT id, created_at, query, cluster_id, intent_label, tool, summary
         FROM agent_runs
        ORDER BY created_at DESC
        LIMIT 80`
    )
    return result.rows.map(rowToMemory).reverse()
  } catch {
    return readFileStore()
  }
}

export async function searchMemories(queryText, clusterId) {
  if (isConfigured()) {
    try {
      const vector = await embed(queryText)
      if (vector) {
        const result = await query(
          `SELECT id, created_at, query, cluster_id, intent_label, tool, summary,
                  1 - (embedding <=> $1::vector) AS score
             FROM agent_runs
            WHERE embedding IS NOT NULL
              AND 1 - (embedding <=> $1::vector) >= 0.35
            ORDER BY embedding <=> $1::vector
            LIMIT 5`,
          [toVectorLiteral(vector)]
        )
        return result.rows.map(rowToMemory)
      }
    } catch {
      // Fall through to the lexical file store.
    }
  }

  return readFileStore()
    .map((item) => {
      const score = lexicalScore(queryText, item) + (item.clusterId === clusterId ? 0.15 : 0)
      return { ...item, score: Number(score.toFixed(2)) }
    })
    .filter((item) => item.score >= 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

export async function addMemory(entry) {
  if (isConfigured()) {
    try {
      const vector = await embed(`${entry.query}\n${entry.summary}`)
      const result = await query(
        `INSERT INTO agent_runs (query, cluster_id, intent_label, tool, summary, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)
         RETURNING id, created_at, query, cluster_id, intent_label, tool, summary`,
        [
          entry.query,
          entry.clusterId,
          entry.intentLabel ?? null,
          entry.tool ?? null,
          entry.summary,
          vector ? toVectorLiteral(vector) : null,
        ]
      )
      return rowToMemory(result.rows[0])
    } catch {
      // Fall through so a run is never lost on a database hiccup.
    }
  }

  const items = readFileStore()
  const saved = { id: `mem_${Date.now()}`, createdAt: new Date().toISOString(), ...entry }
  items.push(saved)
  writeFileStore(items.slice(-80))
  return saved
}

export async function searchCustomers(queryText) {
  if (!isConfigured()) return []
  try {
    const vector = await embed(queryText)
    if (!vector) return []
    const result = await query(
      `SELECT name, email, tier, open_tickets, last_contact_at, notes,
              1 - (embedding <=> $1::vector) AS score
         FROM customers
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT 3`,
      [toVectorLiteral(vector)]
    )
    return result.rows
      .filter((row) => Number(row.score) >= 0.3)
      .map((row) => ({
        name: row.name,
        email: row.email,
        tier: row.tier,
        openTickets: row.open_tickets,
        lastContact: row.last_contact_at ? new Date(row.last_contact_at).toISOString().slice(0, 10) : null,
        notes: row.notes,
        score: Number(Number(row.score).toFixed(3)),
      }))
  } catch {
    return []
  }
}
