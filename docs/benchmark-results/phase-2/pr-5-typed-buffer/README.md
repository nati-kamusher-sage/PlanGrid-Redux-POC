# PR 5 result note — conditional hot result buffer

Records the measured comparison and accepted tradeoffs for adopting the
`Float64Array(50_000 * 12)` result buffer (`resultBuffer.ts`), per PRD
§13.4 and the [Phase 2 implementation plan](../../../phase-2-implementation-plan.md)
PR 5. PR 6's committed evidence (`../README.md` and its sibling JSON files)
showed the immutable `Record<string, PlanLineResult>` storage missing the
p95 synchronous edit CPU budget by roughly 20× at 50,000 rows — the
condition this PR exists to address.

## What changed

`planningModel.results: Record<string, PlanLineResult>` is replaced by
`planningModel.resultValues: Float64Array(rowCount * 12)` +
`planningModel.resultRevision: number`. `values[row * 12 + periodIndex]` is
the canonical amount, indexed via the same `rowByPlanLineId` lookup built at
fixture load in PR 2. A write (`writeCell`) mutates one slot in place and
increments `resultRevision`; nothing selects the array's own reference to
detect a change, since it never changes.

The public result read/write API is unchanged: `readResultCell(state,
planLineId, periodId)`, `readAnnualTotal(state, planLineId)`, the
`planLineResultCellChanged` action, and the PR 4 changed-row notification
contract all keep their exact signatures and behavior. Every existing test
and browser spec from PRs 2–4 and PR 6's `benchmark.spec.ts` passes
unmodified against the new storage (see Correctness below) — this PR
replaced storage only, not the grid integration, as the plan required.

## Measured comparison (same reference environment as PR 6)

Reference environment, exact command, and scenario definitions are
identical to [PR 6's README](../README.md); only the storage backend
differs. Raw traces: [`visible-edit-50k.json`](visible-edit-50k.json),
[`later-viewport-edit-50k.json`](later-viewport-edit-50k.json),
[`off-screen-edit-50k.json`](off-screen-edit-50k.json),
[`initial-load-50k.json`](initial-load-50k.json),
[`burst-50k.json`](burst-50k.json).

| Metric | Immutable (PR 6 baseline) | Typed buffer (this PR) | Change |
| --- | ---: | ---: | ---: |
| p95 sync CPU — visible row | 23.3 ms | 2.2 ms | ~11× faster |
| p95 sync CPU — later-viewport row | 21.6 ms | 1.7 ms | ~13× faster |
| Sync CPU — off-screen edit | 23.2 ms | 2.1 ms | ~11× faster |
| Grid-ready (50,000 rows) | 469.1 ms | 230.9 ms | ~2× faster |
| Fixture generation (50,000 rows) | 68 ms | 51 ms | ~25% faster |
| Burst (20 edits, 5 rows) total duration | 432.1 ms | 25.4 ms | ~17× faster |

**p95 synchronous edit CPU with the typed buffer is 1.7–2.2 ms at 50,000
rows** — still over the PRD §13.3 < 1 ms target, but roughly 11–13× closer
to it than the immutable model, and the remaining cost is close to
`refreshCells`/notifier overhead already measured at ~0.1–0.2 ms in PR 6
plus normal dispatch/middleware bookkeeping, not large structural copying.

### Memory (documented estimate, not a live heap snapshot)

The plan asks for "a documented, repeatable method," not ad-hoc browser
memory screenshots. The buffer's size is exact and computable directly:
`Float64Array(50_000 * 12)` is `50_000 * 12 * 8 = 4,800,000` bytes
(≈4.58 MiB), confirmed via `buffer.byteLength` in a probe run against the
50,000-row fixture.

The immutable model's size was estimated analytically from V8's typical
per-object/string/number overheads (not measured from a live heap, which
would require a separate, harness-external tool this repo does not yet
have): 50,000 `PlanLineResult` objects, each with two ID strings, a nested
12-key `reportingPeriodsResultMap` object, and 12 period-key/number pairs,
comes to approximately **17.1 MB** — **roughly 3.6× the typed buffer's
size**. This is an estimate; a follow-up with an actual heap snapshot tool
would sharpen it, but the order of magnitude (several MB either way, buffer
smaller) is not in question given the structural difference between one
flat numeric array and 50,000 discrete objects plus their string keys.

## Correctness

- `resultBuffer.test.ts`: buffer sizing (`rowCount * 12`), read-back
  correctness for every row/period, annual-total derivation, bounds
  protection (negative/non-integer/out-of-range row throws `RangeError`
  from `readCell`/`readAnnualTotal`/`writeCell`), in-place mutation with a
  stable array reference, and period-mapping correctness (each of the 12
  period IDs maps to its own distinct, correctly ordered slot).
- `planningModelSlice.test.ts`: an edit changes only the targeted row's
  values (verified by reading every other row's 12 values before/after),
  leaves `accounts`/`dimensionValues`/`planLines`/`rowHandles` referentially
  untouched, keeps the buffer's own array reference stable across an edit,
  and increments `resultRevision` by exactly one per write.
- Every PR 2–4 and PR 6 test (52 unit, 14 browser) passes unmodified against
  the new storage, including PR 6's own `benchmark.spec.ts` invariant/
  correctness assertions (`resultValueCorrect`, `annualTotalCorrect`,
  `singleActionDispatched`, `singleNotificationSingleRow`,
  `targetedColumnsCorrect`, `gridShellRenderCountStable`) at zero
  violations across all 81 measured edits, both before and after this
  change.

## Accepted tradeoffs

- **No Redux DevTools time-travel for individual result values.** A
  `Float64Array`'s contents are not part of Immer's draft/patch machinery
  and are not diffable by DevTools' state-history view; only
  `resultRevision` changing is visible there. Reverting to a prior DevTools
  state does not restore prior result values.
- **Revision-based change observation, not value/reference observation.** A
  future consumer that needs to react to a result change (e.g. a
  `useSelector` computing something from period values) must select
  `resultRevision`, not `resultValues` or any derived object — selecting
  the array itself will never re-fire, since its reference never changes.
  This is a real, load-bearing behavior difference from a normal Redux
  slice that callers must know about.
- **Store configuration excludes one path from two dev-only checks.**
  `store.ts` adds `immutableCheck.ignoredPaths` and
  `serializableCheck.ignoredPaths` for `planningModel.resultValues` only —
  every other state path keeps both checks. Both checks are stripped from
  a production build regardless (confirmed in PR 6), so this only affects
  local development ergonomics: a bug that directly mutates `resultValues`
  outside `writeCell` would not be caught by RTK's own invariant checks the
  way a mutation to any other slice field would be.
- **Bounds and period-mapping errors now throw at runtime instead of being
  structurally impossible.** The immutable model's `Record<string,
  PlanLineResult>` made an out-of-range write a `TypeError`/silent
  `undefined` at the object-key level; the typed buffer requires explicit
  `assertInBounds` checks (present in `resultBuffer.ts`, tested in
  `resultBuffer.test.ts`) to fail loudly instead of writing past the array
  or reading `undefined` silently.

## Recommendation input

This PR does not itself decide proceed/revise/adopt — that is PR 7's job,
per the Phase 2 plan. The evidence it contributes: the typed buffer closes
most but not all of the gap to the PRD's < 1 ms target (1.7–2.2 ms
remaining vs. ~20 ms for the immutable model), at the cost of the DevTools/
revision-based-observation tradeoffs above, with no measured change to
correctness or the update-scope invariants established in PRs 2–4.
