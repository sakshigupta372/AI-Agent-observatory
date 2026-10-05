import pg from 'pg'
import { EMBEDDING_DIMS } from './embeddings.js'

// Astro inlines import.meta.env at build time, while the CLI scripts in
// scripts/ run under plain Node and only have process.env.
function readConnection() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    return import.meta.env.DATABASE_URL || ''
  } catch {
    return ''
  }
}

const CONNECTION = readConnection()

let pool = null
let readyPromise = null

export function isConfigured() {
  return Boolean(CONNECTION)
}

function getPool() {
  if (!CONNECTION) return null
  if (!pool) {
    const local = /localhost|127\.0\.0\.1/.test(CONNECTION)
    // sslmode is stripped because ssl is set explicitly below; leaving it
    // in makes pg-connection-string emit a deprecation warning.
    pool = new pg.Pool({
      connectionString: CONNECTION.replace(/[?&]sslmode=[^&]*/g, (match) => (match[0] === '?' ? '?' : '')).replace(/\?$/, ''),
      ssl: local ? false : { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 10000,
    })
    pool.on('error', () => {})
  }
  return pool
}

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS agent_runs (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  query        TEXT NOT NULL,
  cluster_id   TEXT NOT NULL,
  intent_label TEXT,
  tool         TEXT,
  summary      TEXT NOT NULL,
  embedding    vector(${EMBEDDING_DIMS})
);

CREATE INDEX IF NOT EXISTS agent_runs_embedding_idx
  ON agent_runs USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS agent_runs_created_at_idx
  ON agent_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS customers (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  tier            TEXT NOT NULL,
  open_tickets    INTEGER NOT NULL DEFAULT 0,
  last_contact_at DATE,
  notes           TEXT NOT NULL DEFAULT '',
  embedding       vector(${EMBEDDING_DIMS})
);

CREATE INDEX IF NOT EXISTS customers_embedding_idx
  ON customers USING hnsw (embedding vector_cosine_ops);
`

export async function ready() {
  const client = getPool()
  if (!client) return false
  readyPromise =
    readyPromise ||
    client
      .query(SCHEMA)
      .then(() => true)
      .catch((err) => {
        readyPromise = null
        throw err
      })
  return readyPromise
}

export async function query(text, params = []) {
  const client = getPool()
  if (!client) throw new Error('DATABASE_URL is not set')
  await ready()
  return client.query(text, params)
}

export async function health() {
  if (!CONNECTION) return { connected: false, reason: 'DATABASE_URL is not set' }
  try {
    const result = await query('SELECT count(*)::int AS runs FROM agent_runs')
    const customers = await query('SELECT count(*)::int AS total FROM customers')
    return {
      connected: true,
      runs: result.rows[0].runs,
      customers: customers.rows[0].total,
    }
  } catch (err) {
    return { connected: false, reason: err.message }
  }
}
