# Implementation plan — Redux + AG Grid Planning Grid POC

## Purpose

Deliver the POC described in the [product requirements](planning-grid-redux-ag-grid-prd.md)
through small, independently reviewable pull requests. The recommended delivery
target is a standalone Vite + React + TypeScript app in this repository. This
keeps the experiment isolated from the production application while preserving a
real browser build and test harness.

Before PR 1 is merged, record the reference benchmark machine and browser in the
issue/PR description. Until then, benchmark results are evidence, not a pass/fail
decision against the provisional 50 ms p95 and 100 ms maximum thresholds.

## Pull-request sequence

| PR | Title | Depends on | Outcome |
| --- | --- | --- | --- |
| 1 | `chore: scaffold Planning Grid POC` | — | Runnable standalone app, pinned tooling, and browser-test harness |
| 2 | `feat: add deterministic plan-line fixtures and Redux state` | 1 | Normalized canonical plan-line state with deterministic 100/1,000/5,000 fixtures |
| 3 | `feat: render the Planning Grid shell` | 2 | Stable AG Grid shell displaying the 1,000-row budget view |
| 4 | `feat: bridge targeted Redux edits to AG Grid` | 3 | One edited entity produces one targeted row transaction and correct totals |
| 5 | `feat: add update-scope instrumentation and result export` | 4 | On-screen evidence, raw edit traces, aggregate summary, JSON export |
| 6 | `test: automate the 1,000-row benchmark matrix` | 5 | Browser coverage of visible and scrolled edits plus test result artifacts |
| 7 | `docs: publish POC benchmark result and recommendation` | 6 | Reproducible decision record from a production-like run |

Do not combine PRs 3 and 4: the split lets reviewers verify stable grid inputs
before the state-to-grid synchronization bridge is added.

## PR 1 — scaffold Planning Grid POC

Create the standalone app using React, TypeScript, Redux Toolkit, AG Grid and a
browser-test runner (Playwright recommended). Add development, production-build,
preview, unit-test, and browser-test commands. Add a minimal route/page that runs
locally and in CI.

Acceptance checks:

- The production build succeeds and the preview serves the app.
- A smoke browser test can load the demo page.
- Dependency versions, especially AG Grid, are locked.
- README gains local setup and verification commands.

## PR 2 — deterministic fixtures and Redux state

Define `PlanLine`, period IDs, and a deterministic seeded fixture generator. Create
a normalized Redux slice (`ids` plus `entities`) and selectors. Implement
`planLineCellChanged({ id, periodId, value })` so it changes one entity and derives
the affected annual total without rebuilding a global row-data collection. Expose a
fixture-size reset action for 100, 1,000, and optionally 5,000 rows.

Acceptance checks:

- The default fixture contains exactly 1,000 stable IDs and 12 editable periods.
- Recreating a fixture produces the same records and values.
- Reducer tests prove that a single edit changes only its plan-line entity and
  yields the correct annual total.
- Selectors have stable, narrowly scoped semantics suitable for the bridge.

## PR 3 — Planning Grid shell

Build the recognizable planning-grid page: title/context, fixture-size selector,
and AG Grid with account, department, location, type, twelve monthly columns,
annual total, and a testable row ID. On initial readiness only, project the Redux
snapshot to row data and supply it to the grid. Configure `getRowId` and memoize
column definitions, callbacks, default-column configuration, and grid options.

Acceptance checks:

- The default page displays 1,000 rows and the intended columns.
- Monthly cells are presented as editable numeric cells; annual total is read-only.
- The app does not require RxDB, RxJS, APIs, workers, or WebSockets.
- A browser test establishes grid readiness and validates an initial row.

## PR 4 — targeted Redux-to-AG Grid bridge

Add the edit path and make the synchronization boundary explicit:

```text
AG Grid cell edit → Redux domain action → changed entity notification
→ row projection → api.applyTransaction({ update: [row] })
```

The grid callback parses and dispatches the value but does not treat AG Grid's row
object as canonical state. The bridge must retain the grid API, observe changed IDs
only, project the canonical entity, and invoke one transaction with one row for a
normal completed edit. Coalesce only synchronous same-row edits when practical.

Acceptance checks:

- Edited monthly value, Redux state, and annual total agree.
- A normal edit dispatches exactly one domain action and changes one entity.
- The bridge makes exactly one transaction with `update.length === 1`.
- Normal edits never call `setRowData`, `redrawRows`, or an unscoped
  `refreshCells`.
- A test proves that grid-shell inputs and render count stay stable through an
  ordinary edit.

## PR 5 — instrumentation and export

Implement a low-overhead instrumentation store outside the full grid-data render
path. Record per-edit trace points for start, Redux reducer, bridge notification,
AG Grid transaction, visible refresh/render probes, and paint completion after two
`requestAnimationFrame` boundaries. Add a dashboard with reset, counts, latency
percentiles, update scope, fixture metadata, and copy/download JSON controls.

Use instrumented cell renderers or AG Grid events to distinguish React renders from
AG Grid refresh work. Document any event-version limitation directly beside the
metric.

Acceptance checks:

- Exported JSON includes raw traces, aggregate summary, timestamp, browser/device,
  build mode, AG Grid version, and fixture size.
- Each trace has row/period targets, transaction row IDs, duration data, and
  invariant results.
- Instrumentation identifies grid-shell renders separately from cell refreshes.
- Reset clears the run deterministically without changing the fixture unless
  explicitly requested.

## PR 6 — automated benchmark matrix

Add Playwright coverage that runs against the production-like build. After warm-up,
perform at least 30 measured edits on a known visible row and repeat after scrolling
to a known later row. After every edit, assert Redux state, the visible monthly
cell, and annual total. Read the instrumentation output and assert structural
invariants rather than machine-dependent timing alone.

Persist each run's JSON result in the test-output directory; upload it from CI as
an artifact when CI is configured.

Acceptance checks:

- Both viewport scenarios have 30 measured edits and no invariant violations.
- Every ordinary edit records one action, one bridge update, one transaction, and
  one updated row ID.
- No unaffected visible plan-line row is reported as refreshed/rendered.
- The suite also covers initial load, repeated same-row edits, repeated
  different-row edits, and the 100-row diagnostic fixture.

## PR 7 — benchmark result and recommendation

Run the automated 1,000-row scenario in a production build on the agreed reference
environment. Commit a concise results note and the associated raw JSON artifact
(or a stable linked CI artifact if repository policy excludes generated artifacts).

The note must state the exact command, commit SHA, build mode, machine/browser,
AG Grid version, fixture size, p50/p95/max edit-to-paint results, structural
invariant status, artifact location, and one recommendation: **proceed**,
**revise**, or **do not proceed**.

Acceptance checks:

- A recommendation is made only when the reference environment is agreed.
- A pass requires zero scope violations, p95 under 50 ms, and no warmed-up edit
  exceeding 100 ms.
- Any failure is classified (Redux subscription fan-out, bridge usage, cell
  renderer behavior, fixture shape, or environment) and followed by a proposed
  design change.

## Review and merge rules

- Each PR is based on the preceding merged PR and includes focused tests.
- Keep fixture generation, state projections, grid bridge, and instrumentation in
  separate modules; no component may both subscribe to all plan lines and replace
  `rowData` after edits.
- Require production build plus relevant unit/browser tests before merge.
- Treat a timing regression without a scope violation as investigation work; treat
  any whole-grid update-path violation as a blocker for the POC decision.
