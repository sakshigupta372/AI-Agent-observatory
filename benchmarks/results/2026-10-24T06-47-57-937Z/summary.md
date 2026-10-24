# Agent benchmark summary

Run 2026-10-24T06:48:02.417Z against `http://localhost:4331` · commit `db81655 (uncommitted changes present)` · model `openai/gpt-oss-120b`
Config: `{"verify":true,"replan":true,"maxRetries":1,"remember":false}` · 1 warm-up run(s) excluded · pause 2000 ms · timeout 120000 ms

## Outcomes

- Samples: **30**
- Completed: **30** (of which degraded: 13)
- Errors / timeouts / incomplete: **0**
- Status counts: ok 17, degraded 13
- Failed spans by stage (an answer can still be produced after a failed span): reasoning 13
- Runs with sources where the verifier fell back to word overlap: 15 of 22

## End-to-end latency (completed runs, client wall clock)

| n | mean | median | p95 | min | max |
|---|---|---|---|---|---|
| 30 | 10,380 ms | 10,522 ms | 24,341 ms | 1,595 ms | 25,425 ms |

p95 uses the nearest-rank method; with about 30 samples it is the second-largest value, so treat it as indicative.

## Latency per stage (completed runs)

| stage | runs with stage | total | mean | median | p95 |
|---|---|---|---|---|---|
| route_intent_planning_tool_selection | 30 | 29,502 ms | 983 ms | 940 ms | 2,014 ms |
| memory_retrieval | 30 | 2,936 ms | 98 ms | 95 ms | 112 ms |
| tool_execution | 30 | 133,269 ms | 4,442 ms | 4,983 ms | 10,506 ms |
| reasoning | 30 | 61,201 ms | 2,040 ms | 2,048 ms | 4,046 ms |
| reasoning_time_to_first_content | 15 | 28,112 ms | 1,874 ms | 1,604 ms | 3,500 ms |
| reasoning_content_stream | 15 | 6,533 ms | 436 ms | 415 ms | 633 ms |
| verification | 30 | 51,913 ms | 1,730 ms | 2,053 ms | 4,079 ms |
| replan | 3 | 6,986 ms | 2,329 ms | 2,051 ms | 2,954 ms |
| unattributed_server | 30 | 8,579 ms | 286 ms | 248 ms | 801 ms |
| overhead_post_span_server | 30 | 8,565 ms | 286 ms | 247 ms | 799 ms |
| overhead_execute_outside_tracer | 30 | 16,845 ms | 562 ms | 529 ms | 884 ms |
| overhead_route_outside_server | 30 | 163 ms | 5 ms | 5 ms | 7 ms |
| plan_bookkeeping | 30 | 0 ms | 0 ms | 0 ms | 0 ms |
| route_client_roundtrip | 30 | 29,665 ms | 989 ms | 946 ms | 2,020 ms |

**Slowest stage by total accumulated time:** tool_execution (133,269 ms across 30 runs)
**Slowest stage by average time:** tool_execution (4,442 ms mean over 30 runs)

Ranking uses only the operation stages (route, memory_retrieval, tool_execution, reasoning, verification, replan), which never overlap. The reasoning sub-rows are parts of `reasoning`, `overhead_post_span_server` is part of `unattributed_server`, and the overhead rows are not operations, so none of them is ranked and nothing is counted twice.
No overlapping spans were found in any run, so the execute stages are strictly sequential.

## Claim verification

| subset | runs | claims checked | supported | unsupported | unsupported rate |
|---|---|---|---|---|---|
| all completed runs | 30 | 109 | 109 | 0 | 0.0% (0/109) |
| checked against retrieved sources | 22 | 93 | 93 | 0 | 0.0% (0/93) |
| no retrieved sources (auto-supported) | 8 | 16 | 16 | 0 | 0.0% (0/16) |
| verifier = model | 7 | 28 | 28 | 0 | 0.0% (0/28) |
| verifier = word-overlap fallback | 23 | 81 | 81 | 0 | 0.0% (0/81) |

Completed runs with zero checkable claims: mem-04, mem-05, weak-03

## By category

| category | runs | completed | median latency | claims checked | unsupported |
|---|---|---|---|---|---|
| factual | 6 | 6 | 11,126 ms | 26 | 0 |
| current | 6 | 6 | 9,286 ms | 24 | 0 |
| multi_step | 6 | 6 | 3,825 ms | 23 | 0 |
| memory | 6 | 6 | 4,377 ms | 17 | 0 |
| insufficient_evidence | 6 | 6 | 10,365 ms | 19 | 0 |

## Errors and non-ok runs

- `fact-03` degraded: The reasoning model is over capacity right now (Groq 429). The tool result below is unchanged. This summary is built only from the source titles and dates.
- `fact-05` degraded: The reasoning model is over capacity right now (Groq 429). The tool result below is unchanged. This summary is built only from the source titles and dates.
- `curr-01` degraded: The reasoning model is over capacity right now (Groq 429). The tool result below is unchanged. This summary is built only from the source titles and dates.
- `curr-02` degraded: The reasoning model is over capacity right now (Groq 429). The tool result below is unchanged. This summary is built only from the source titles and dates.
- `curr-04` degraded: The reasoning model is over capacity right now (Groq 429). The tool result below is unchanged. This summary is built only from the source titles and dates.
- `curr-06` degraded: The reasoning model is over capacity right now (Groq 429). The tool result below is unchanged. This summary is built only from the source titles and dates.
- `multi-01` degraded: The reasoning model is over capacity right now (Groq 429). The tool result below is unchanged. This summary is built only from the source titles and dates.
- `multi-03` degraded: The reasoning model is over capacity right now (Groq 429). The tool result below is unchanged. These rows come straight from the database.
- `mem-01` degraded: The reasoning model is over capacity right now (Groq 429). The tool result below is unchanged. This summary is built only from the source titles and dates.
- `mem-03` degraded: The reasoning model is over capacity right now (Groq 429). The tool result below is unchanged. These rows come straight from the database.
- `weak-01` degraded: The reasoning model is over capacity right now (Groq 429). The tool result below is unchanged. This summary is built only from the source titles and dates.
- `weak-04` degraded: The reasoning model is over capacity right now (Groq 429). The tool result below is unchanged. This summary is built only from the source titles and dates.
- `weak-06` degraded: The reasoning model is over capacity right now (Groq 429). The tool result below is unchanged. These rows come straight from the database.

## What each number means

- End-to-end latency: client wall clock from sending the route request to receiving the `done` SSE event (performance.now in this script). Includes network to the server.
- route_intent_planning_tool_selection: server time of the route request (Server-Timing header). Intent detection, planning (task list) and tool selection are produced by one Groq JSON call, so they cannot be timed separately. For questions matching the "fresh" keywords, or when the model call fails, keyword rules are used instead and this is near 0 ms (see routed_by).
- plan_bookkeeping: the `plan` span inside execute only records the plan from the route step; it is not planning work and is not ranked.
- memory_retrieval: embedding the question with the local MiniLM model plus the pgvector similarity query. The store swallows database errors and falls back to a lexical file search, which this benchmark cannot distinguish.
- tool_execution: the tool span, summed across attempts. For web search it includes every Tavily request the tool made and the page fetches used to recover publication dates.
- reasoning: the answer-writing step, summed across attempts. reasoning_time_to_first_content is from starting the Groq stream request to the first answer token (includes queueing, retries and the model's hidden reasoning); reasoning_content_stream is from the first to the last answer token, i.e. response generation. Calculator answers and database "no match" answers are written without a model call (reasoning_used_model = false).
- verification: the verifier span, summed across attempts. It splits the answer into claims by taking lines that start with "- ", then asks Groq to mark each one supported or not against the retrieved sources. If Groq fails it falls back to a word-overlap check (verifier = local).
- Verifier labels are binary. supported = the verifier judged the claim to be present in the retrieved sources. unsupported = it was not found in those sources; this does not mean the claim is false. There is no uncertain/unverifiable label and no per-claim confidence. heuristicConfidence in the JSON is the app's display score, computed from routing method, source count and support rate; it is not a verifier output.
- Runs whose tool returns no sources (calculator, database, text analysis, empty search) are verified by the local check, which marks every claim supported without comparing it to anything. They are reported separately and should not be read as evidence of correctness.
- replan: the planner call that writes a new search query after a failed verification or empty search, summed across attempts.
- unattributed_server: server execute total (tracer start to trace summary) minus the sum of all spans. Covers work between spans, such as SSE writes, and after the last span (overhead_post_span_server: the optional memory write and listing memories). Only computed when spans do not overlap.
- overhead_execute_outside_tracer: client execute time minus server execute total. Covers request transit and body parsing before the tracer starts, saving the trace to Postgres, and delivering the done event. It is a difference of two durations measured by different clocks, not a separate timer.
- overhead_route_outside_server: route round trip minus route server time, i.e. network and request handling outside the route handler.
- Accounting: client total = route round trip + execute client time (plus the few microseconds between them). Route round trip = route server time + route overhead. Execute client time = server execute total + execute overhead outside the tracer.
- Status: ok = answer with no error; degraded = an answer was produced but the agent reported an error (for example the model was unavailable and a fallback answer was used); failed = no answer; http_error, network_error, timeout, incomplete = the request did not complete normally.
- Results vary between runs: the reasoning model runs at temperature 0.2 and web results change. Re-run to see the spread.
