# Agent benchmark

Latency and claim-verification benchmark for the existing agent, using the 30 fixed queries in `queries.json` (6 each: factual, current, multi-step, memory, insufficient evidence). The categories describe intent only; there are no expected answers or ground-truth labels.

## Run

```
pnpm dev                                         # terminal 1
node --env-file=.env scripts/runBenchmark.js --pause 20000
```

Each run writes `results/<timestamp>/`:

- `results.json`: run metadata plus one record per query (timings, stage durations, verdicts, sources)
- `results.csv`: the same records flattened, one row per query
- `summary.json` / `summary.md`: aggregates and definitions of every number

Useful flags: `--only <id or category>`, `--base <url>`, `--timeout <ms>`, `--warmup <n>`, `--remember` (lets runs write to the memory table; off by default so results do not depend on query order), `--from <results.json>` (rebuild summaries without calling the agent).

## Pacing matters

Groq's per-minute token limit is the main source of noise. With a 2 s pause (`results/2026-10-24T06-47-57-937Z`), 13 of 30 answers were degraded by Groq 429 errors and the verifier fell back to word overlap in 15 of 22 runs that had sources, so that run mostly measures fallbacks. With a 20 s pause (`results/2026-10-24T06-55-33-967Z`) 27 of 30 completed normally. Check the "Failed spans by stage" and "verifier fell back" lines at the top of `summary.md` before reading any other number.

## Instrumentation

Stage durations come from the server's existing spans (`performance.now()` around each awaited operation in `src/pages/api/agent.js`). Two measurements were added without changing behaviour: a `Server-Timing: route;dur=…` header on the route response, and time-to-first-answer-token / content-stream duration inside the `reasoning` span. End-to-end latency is measured by the runner with `performance.now()`.

Intent detection, planning and tool selection are one Groq call in the route phase and are reported together as `route_intent_planning_tool_selection`. Response generation is the streaming part of the reasoning call (`reasoning_content_stream`).

## Known measurement limits

- The verifier is binary (supported / not found in sources). There is no uncertain label and no per-claim confidence. "Unsupported" does not mean false.
- Claims are only lines starting with `- `. Answers without such lines have zero checked claims.
- Runs with no retrieved sources (calculator, database, text analysis) are marked supported by the local check without comparing against anything; the summary reports them separately.
- Memory retrieval silently falls back to a lexical file search on database errors; the benchmark cannot tell the two apart.

## Agent issue found by the benchmark (not fixed here)

In `mem-06` of the paced run the model wrote bullets as `-` followed by U+202F (narrow no-break space). The claim extractor found no claims, verification was skipped, and because the best-attempt selection scores zero verdicts as a 100% support rate, this unchecked second attempt replaced a first attempt that had 4 of 5 claims supported.
