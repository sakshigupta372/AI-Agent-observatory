// Measures nearest-neighbour latency at several table sizes using SYNTHETIC
// random 384-dim vectors in a scratch table (bench_vectors). It never touches
// the real memory/customers tables.
//
//   node --env-file=.env scripts/benchmarkRetrieval.js
//   node --env-file=.env scripts/benchmarkRetrieval.js --sizes 1000,10000,50000 --samples 40
//
// For each size it times an exact scan (no index) and an HNSW index, reporting
// client-side latency (what the app sees, includes the network hop to the
// database) and server-side execution time (from EXPLAIN ANALYZE). Recall@5 is
// the overlap between HNSW results and the exact scan for the same queries.
//
// Random vectors have no cluster structure, so recall here is a pessimistic
// stress test and not a prediction for real text embeddings.
import { query, ready } from '../src/server/db.js'

const args = process.argv.slice(2)
const flag = (name) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1] : null
}

const SIZES = (flag('sizes') || '1000,10000,25000').split(',').map(Number)
const SAMPLES = Number(flag('samples') || 30)
const DIMS = 384
const K = 5

const randomVector = () => `[${Array.from({ length: DIMS }, () => (Math.random() * 2 - 1).toFixed(4)).join(',')}]`

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(index, 0)]
}

async function topIds(vector) {
  const { rows } = await query('SELECT id FROM bench_vectors ORDER BY embedding <=> $1::vector LIMIT $2', [vector, K])
  return rows.map((row) => Number(row.id))
}

async function timeQueries(vectors) {
  const client = []
  const server = []
  for (const vector of vectors.slice(0, 3)) await topIds(vector) // warm-up
  for (const vector of vectors) {
    const started = performance.now()
    await topIds(vector)
    client.push(performance.now() - started)
    const plan = await query(
      'EXPLAIN (ANALYZE, FORMAT JSON) SELECT id FROM bench_vectors ORDER BY embedding <=> $1::vector LIMIT $2',
      [vector, K]
    )
    server.push(plan.rows[0]['QUERY PLAN'][0]['Execution Time'])
  }
  return { client, server }
}

async function main() {
  if (!(await ready())) {
    console.error('DATABASE_URL is not set. Run with: node --env-file=.env scripts/benchmarkRetrieval.js')
    process.exit(1)
  }
  const batchTime = new Date()
  await query('DROP TABLE IF EXISTS bench_vectors')
  await query(`CREATE TABLE bench_vectors (id BIGSERIAL PRIMARY KEY, embedding vector(${DIMS}))`)

  let have = 0
  const queries = Array.from({ length: SAMPLES }, randomVector)

  for (const size of SIZES) {
    console.log(`\n== ${size.toLocaleString()} rows`)
    await query('DROP INDEX IF EXISTS bench_vectors_hnsw')
    const missing = size - have
    // Generated on the server so growing the table does not ship megabytes of vectors.
    await query(
      `INSERT INTO bench_vectors (embedding)
       SELECT (SELECT array_agg(random() * 2 - 1) FROM generate_series(1, ${DIMS}) WHERE g > 0)::vector(${DIMS})
       FROM generate_series(1, $1) AS g`,
      [missing]
    )
    have = size
    await query('ANALYZE bench_vectors')

    const exactIds = []
    for (const vector of queries) exactIds.push(await topIds(vector))
    const exact = await timeQueries(queries)
    const exactRow = {
      indexType: 'exact scan',
      clientP50: percentile(exact.client, 50),
      clientP95: percentile(exact.client, 95),
      serverP50: percentile(exact.server, 50),
      serverP95: percentile(exact.server, 95),
      recall: 1,
    }

    const buildStarted = performance.now()
    await query('CREATE INDEX bench_vectors_hnsw ON bench_vectors USING hnsw (embedding vector_cosine_ops)')
    const buildSeconds = ((performance.now() - buildStarted) / 1000).toFixed(1)
    await query('ANALYZE bench_vectors')

    let overlap = 0
    for (let i = 0; i < queries.length; i += 1) {
      const ids = await topIds(queries[i])
      overlap += ids.filter((id) => exactIds[i].includes(id)).length
    }
    const hnsw = await timeQueries(queries)
    const hnswRow = {
      indexType: 'HNSW',
      clientP50: percentile(hnsw.client, 50),
      clientP95: percentile(hnsw.client, 95),
      serverP50: percentile(hnsw.server, 50),
      serverP95: percentile(hnsw.server, 95),
      recall: overlap / (queries.length * K),
      note: `index build ${buildSeconds}s`,
    }

    for (const row of [exactRow, hnswRow]) {
      console.log(
        `${row.indexType.padEnd(11)} client p50 ${row.clientP50.toFixed(1)}ms p95 ${row.clientP95.toFixed(1)}ms · ` +
          `server p50 ${row.serverP50.toFixed(2)}ms p95 ${row.serverP95.toFixed(2)}ms · recall@${K} ${row.recall.toFixed(2)}${row.note ? ` · ${row.note}` : ''}`
      )
      await query(
        `INSERT INTO retrieval_benchmarks
           (created_at, row_count, index_type, samples, client_p50_ms, client_p95_ms, server_p50_ms, server_p95_ms, recall_at_5, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          batchTime,
          size,
          row.indexType,
          SAMPLES,
          row.clientP50.toFixed(2),
          row.clientP95.toFixed(2),
          row.serverP50.toFixed(2),
          row.serverP95.toFixed(2),
          row.recall.toFixed(3),
          `synthetic random ${DIMS}-dim vectors${row.note ? `; ${row.note}` : ''}`,
        ]
      )
    }
  }

  await query('DROP TABLE IF EXISTS bench_vectors')
  console.log('\nScratch table dropped.')
  process.exit(0)
}

main().catch(async (err) => {
  console.error(err)
  try {
    await query('DROP TABLE IF EXISTS bench_vectors')
  } catch {
    // best effort
  }
  process.exit(1)
})
