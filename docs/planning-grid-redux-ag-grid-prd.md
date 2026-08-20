# PRD — Redux + AG Grid Planning Grid Performance POC

**Status:** Proposed  
**Owner:** P&L frontend team  
**Created:** 2026-08-19  
**Reference project:** [xpna](../xpna/)  
**Decision input:** [ECP-1 design-review summary](../xpna/_a_a_docs.surf/ECP/ECP-1/design-review-summary.md)  
**Related architecture:** [ECP-1](../xpna/_a_a_docs.surf/ECP/ECP-1/ECP-1.md), phases 5 and 6

## 1. Summary

Build a self-contained browser demo of a Planning Grid with **1,000 editable plan
lines**.  The demo proves that Redux can be the authoritative UI state while AG
Grid updates only the affected row/cell after a user edit, rather than React or AG
Grid rendering the entire grid again.

The POC is a performance and integration experiment, not a replacement Planning
Grid and not an ECP-1 implementation. Its outcome will give the next design review
repeatable evidence for (or against) the Redux + AG Grid technique before P&L grid
reads and mutations are migrated from RxDB.

## 2. Problem and hypothesis

The design review restricts the current work to phases 5 and 6 and raises a
specific risk: supplying a new Redux-derived `rowData` array to AG Grid after every
state change could cause expensive whole-grid work. The POC must test the known
integration pattern instead.

**Hypothesis:** keep the grid shell and its input references stable after initial
load; keep plan-line state normalized in Redux; on a committed cell edit, translate
only the changed plan-line entity into an AG Grid row update using the Grid API and
its stable row ID. Redux subscriptions/selectors may be notified, but the grid shell
and unaffected visible cell renderers must not render because of that edit.

## 3. Goals

1. Present a Planning Grid–recognizable budget view backed by Redux Toolkit.
2. Render 1,000 deterministic, editable plan lines and a realistic set of planning
   columns.
3. Let a user change one editable reporting-period cell and immediately see the
   updated value.
4. Prove, with in-app instrumentation and an automated browser scenario, that a
   single-cell edit produces a targeted AG Grid update rather than a full-grid
   refresh.
5. Measure edit-to-visible-update latency and the work performed for both a visible
   row and a row reached after scrolling.
6. Produce a concise machine-readable and human-readable results artifact that can
   be attached to the next design review.

## 4. Non-goals

- Connecting to RxDB, Dexie, APIs, WebSockets, calculation workers, or ECP-1
  feature flags.
- Implementing real formulas, aggregation, hierarchy, versions, permissions,
  filtering, grouping, paste/fill, or multi-user convergence.
- Demonstrating the entire P&L migration, or changing the production grid.
- Treating this POC's benchmark numbers as production service-level objectives.

## 5. Demo user experience

The demo page resembles the leaf-level Planning Grid familiar to a financial
planner. It includes a title, plan/version context, a data-set size selector, an
instrumentation panel, and the grid.

Each plan line displays:

- account code and account name;
- department and location;
- a formula/type indicator (display-only);
- twelve monthly budget columns plus an annual total; and
- a row ID useful for test targeting.

The default data set contains exactly 1,000 plan lines. Monthly cells are numeric
and editable. Editing one month commits on the normal AG Grid edit event; the cell
shows the new value and the affected row's annual total updates. The demo exposes a
"Run benchmark" action that runs the prescribed edit sequence and shows the result
without requiring manual stopwatch use.

## 6. Required technical design

### 6.1 State model

Use Redux Toolkit with a normalized `planLines` entity slice. A plan line has a
stable `id`, display metadata, a `monthlyValuesByPeriodId` map, and a derived annual
total. The reducer for `planLineCellChanged` must replace only the affected entity
and its changed period value; it must not recreate every entity or a global
`rowData` array.

Seed data must be deterministic (fixed seed), so browser runs are comparable. The
default fixture is 1,000 lines × 12 editable periods. It may also offer 100 and
5,000-line diagnostic fixtures, but 1,000 lines is the acceptance dataset.

### 6.2 Redux-to-grid integration

The demo must use this pattern, or document an equivalent implementation with the
same observable behavior:

1. On initial load, create AG Grid rows from the Redux snapshot and provide them
   once to the grid.
2. Configure `getRowId` to return the plan-line ID. Keep `columnDefs`, `defaultColDef`,
   callbacks, grid options, and the grid shell's `rowData` reference stable during
   ordinary edits.
3. On `onCellValueChanged`, dispatch `planLineCellChanged` with the plan-line ID,
   period ID, and parsed value. Do not mutate AG Grid's row object as the source of
   truth.
4. A narrowly scoped Redux-to-grid bridge observes the changed entity and calls
   `api.applyTransaction({ update: [changedRow] })` (or the version-equivalent
   targeted update API). The row passed to AG Grid is projected from the canonical
   Redux entity.
5. The bridge must coalesce multiple synchronous edits to the same row into one
   update when practical, but must not batch a normal single edit behind an
   arbitrary timer.
6. The grid shell must not subscribe to the complete plan-line collection merely
   to pass a new `rowData` prop. A selector used by an individual cell/row must be
   scoped to that entity and use stable equality semantics.

The implementation may use AG Grid's immutable row-data mode only if it still
demonstrates a one-row update and does not replace the full `rowData` input after an
edit. It must not use `api.setRowData`, a full row-data replacement, `refreshCells`
without row/column targeting, or `redrawRows` for the normal edit path.

### 6.3 Expected edit flow

```text
User edits Jan value
  → AG Grid edit event
  → Redux planLineCellChanged(id, Jan, value)
  → only that normalized entity changes
  → Redux-to-grid bridge projects that entity
  → AG Grid applyTransaction(update: [one row])
  → changed Jan cell + that row's annual total are refreshed
  → instrumentation records the next painted frame
```

AG Grid remains responsible for its rendered-row model, virtualization, editing,
selection, and cell display. Redux remains the sole authoritative source for the
editable plan-line values. The bridge is the explicit synchronization boundary;
Redux is never copied into an always-replaced `rowData` React prop.

## 7. Instrumentation and evidence

Instrumentation is a first-class POC deliverable. It must be enabled in the demo
build and must have negligible effect on the normal edit path (counters and
`performance.mark`/`performance.measure`, no production console spam).

### 7.1 Per-edit trace

For every benchmarked edit, record a trace with a unique edit ID and these points:

| Point / counter | Evidence captured |
| --- | --- |
| `edit-start` | target plan-line and period; start time |
| Redux dispatch/reducer | action count, affected entity ID, reducer duration |
| Redux-to-grid bridge | notification count, affected IDs, projected-row count |
| AG Grid transaction | transaction count, `update.length`, row IDs, transaction duration |
| grid refresh | refreshed row IDs and column IDs, from grid events/cell-renderer probes where available |
| React probes | grid-shell render count; per-visible-cell render counts keyed by row/column |
| paint complete | two `requestAnimationFrame` boundaries after the transaction; edit-to-paint duration |

The probe design must distinguish React component rendering from AG Grid cell
refreshes. If a particular AG Grid version cannot expose an exact refresh event,
use an instrumented cell renderer or wrapper to count visible-cell refresh/render
work and state that limitation in the results.

### 7.2 Aggregate dashboard

Display and export:

- edit count; p50, p95, and maximum edit-to-paint time;
- reducer, bridge, and grid-transaction durations;
- grid-shell render count and its delta per edit;
- number of Redux-to-grid bridge updates and AG Grid transactions per edit;
- number of updated row IDs and rendered/refreshed visible cell IDs per edit;
- displayed versus total row count; and
- browser/device, build mode, AG Grid version, fixture size, and timestamp.

Provide a reset control and a JSON download/copy action. The JSON must contain raw
per-edit traces and the aggregate summary so results can be independently checked.

### 7.3 Automated benchmark

Add a browser test that:

1. loads the 1,000-row fixture and waits for grid readiness;
2. edits a known initially visible monthly cell repeatedly (at least 30 measured
   iterations after warm-up);
3. scrolls to a known later row, edits a visible cell there, and repeats the run;
4. reads the instrumentation summary and raw traces; and
5. stores the result artifact with the test output.

The test must assert correctness after every edit: Redux state, the target cell,
and the annual total agree. It must also assert the structural efficiency
invariants below rather than relying only on timing, which varies by machine.

## 8. Acceptance criteria

### 8.1 Functional

- [ ] The default demo loads exactly 1,000 deterministic Planning Grid plan lines.
- [ ] A user can edit a monthly value; Redux becomes the canonical updated value;
  the changed cell and annual total show the same result.
- [ ] Reloading/resetting restores the deterministic fixture.
- [ ] The app runs without RxDB/RxJS reads or writes.

### 8.2 Update-scope invariants

- [ ] Each ordinary single-cell edit dispatches one domain edit action and changes
  only one `planLine` entity in Redux.
- [ ] Each ordinary single-cell edit issues exactly one targeted AG Grid update
  transaction containing one row ID. No `setRowData`, whole-grid transaction,
  unscoped `refreshCells`, or `redrawRows` occurs.
- [ ] The grid-shell render counter does not increase for an ordinary edit.
- [ ] No unaffected visible plan-line row is refreshed/rendered by the edit.
  The changed row may refresh its edited period cell and annual-total cell; any
  additional refresh must be listed and justified by an explicit dependency.
- [ ] The 30-edit automated run records no invariant violation for either the
  initial viewport or the scrolled viewport.

### 8.3 Performance decision thresholds

Run the benchmark in a documented production-like browser build on an agreed
reference developer machine. The POC passes when the 1,000-row fixture has no
update-scope invariant violations and its measured p95 edit-to-paint is **under
50 ms**, with no individual measured edit exceeding **100 ms** after warm-up.

These are POC decision thresholds, not ECP rollout budgets. If the reference
environment is not agreed before implementation, record its hardware/browser and
report measurements without declaring a pass; the next design review sets or
confirms the threshold.

## 9. Test matrix

| Scenario | Fixture | Expected evidence |
| --- | ---: | --- |
| Initial rendering | 1,000 rows | grid-ready, row count correct, no row updates before edit |
| Visible-cell edit | 1,000 rows | one entity/action/transaction/row update; target values correct |
| Later-viewport edit | 1,000 rows | same scope invariants after scroll/virtualization |
| Repeated edits, same row | 1,000 rows | correct final value; one targeted update per completed edit |
| Repeated edits, different rows | 1,000 rows | no accumulating full-grid work; p50/p95 summary exported |
| Diagnostic scale | 100 and optionally 5,000 rows | results recorded; does not replace the required 1,000-row decision run |

## 10. Deliverables

1. A standalone demo route/app and deterministic fixtures.
2. Redux slice, selectors, and the explicit Redux-to-AG-Grid update bridge.
3. The visible instrumentation panel and exportable JSON result schema.
4. Browser test coverage for the test matrix and a captured 1,000-row result.
5. A short POC results note containing command, build mode, environment, AG Grid
   version, raw-result location, p50/p95/max timings, invariant results, and a
   recommendation: proceed, revise, or do not proceed.

## 11. Decision rule and follow-up

Proceed with the ECP-1 grid-read/mutation implementation approach only if the POC
passes every update-scope invariant and the agreed timing threshold. A pass supports
the specific integration pattern in this PRD; it does not validate API/WebSocket,
Dexie, worker, calculation, or full P&L behavior.

If it fails, retain the traces and identify whether the cause is React subscription
fan-out, AG Grid update usage, cell-renderer behavior, fixture shape, or the
benchmark environment. Propose a revised bridge or grid integration design for
review before starting a production migration based on this POC.

## 12. Open decisions

- Confirm the reference machine/browser and whether the provisional 50 ms p95 /
  100 ms maximum thresholds are accepted before benchmarking.
- Confirm the demo's home (a small standalone app versus a route within the
  frontend app) based on the preferred test/build harness. This does not change
  the required behavior or instrumentation.
