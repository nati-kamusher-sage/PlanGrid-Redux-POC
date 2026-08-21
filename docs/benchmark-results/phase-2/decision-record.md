# Phase 2 decision record — 50,000-row planning grid

Publishes the PR 7 recommendation required by the [Phase 2 implementation
plan](../../phase-2-implementation-plan.md): source commit, exact command,
environment, architecture variant, fixture size, p50/p95/max metrics, load
metrics, raw-artifact location, and a proceed/revise recommendation with the
tradeoffs that require production-design review.

## Source and environment

| Field | Value |
| --- | --- |
| Source commit (PRs 1–6, evidence basis) | `b3d5855d3f6a030bac95f1ac5a2cfda98b05cd44` |
| Exact command | `npm run test:browser -- benchmark.spec.ts` (runs `npm run build && npm run preview` first, per `playwright.config.ts`) |
| Build mode | `production` |
| Machine | Apple M1 Pro, 32 GB RAM, macOS 26.5.2 (build 25F84), arm64 |
| Browser | Playwright-managed Chromium 151.0.7922.34 |
| AG Grid version | 36.1.0 |
| Fixture size | 50,000 rows |

As recorded in PR 6, this environment has not been independently agreed in a
design review — it was fixed retroactively, the same process deviation noted
in the Phase 1 decision record. Carry that caveat forward.

## Architecture variants evaluated

Two storage variants were built and benchmarked against the identical grid
integration (PRs 2–4: normalized collections, stable `GridRowHandle[]` rows,
changed-row notification, targeted `refreshCells`) and the identical scenario
matrix (PR 6):

1. **Immutable result records** — `planningModel.results: Record<string,
   PlanLineResult>`, conventional Redux Toolkit/Immer state. Evidence:
   [`../README.md`](../README.md).
2. **Typed hot-result buffer** — `planningModel.resultValues:
   Float64Array(rowCount * 12)` + a `resultRevision` counter, per PRD §13.4
   and PR 5's conditional gate. Evidence:
   [`pr-5-typed-buffer/README.md`](pr-5-typed-buffer/README.md).

Per the plan, the typed buffer was built *because* the immutable model missed
its budget — it is not an independent design, it is the PR 5 fallback the
plan pre-authorized.

## p50/p95/max metrics

Sync CPU (PRD §13.3: `performance.now()` immediately before `dispatch(...)`
to immediately after it returns — reducer, changed-row middleware, notifier
flush, and `refreshCells` in one synchronous span):

| Scenario | Immutable p50 | Immutable p95 | Immutable max | Buffer p95 | Buffer change |
| --- | ---: | ---: | ---: | ---: | ---: |
| Visible row (row 0) | 21.1 ms | 23.3 ms | 26.2 ms | 2.2 ms | ~11× faster |
| Later-viewport (row 25,000) | 19.8 ms | 21.6 ms | 25.4 ms | 1.7 ms | ~13× faster |
| Off-screen edit (row 40,000, 1 edit) | 23.2 ms | — | — | 2.1 ms | ~11× faster |

Edit-to-paint (frame-aware, two `requestAnimationFrame` boundaries after the
synchronous commit, no fixed threshold): immutable model p95 was 33.0–33.2 ms
across visible/later-viewport; the buffer variant's grid integration is
identical so this metric is dominated by paint/frame timing rather than the
storage change and was not separately re-measured as a percentile in PR 5's
comparison run (see `pr-5-typed-buffer/*.json` raw traces for individual
values).

## Load metrics

| Metric | Immutable | Typed buffer | Change |
| --- | ---: | ---: | ---: |
| Fixture generation (50,000 rows) | 68 ms | 51 ms | ~25% faster |
| Grid-ready (50,000 rows) | 469.1 ms | 230.9 ms | ~2× faster |
| Burst (20 edits, 5 rows) total duration | 432.1 ms | 25.4 ms | ~17× faster |

## Raw-artifact location

- Immutable baseline: [`docs/benchmark-results/phase-2/*.json`](.) —
  `visible-edit-50k.json`, `later-viewport-edit-50k.json`,
  `off-screen-edit-50k.json`, `initial-load-50k.json`, `burst-50k.json`.
- Typed buffer comparison:
  [`docs/benchmark-results/phase-2/pr-5-typed-buffer/*.json`](pr-5-typed-buffer/)
  — same five scenario files, same schema, storage backend only differs.

Each file is the exact JSON `buildInstrumentationExport` produces
(`window.__commitAndRecordInstrumentedEdit__` / `window.__getTraces__`),
captured by `tests/browser/benchmark.spec.ts`.

## Structural invariant status

Both variants passed all four PRD §8.2/§13.3 invariants across every measured
edit (81 per variant: 30 visible + 30 later-viewport + 1 off-screen + 20
burst): exactly one Redux action and one changed-row notification per edit,
targeting exactly the edited row's period-and-annual-total columns; no
increase in grid-shell render count; no `setRowData`, whole-grid transaction,
unscoped `refreshCells`, or `redrawRows` anywhere in the edit path. Zero
invariant or correctness violations in either variant.

## Performance decision threshold

PRD §13.3's target: p95 synchronous edit CPU **< 1 ms** at 50,000 rows.

| Variant | p95 sync CPU (worst scenario) | Result |
| --- | ---: | --- |
| Immutable result records | 23.3 ms | **Missed by ~20×** |
| Typed hot-result buffer | 2.2 ms | **Missed by ~2×** |

Neither variant meets the < 1 ms target. The typed buffer closes roughly
90% of the gap (23.3 ms → 2.2 ms) but does not clear the bar. PR 6 and PR 5's
root-cause work localizes the remaining cost differently for each:

- Immutable model: dominated by Immer's `autoFreeze` and structural sharing
  over a 50,000-key `Record` on every dispatch (confirmed by a
  `setAutoFreeze(false)` probe, which roughly halved the cost — the
  remainder is proxy/structural-sharing overhead, not the PR 4 grid/notifier
  layer, which costs ~0.1–0.2 ms on its own).
- Typed buffer: the remaining 1.7–2.2 ms is close to ordinary
  dispatch/middleware bookkeeping plus the same ~0.1–0.2 ms notifier/
  `refreshCells` cost already measured in PR 6 — there is no large
  structural copy left to remove.

Per the exit criteria, this is the case where "the agreed p95 synchronous
edit CPU threshold is met, or the result records the measured failure and a
justified follow-up." The threshold is not met by either variant; this
record is that measured failure and follow-up.

## Recommendation: **Proceed, with the typed buffer, and revise the sub-1ms target**

The grid-integration pattern from PRs 2–4 (stable row handles, on-demand
value getters, changed-row notification, targeted `refreshCells`) is
validated independent of storage choice: both variants hit zero update-scope
or correctness violations at 50,000 rows across visible, later-viewport,
off-screen, and burst scenarios. That architecture is ready to inform the
XPNA grid phase.

The storage choice is not fully settled:

- The **typed `Float64Array` buffer** is the variant that should carry
  forward if a sub-few-millisecond synchronous edit budget matters to the
  XPNA grid phase. It is 11–13× faster than the immutable model at 50,000
  rows, ~2× faster to reach grid-ready, uses roughly 3.6× less memory
  (4.8 MB exact vs. ~17.1 MB estimated), and did not regress any
  correctness or update-scope invariant in PRs 2–4's test suite (52 unit +
  14 browser tests, unmodified, zero violations).
- The **< 1 ms p95 target itself was not met by either variant** and should
  be revised in the next design review rather than carried forward
  unchanged. 2.2 ms at 50,000 rows with a flat typed array and no
  remaining structural copying is close to a practical floor for this
  dispatch/middleware/refreshCells shape in this environment; hitting
  sub-1ms would likely require an architecture change beyond result
  storage (e.g. bypassing the Redux dispatch path for the hot edit case
  entirely), which this POC was not scoped to explore.

### Tradeoffs that require production-design review

1. **No Redux DevTools time-travel for individual result values** when using
   the typed buffer — only `resultRevision` is visible in state history;
   reverting to a prior DevTools snapshot does not restore prior result
   values. Decide whether this is acceptable for XPNA's debugging workflow.
2. **Revision-based, not reference-based, change observation.** Any future
   consumer reading result values reactively must select `resultRevision`,
   not the buffer or a derived object — this is a different mental model
   from the rest of the Redux store and needs to be documented as a
   house rule if adopted.
3. **`store.ts` excludes the result-buffer path from `immutableCheck` and
   `serializableCheck`.** Both checks are stripped in production regardless,
   but a local-dev mutation bug outside `writeCell` would go undetected the
   way it would be caught on every other slice. Decide whether additional
   dev-only guarding (e.g. a debug-mode bounds/identity assertion) is worth
   adding before this ships in a real feature.
4. **Bounds and period-mapping errors are now runtime throws
   (`RangeError`), not structurally impossible states.** `resultBuffer.ts`'s
   `assertInBounds` is tested, but this is a new failure mode class the
   immutable model didn't have; review whether XPNA's error-handling
   conventions want these surfaced differently (e.g. reported to telemetry
   rather than thrown).
5. **Reference environment was fixed after PR 6, not agreed before PR 1**, a
   repeat of the same process gap noted in the Phase 1 decision record. The
   next design review should agree a reference machine/browser before any
   number here is used to gate a production decision, and budget for a
   re-run if that environment differs from the one used here.
6. **Memory comparison is a documented estimate for the immutable side, not
   a live heap snapshot** (buffer size is exact via `byteLength`; the
   immutable model's ~17.1 MB is computed analytically from V8's typical
   per-object overhead). A follow-up with an actual heap-snapshot tool would
   sharpen this number before it is used as a hard capacity-planning input.
