// Runs the evaluation suite against a running server and stores the results.
//
//   node --env-file=.env scripts/runEval.js                 all 3 configs, all tasks
//   node --env-file=.env scripts/runEval.js --config replan only one config
//   node --env-file=.env scripts/runEval.js --only inj      tasks whose id contains "inj"
//   node --env-file=.env scripts/runEval.js --repeat 3      repeat every task (non-determinism)
//
// The server must be running (pnpm dev). Each web task uses Tavily credits;
// one full pass is about 33 searches plus replans.
import { EVAL_CONFIGS, EVAL_TASKS, TRUTH_STAGE, diagnoseStage, gradeAnswer } from '../src/data/evalSuite.js'
import { query, ready } from '../src/server/db.js'

const args = process.argv.slice(2)
const flag = (name) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1] : null
}

const BASE = flag('base') || 'http://localhost:4331'
const onlyConfig = flag('config')
const only = flag('only')
const repeat = Math.max(1, Number(flag('repeat') || 1))
const PAUSE_MS = Number(flag('pause') || 1500)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function post(body) {
  const res = await fetch(`${BASE}/api/agent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res
}

async function runTask(task, config) {
  const route = await (await post({ phase: 'route', query: task.query })).json()
  if (!route?.tool) return { error: route?.error || 'routing failed', route }
  const res = await post({ phase: 'execute', query: task.query, plan: route, inject: task.inject, config })
  const raw = await res.text()
  const events = raw
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6))
      } catch {
        return null
      }
    })
    .filter(Boolean)
  const done = events.find((event) => event.type === 'done')
  if (!done?.traceId) return { error: 'no trace was recorded', route }
  const trace = await (await fetch(`${BASE}/api/traces?id=${done.traceId}`)).json()
  return { route, trace: trace.trace }
}

function pct(n, d) {
  return d ? `${Math.round((n / d) * 100)}%` : '–'
}

async function main() {
  if (!(await ready())) {
    console.error('DATABASE_URL is not set or the database is unreachable. Run with: node --env-file=.env scripts/runEval.js')
    process.exit(1)
  }
  const configs = EVAL_CONFIGS.filter((item) => !onlyConfig || item.id === onlyConfig)
  const tasks = EVAL_TASKS.filter((task) => !only || task.id.includes(only) || task.category.includes(only))
  if (!configs.length || !tasks.length) {
    console.error('Nothing to run for those filters.')
    process.exit(1)
  }

  for (const item of configs) {
    const label = `${item.label}${repeat > 1 ? ` (x${repeat})` : ''}`
    const created = await query(
      'INSERT INTO eval_runs (label, config, base_url, task_count) VALUES ($1, $2, $3, $4) RETURNING id',
      [label, JSON.stringify({ id: item.id, ...item.config }), BASE, tasks.length * repeat]
    )
    const runId = created.rows[0].id
    console.log(`\n=== ${label} · eval run #${runId} · ${tasks.length * repeat} tasks`)
    let passed = 0
    let total = 0

    for (let round = 0; round < repeat; round += 1) {
      for (const task of tasks) {
        total += 1
        let outcome
        try {
          outcome = await runTask(task, item.config)
        } catch (err) {
          outcome = { error: err.message }
        }
        const trace = outcome.trace
        const toolCorrect = trace ? trace.tool === task.expectedTool : false
        const graded = trace ? gradeAnswer(task, trace.response) : { ok: false, reason: outcome.error }
        const success = Boolean(trace) && trace.status !== 'failed' && toolCorrect && graded.ok
        const reason = !trace
          ? outcome.error
          : trace.status === 'failed'
            ? trace.error || 'Run failed'
            : !toolCorrect
              ? `Routed to ${trace.tool}, expected ${task.expectedTool}`
              : graded.reason
        if (success) passed += 1

        const truth = task.inject ? TRUTH_STAGE[task.inject] : null
        const diagnosed = trace && task.inject ? diagnoseStage(trace.spans) : null
        const detected = trace && task.inject
          ? diagnosed !== 'none' || (trace.replans || 0) > 0
          : null

        await query(
          `INSERT INTO eval_results (
             eval_run_id, task_id, category, query, expected_tool, tool, tool_correct, success, failure_reason,
             claims, claims_supported, total_ms, prompt_tokens, completion_tokens, est_cost_usd, attempts, replans,
             injected, truth_stage, diagnosed_stage, localized, detected, trace_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
          [
            runId,
            task.id,
            task.category,
            task.query,
            task.expectedTool,
            trace?.tool || outcome.route?.tool || null,
            toolCorrect,
            success,
            success ? null : reason,
            trace?.claims || 0,
            trace?.claimsSupported || 0,
            trace?.totalMs ?? null,
            trace?.promptTokens || 0,
            trace?.completionTokens || 0,
            trace?.estCostUsd || 0,
            trace?.attempts || 1,
            trace?.replans || 0,
            task.inject || null,
            truth,
            diagnosed,
            truth ? diagnosed === truth : null,
            detected,
            trace?.id || null,
          ]
        )
        console.log(
          `${success ? 'PASS' : 'FAIL'}  ${task.id.padEnd(20)} ${String(trace?.totalMs ?? '-').padStart(6)}ms` +
            `${trace?.replans ? `  replans=${trace.replans}` : ''}${success ? '' : `  · ${reason}`}`
        )
        await sleep(PAUSE_MS)
      }
    }
    console.log(`--- ${label}: ${passed}/${total} succeeded (${pct(passed, total)})`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
