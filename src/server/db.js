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

-- One row per agent execution; spans hold each step with its input/output.
CREATE TABLE IF NOT EXISTS traces (
  id                TEXT PRIMARY KEY,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  query             TEXT NOT NULL,
  tool              TEXT,
  intent_label      TEXT,
  routed_by         TEXT,
  status            TEXT NOT NULL,
  error             TEXT,
  attempts          INTEGER NOT NULL DEFAULT 1,
  replans           INTEGER NOT NULL DEFAULT 0,
  total_ms          INTEGER,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  est_cost_usd      NUMERIC(10, 6) NOT NULL DEFAULT 0,
  claims            INTEGER NOT NULL DEFAULT 0,
  claims_supported  INTEGER NOT NULL DEFAULT 0,
  injected          TEXT,
  config            JSONB,
  response          TEXT
);

CREATE INDEX IF NOT EXISTS traces_created_at_idx ON traces (created_at DESC);

CREATE TABLE IF NOT EXISTS trace_spans (
  id            BIGSERIAL PRIMARY KEY,
  trace_id      TEXT NOT NULL REFERENCES traces (id) ON DELETE CASCADE,
  seq           INTEGER NOT NULL,
  attempt       INTEGER NOT NULL DEFAULT 1,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL,
  status        TEXT NOT NULL,
  started_ms    INTEGER NOT NULL,
  duration_ms   INTEGER NOT NULL,
  input         JSONB,
  output        JSONB,
  error         TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS trace_spans_trace_idx ON trace_spans (trace_id, seq);

-- Evaluation runs: one row per suite execution under a named configuration.
CREATE TABLE IF NOT EXISTS eval_runs (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  label      TEXT NOT NULL,
  config     JSONB NOT NULL,
  base_url   TEXT,
  task_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS eval_results (
  id               BIGSERIAL PRIMARY KEY,
  eval_run_id      BIGINT NOT NULL REFERENCES eval_runs (id) ON DELETE CASCADE,
  task_id          TEXT NOT NULL,
  category         TEXT NOT NULL,
  query            TEXT NOT NULL,
  expected_tool    TEXT,
  tool             TEXT,
  tool_correct     BOOLEAN,
  success          BOOLEAN NOT NULL,
  failure_reason   TEXT,
  claims           INTEGER NOT NULL DEFAULT 0,
  claims_supported INTEGER NOT NULL DEFAULT 0,
  total_ms         INTEGER,
  prompt_tokens    INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  est_cost_usd     NUMERIC(10, 6) NOT NULL DEFAULT 0,
  attempts         INTEGER NOT NULL DEFAULT 1,
  replans          INTEGER NOT NULL DEFAULT 0,
  injected         TEXT,
  truth_stage      TEXT,
  diagnosed_stage  TEXT,
  localized        BOOLEAN,
  detected         BOOLEAN,
  trace_id         TEXT
);

CREATE INDEX IF NOT EXISTS eval_results_run_idx ON eval_results (eval_run_id);

CREATE TABLE IF NOT EXISTS retrieval_benchmarks (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_count   INTEGER NOT NULL,
  index_type  TEXT NOT NULL,
  samples     INTEGER NOT NULL,
  client_p50_ms NUMERIC(10, 2),
  client_p95_ms NUMERIC(10, 2),
  server_p50_ms NUMERIC(10, 2),
  server_p95_ms NUMERIC(10, 2),
  recall_at_5   NUMERIC(5, 3),
  note        TEXT
);
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
