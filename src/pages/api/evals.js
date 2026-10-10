import { query } from '../../server/db.js'

const headers = { 'Content-Type': 'application/json' }

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers })

// GET /api/evals               -> every eval run with aggregate metrics
// GET /api/evals?run=<id>      -> per-task results for one run
// GET /api/evals?view=benchmarks -> stored retrieval benchmark rows
export async function GET({ url }) {
  try {
    const runId = url.searchParams.get('run')
    if (runId) {
      const { rows } = await query('SELECT * FROM eval_results WHERE eval_run_id = $1 ORDER BY id', [Number(runId)])
      return json({
        results: rows.map((row) => ({
          taskId: row.task_id,
          category: row.category,
          query: row.query,
          expectedTool: row.expected_tool,
          tool: row.tool,
          toolCorrect: row.tool_correct,
          success: row.success,
          failureReason: row.failure_reason,
          claims: row.claims,
          claimsSupported: row.claims_supported,
          totalMs: row.total_ms,
          costUsd: Number(row.est_cost_usd),
          attempts: row.attempts,
          replans: row.replans,
          injected: row.injected,
          truthStage: row.truth_stage,
          diagnosedStage: row.diagnosed_stage,
          localized: row.localized,
          detected: row.detected,
          traceId: row.trace_id,
        })),
      })
    }

    if (url.searchParams.get('view') === 'benchmarks') {
      const { rows } = await query(
        `SELECT * FROM retrieval_benchmarks
         WHERE created_at = (SELECT max(created_at) FROM retrieval_benchmarks)
         ORDER BY row_count, index_type`
      )
      return json({
        benchmarks: rows.map((row) => ({
          rowCount: row.row_count,
          indexType: row.index_type,
          samples: row.samples,
          clientP50: Number(row.client_p50_ms),
          clientP95: Number(row.client_p95_ms),
          serverP50: Number(row.server_p50_ms),
          serverP95: Number(row.server_p95_ms),
          recallAt5: row.recall_at_5 == null ? null : Number(row.recall_at_5),
          note: row.note,
          createdAt: row.created_at,
        })),
      })
    }

    const { rows } = await query(`
      SELECT
        r.id, r.created_at, r.label, r.config,
        count(e.*)::int                                                           AS tasks,
        count(*) FILTER (WHERE e.success)::int                                    AS passed,
        count(*) FILTER (WHERE e.tool_correct)::int                               AS tool_ok,
        coalesce(sum(e.claims), 0)::int                                           AS claims,
        coalesce(sum(e.claims_supported), 0)::int                                 AS claims_supported,
        coalesce(percentile_cont(0.5)  WITHIN GROUP (ORDER BY e.total_ms), 0)::float AS p50_ms,
        coalesce(percentile_cont(0.95) WITHIN GROUP (ORDER BY e.total_ms), 0)::float AS p95_ms,
        coalesce(sum(e.est_cost_usd), 0)::float                                   AS cost,
        count(*) FILTER (WHERE e.injected IS NOT NULL)::int                       AS injected,
        count(*) FILTER (WHERE e.injected IS NOT NULL AND e.detected)::int        AS detected,
        count(*) FILTER (WHERE e.injected IS NOT NULL AND e.localized)::int       AS localized,
        count(*) FILTER (WHERE e.injected IS NOT NULL AND e.success)::int         AS recovered,
        count(*) FILTER (WHERE e.injected IS NOT NULL AND e.success AND e.replans > 0)::int AS recovered_by_replan,
        coalesce(sum(e.replans), 0)::int                                          AS replans
      FROM eval_runs r
      LEFT JOIN eval_results e ON e.eval_run_id = r.id
      GROUP BY r.id
      ORDER BY r.id DESC
      LIMIT 40
    `)
    return json({
      runs: rows.map((row) => ({
        id: Number(row.id),
        createdAt: row.created_at,
        label: row.label,
        config: row.config,
        tasks: row.tasks,
        passed: row.passed,
        toolOk: row.tool_ok,
        claims: row.claims,
        claimsSupported: row.claims_supported,
        p50Ms: row.p50_ms,
        p95Ms: row.p95_ms,
        cost: row.cost,
        costPerSuccess: row.passed ? row.cost / row.passed : null,
        injected: row.injected,
        detected: row.detected,
        localized: row.localized,
        recovered: row.recovered,
        recoveredByReplan: row.recovered_by_replan,
        replans: row.replans,
      })),
    })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
}
