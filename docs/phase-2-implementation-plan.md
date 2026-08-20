# Implementation plan — Phase 2: 50,000-row Planning Grid POC

## Objective

Evolve the standalone POC to use the model demonstrated by
[Ophir's `ag-grid-test`](https://github.com/ophir-gross-sage/ag-grid-test):
stable AG Grid row handles, normalized planning entities, separate result
storage, and explicit changed-row notifications. Close the gaps recorded in
[demo preview results](demo%20preview%20results.md): XPNA model alignment,
50,000 plan lines, and an unambiguous under-1-ms edit requirement.

This plan replaces the present per-edit projected-row transaction only if the
50,000-row measurements require it. It does not change the POC into a complete
XPNA or P&L implementation.

## Target mental model

```text
Redux canonical state                 Stable AG Grid rowData (built once)
----------------------                -----------------------------------
accounts by key                       { id: planLineId, row: resultRowIndex }
dimensions by key              ───▶   { id: planLineId, row: resultRowIndex }
plan lines by id                       ... 50,000 row handles
results by plan-line/result index

Cell valueGetter(row handle) reads the required Redux value on demand.
Cell edit -> Redux result action -> changed-row notification
          -> targeted refresh of that row's affected cells
          -> valueGetter reads the new canonical value.
```

A row handle represents one plan line. It is not a denormalized copy of the
account, dimensions, and period values.

## Scope and non-goals

Included:

- 50,000 deterministic plan-line fixtures;
- XPNA-shaped plan-line, account, dimension, and result collections;
- 12 editable period results and an annual total;
- targeted, observable grid refresh for ordinary edits;
- browser benchmarks and exported evidence.

Not included:

- live APIs, RxDB, WebSockets, permissions, hierarchy, formulas, or
  multi-user synchronization;
- a production decision based on an unagreed benchmark machine; or
- a full Redux replacement policy for every XPNA feature.

## Decisions to record before the first implementation PR

1. **Result contract.** Confirm that the source result is XPNA's
   `PlanLineResult` (`planLineId` plus `reportingPeriodsResultMap`) and list
   the 12 reporting-period keys for the fixture.
2. **Grid dimensions.** Confirm the dimension categories to display (the POC
   currently uses department and location) and whether account is represented
   by `GlPlanLine.glAccountKey`.
3. **Performance contract.** Define the sub-1-ms target as p95
   `edit-start → reducer + targeted grid API completion`, measured after
   warm-up on the agreed reference device/browser. Track edit-to-paint as a
   separate frame-aware latency metric; it cannot reliably be below 1 ms.
4. **Typed-buffer policy.** Start with conventional immutable, serializable
   per-result Redux objects. Do not approve Ophir's mutable `Float64Array`
   optimization before evidence requires it. The 50,000-row benchmark is the
   decision point: consider the buffer only if the immutable result model
   misses the agreed synchronous edit budget. Its tradeoffs—revision-based
   observation, adjusted Redux checks, and no reliable DevTools time travel
   for result values—then require an explicit design-review decision.

## Pull-request sequence

| PR | Title | Depends on | Outcome |
| --- | --- | --- | --- |
| 1 | `docs: define the 50k model and performance contract` | — | Recorded decisions above; PRD and results note link to this plan. |
| 2 | `feat: add normalized XPNA-shaped fixture collections` | 1 | Deterministic accounts, dimensions, plan lines, results, and stable result-row indices at 100/1k/50k. |
| 3 | `feat: add stable plan-line grid row handles` | 2 | Grid receives a one-time `{ id, row }[]` array and reads display values through scoped selectors/value getters. |
| 4 | `feat: notify and refresh changed grid rows` | 3 | Result actions report changed plan-line/index and columns; ordinary edits refresh only their target cells. |
| 5 | `feat: add hot result-buffer option` | 4 | Conditional: add a `Float64Array` result matrix only if the immutable 50k benchmark misses the agreed budget. |
| 6 | `test: benchmark 50k loading and edits` | 4 or 5 | Production browser tests and JSON artifacts for visible/later rows, including scope and performance evidence. |
| 7 | `docs: publish 50k result and recommendation` | 6 | Reproducible result, tradeoffs, and proceed/revise recommendation. |

PRs 2–4 establish and benchmark the architecture with conventional immutable
Redux results. PR 5 is conditional; its interface should be designed in PR 2 so
it can replace only the storage implementation, not the grid integration, if
the evidence justifies that tradeoff.

## PR 1 — record the contract

Update the POC PRD and demo-results note with the approved data mapping and two
separate timings:

| Metric | Meaning | Proposed target |
| --- | --- | --- |
| Synchronous edit CPU | action start through targeted grid API completion | p95 < 1 ms at 50,000 rows |
| Edit-to-paint | action start through a defined displayed frame | frame-aware; record p50/p95/max |
| Loading | fixture reset/start through grid ready | record first; set a threshold only after review |

Acceptance checks:

- The normal edit and bulk/cascade paths have different, documented scope
  rules.
- The PRD no longer implies that end-to-end browser paint must be under 1 ms.
- The typed-buffer tradeoffs are explicitly accepted or rejected.

## PR 2 — normalized canonical state and fixtures

Introduce these domain-facing types (names may match the XPNA shared types
directly where practical):

```ts
type Account = { id: string; key: string; name: string; /* display metadata */ }
type DimensionValue = { id: string; key: string; name: string; dimensionId: string }
type PlanLine = { id: string; glAccountKey: string; dimensions: Record<string, string> }
type PlanLineResult = { id: string; planLineId: string; reportingPeriodsResultMap: Record<PeriodId, number> }
type GridRowHandle = { id: string; row: number }
```

Implementation details:

1. Generate deterministic lookup collections first, then generate 50,000 plan
   lines that reference them. Avoid copying account names or dimension labels
   onto every plan line.
2. Create a stable bidirectional lookup between `planLineId`, `resultId`, and
   `row`. The row index is an implementation detail for fast result lookup;
   `planLineId` remains the domain identity.
3. Expose two selector tiers:
   - allocation-free cell reads for the grid (`readAccountName`,
     `readDimensionLabel`, `readResultCell`);
   - materializing selectors for non-grid UI, tests, and exports.
4. Keep annual total derived from the 12 period values. It must not be a
   separately editable source of truth.

Acceptance checks:

- 100, 1,000, and 50,000 fixtures reproduce byte-for-byte domain IDs and
  values from the fixed seed.
- Every plan line resolves one account, its configured dimensions, and one
  result record.
- Editing one result changes neither account/dimension data nor another plan
  line's results.
- Fixture generation and reset report their durations for later evidence.

## PR 3 — stable grid rows and on-demand values

Replace the initial full `PlanLine` row projection with `GridRowHandle[]`, built
once when the fixture is loaded. `rowData` must retain its reference across an
ordinary edit.

For every display column, use a stable `valueGetter` that reads the required
canonical value from the store using the handle. The editable period columns use
a `valueSetter` that validates user input and dispatches the domain action; AG
Grid's row object must never store canonical period values.

Acceptance checks:

- 50,000 row handles load with `getRowId(handle) === handle.id`.
- Account and dimension columns resolve correctly from separate collections.
- Grid-shell React render count remains unchanged during an edit.
- No component selects the full result collection to derive a new `rowData`
  array after an edit.

## PR 4 — changed-row notification and targeted refresh

Add a Redux middleware or listener boundary. Each result-mutating action must
carry `planLineId`, `row`, `periodId`, and its affected column IDs. The boundary
uses that payload directly; it must never diff 50,000 Redux records to discover
what changed.

For an ordinary one-cell edit:

```text
valueSetter
  -> dispatch(setPlanLineResultCell({ planLineId, row, periodId, value }))
  -> reducer writes the canonical result
  -> changed-row notifier receives { row, columns: [periodId, annualTotal] }
  -> api.refreshCells({ rowNodes: [api.getRowNode(planLineId)], columns })
  -> value getters re-read Redux for those cells
```

Flush a single normal edit immediately so synchronous CPU timing is meaningful.
Coalesce a burst (paste, formula/cascade, or multiple synchronous dispatches)
at an animation-frame boundary. A bulk path may refresh a defined rendered
column family only after a measured threshold; it is prohibited for ordinary
single-cell edits.

Acceptance checks:

- One normal edit dispatches one action, emits one notification, and targets
  exactly one row plus its edited-period and annual-total columns.
- An off-screen edit performs no unnecessary DOM refresh, while its value is
  correct after scrolling into view.
- A rapid burst is deduplicated by row/column and does not schedule one grid
  operation per action.
- No `setRowData`, whole-grid transaction, unscoped normal-edit refresh, or
  `redrawRows` is introduced.

## PR 5 — conditional hot result storage

Keep the result read/write API from PR 2, but replace its storage with:

```ts
Float64Array(50_000 * 12)
```

where `value[row * 12 + periodIndex]` is the canonical amount. Increment an
immutable `revision` counter on each write; consumers needing notification
select the revision, not typed-array identity.

Acceptance checks:

- Reads and writes through the public result API remain correct at every
  fixture size.
- The normal-edit action and changed-row notification contract is unchanged.
- Store configuration disables only the checks that traverse this intentionally
  mutable buffer, with tests protecting its bounds and period mapping.
- The result note records the DevTools/time-travel tradeoff and measured memory
  and CPU benefit over the immutable alternative.

## PR 6 — 50,000-row test and benchmark matrix

Run against a production build and agreed reference environment.

| Scenario | Rows | Measured work | Required assertions |
| --- | ---: | --- | --- |
| Initial load | 50,000 | fixture/reset and grid-ready | row count, stable handles, no edit work |
| Visible edit | 50,000 | 3 warm-up + 30 edits | correctness, one action/notification/row, targeted columns, p95 CPU |
| Later-viewport edit | 50,000 | 3 warm-up + 30 edits | same after virtualization/scroll |
| Off-screen edit | 50,000 | single edit then scroll | no unrelated visible refresh; value correct when revealed |
| Burst | 50,000 | defined number of same/different-row edits | coalescing and final values |

Export raw traces that include fixture size, build/browser/device, action,
notification, grid API, CPU, paint, affected rows/columns, and invariant
status. Capture load and memory figures with a documented, repeatable method;
do not compare ad-hoc browser memory screenshots.

## PR 7 — decision record

Publish the source commit, command, environment, architecture variant
(immutable result records or typed buffer), fixture size, p50/p95/max metrics,
load metrics, and raw-artifact location. The recommendation must state whether
the model is ready to inform the XPNA grid phase and which tradeoffs require
production-design review.

## Exit criteria

This phase is complete only when all are true:

- 50,000 plan-line handles render from separate plan-line, account, dimension,
  and result collections;
- ordinary edits preserve Redux as the source of truth and refresh only the
  named row/cells;
- automated 50,000-row visible and scrolled runs have zero update-scope
  violations;
- the agreed p95 synchronous edit CPU threshold is met, or the result records
  the measured failure and a justified follow-up; and
- the raw evidence and resulting architecture recommendation are committed.
