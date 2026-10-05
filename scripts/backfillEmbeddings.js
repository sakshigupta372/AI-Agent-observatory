import fs from 'node:fs'
import path from 'node:path'
import { isConfigured, query, ready } from '../src/server/db.js'
import { embed, toVectorLiteral } from '../src/server/embeddings.js'

// Moves runs already saved in data/observatory-memory.json into Postgres
// so the memory clusters keep the history from before the database.
if (!isConfigured()) {
  console.error('DATABASE_URL is not set. Add it to .env, then run this again.')
  process.exit(1)
}

const FILE = path.join(process.cwd(), 'data', 'observatory-memory.json')
let items = []
try {
  items = JSON.parse(fs.readFileSync(FILE, 'utf8'))
} catch {
  console.log('No JSON memory file found. Nothing to import.')
  process.exit(0)
}

await ready()
let imported = 0
for (const item of items) {
  if (!item?.query || !item?.summary) continue
  const existing = await query('SELECT 1 FROM agent_runs WHERE query = $1 AND summary = $2 LIMIT 1', [
    item.query,
    item.summary,
  ])
  if (existing.rowCount) continue

  const vector = await embed(`${item.query}\n${item.summary}`)
  await query(
    `INSERT INTO agent_runs (created_at, query, cluster_id, intent_label, tool, summary, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7::vector)`,
    [
      item.createdAt || new Date().toISOString(),
      item.query,
      item.clusterId || 'conversations',
      item.intentLabel || null,
      item.tool || null,
      item.summary,
      vector ? toVectorLiteral(vector) : null,
    ]
  )
  imported += 1
}

console.log(`Imported ${imported} run(s) into Postgres.`)
process.exit(0)
