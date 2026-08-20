# Phase 2 benchmark evidence — 50,000-row matrix (PR 6)

Raw traces and summaries for the [Phase 2 implementation
plan](../../phase-2-implementation-plan.md) PR 6 scenario matrix, run
against the immutable-result architecture from PRs 2–4 (normalized
`accounts`/`dimensionValues`/`planLines`/`results` collections, stable
`GridRowHandle[]` rows, changed-row notification + targeted
`api.refreshCells`). This PR reports evidence; it does not make the
proceed/revise recommendation, which is PR 7's job.

## Reference environment

| Field | Value |
| --- | --- |
| Exact command | `npm run test:browser -- benchmark.spec.ts` (runs `npm run build && npm run preview` first, per `playwright.config.ts`) |
| Build mode | `production` |
| Machine | Apple M1 Pro, 32 GB RAM, macOS 26.5.2 (build 25F84), arm64 |
| Browser | Playwright-managed Chromium 151.0.7922.34 |
| AG Grid version | 36.1.0 |
| Fixture size | 50,000 rows |

Recorded here per PRD §13.3 ("if the reference environment is not yet
agreed, record hardware/browser alongside the raw measurement and report
without declaring pass/fail"): this environment has not been independently
agreed in a design review.

## Scenario results

| Scenario | Edits measured | p50 sync CPU | p95 sync CPU | Max sync CPU | p95 edit-to-paint | Invariant/correctness violations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Visible row (row 0) | 30 (+3 warm-up) | 21.1 ms | 23.3 ms | 26.2 ms | 33.2 ms | 0 |
| Later-viewport (row 25,000) | 30 (+3 warm-up) | 19.8 ms | 21.6 ms | 25.4 ms | 33.0 ms | 0 |
| Off-screen (row 40,000) | 1 | 23.2 ms | — | — | 24.2 ms | 0 |
| Initial load | — | fixture 68 ms, grid-ready 469.1 ms | — | — | — | — |
| Burst (20 edits, 5 rows) | 20 | — | — | 432.1 ms total | — | 0 (1 `refreshCells` call, correct final values) |

Sync CPU is PRD §13.3's primary metric: `performance.now()` immediately
before `dispatch(planLineResultCellChanged(...))` to immediately after it
returns, which (per PR 4's synchronous-by-default notifier) includes the
reducer, the changed-row middleware, the notifier flush, and
`api.refreshCells` in one span with no async boundary. Edit-to-paint is the
separate, frame-aware metric (two `requestAnimationFrame` boundaries after
the synchronous commit); it carries no fixed threshold.

Raw traces and aggregate summaries: [`visible-edit-50k.json`](visible-edit-50k.json),
[`later-viewport-edit-50k.json`](later-viewport-edit-50k.json),
[`off-screen-edit-50k.json`](off-screen-edit-50k.json),
[`initial-load-50k.json`](initial-load-50k.json),
[`burst-50k.json`](burst-50k.json). Each edit-scenario file is the exact
JSON `buildInstrumentationExport` produces from `commitAndRecordInstrumentedEdit`
traces (`window.__commitAndRecordInstrumentedEdit__` / `window.__getTraces__`),
captured by `tests/browser/benchmark.spec.ts`.

## Structural invariant status

Every measured edit (81 total: 30 visible + 30 later-viewport + 1 off-screen
+ 20 burst, plus 6 additional warm-up edits recorded but not included in the
visible/later-viewport percentiles) satisfied all four invariants:

- Exactly one Redux action dispatched, changing exactly one plan line's result
- Exactly one changed-row notification naming that row and its edited-period
  plus annual-total columns
- The grid-shell render count did not increase
- No `setRowData`, whole-grid transaction, unscoped `refreshCells`, or
  `redrawRows` occurs anywhere in the edit path (verified structurally: no
  match for any of these identifiers in `app/src/features/planningModel/`,
  `app/src/instrumentation/`, `App.tsx`, or `main.tsx`)

The off-screen scenario additionally confirms no currently-rendered row's
DOM was refreshed as a side effect (`noUnrelatedVisibleRefresh: true`), and
the value is correct once the row is scrolled into view
(`revealedValueCorrect: true`). The burst scenario confirms 20 dispatches
across 5 distinct rows produced exactly one `refreshCells` call
(`refreshCallCount: 1`) with every row's final value correct
(`finalValuesCorrect: true`).

## Performance decision thresholds

PRD §13.3's proposed target is **p95 synchronous edit CPU < 1 ms** at 50,000
rows.

| Threshold | Target | Visible row | Later-viewport row |
| --- | --- | ---: | ---: |
| p95 synchronous edit CPU | < 1 ms | 23.3 ms | 21.6 ms |

**This target is missed by roughly 20×** on the reference environment
above, at every measured fixture position (visible, later-viewport, and
off-screen sync CPU are all ~20 ms; the notifier and `refreshCells` call
themselves cost ~0.1–0.2 ms each, per-trace `notification.durationMs` /
`gridRefresh.durationMs`). The cost is not in the grid/notifier layer added
by PR 4 — it is attributable to `dispatch()` itself before `refreshCells` is
even reached (confirmed by disabling the notifier's grid-refresh callback
entirely and re-measuring: the ~20 ms persisted). A follow-up probe (not
part of this PR's committed evidence) found that disabling Immer's
`autoFreeze` roughly halved the per-dispatch cost at 50,000 rows, with the
remainder attributable to Immer's structural-sharing/proxy overhead when
producing a new `results` map with 50,000 keys for a single nested-value
change — consistent with PRD §13.4's typed-buffer tradeoff discussion.

This is a measured result to hand to PR 7, not a pass/fail declaration from
this PR. Per PRD §13.3 and the Phase 2 plan's PR 5 gate, a miss against the
< 1 ms budget is the condition PR 5's conditional `Float64Array` result
buffer exists to address; that evaluation and the resulting
proceed/revise/adopt-buffer recommendation belong to PR 7.
