# POC benchmark result and recommendation

## Reference environment — recorded at PR 7, not before

The [implementation plan](../implementation-plan.md) called for the reference
benchmark machine and browser to be agreed before PR 1 was merged. That did
not happen: no reference environment was recorded in PRs 1–6. This run
retroactively establishes the reference environment described below and
issues a recommendation against it. Treat this as a process deviation from
the plan, not a silent gap — a future run on a different agreed environment
may need to be repeated.

| Field | Value |
| --- | --- |
| Exact command | `npm run test:browser` (runs `npm run build && npm run preview` first, per `playwright.config.ts`) |
| Commit SHA | `5ab6851e30721b4d458543b7cc322330408613c9` |
| Build mode | `production` |
| Machine | Apple M1 Pro, 32 GB RAM, macOS 26.5.2 (build 25F84), arm64 |
| Browser | Playwright-managed Chromium 151.0.7922.34 (Playwright 1.62.1) |
| AG Grid version | 36.1.0 |
| Fixture size | 1,000 rows (acceptance dataset); 100-row diagnostic also run |

## Results

Each scenario ran 30 measured edits after a 3-edit warm-up, per the
implementation plan's PR 6. Percentiles below are computed over the 30
measured edits only (the `scrolled-row` raw JSON also contains its 3 warm-up
traces, which are excluded here).

| Scenario | Edits measured | p50 edit-to-paint | p95 edit-to-paint | Max edit-to-paint | Invariant violations |
| --- | ---: | ---: | ---: | ---: | ---: |
| Visible row (row 0) | 30 | 14.80 ms | 16.20 ms | 16.40 ms | 0 |
| Scrolled row (row 500) | 30 | 14.80 ms | 15.50 ms | 16.80 ms | 0 |
| 100-row diagnostic | 1 | 15.40 ms | 15.40 ms | 15.40 ms | 0 |

Raw traces and aggregate summaries: [`visible-row.json`](visible-row.json),
[`scrolled-row.json`](scrolled-row.json),
[`diagnostic-100-row.json`](diagnostic-100-row.json). Each file is the exact
JSON the app's own instrumentation panel produces via Copy/Download JSON
(`buildInstrumentationExport`), captured by the benchmark test suite added
in PR 6.

### Structural invariant status

Every one of the 60 measured edits (30 visible-row + 30 scrolled-row) plus
the 100-row diagnostic edit satisfied all four PRD §8.2 invariants:

- Exactly one Redux action dispatched, changing exactly one `planLine` entity
- Exactly one AG Grid transaction with `update.length === 1`
- The grid-shell render count did not increase
- No row other than the edited one was reported as updated

Zero violations across all 61 edits. No `setRowData`, whole-grid
transaction, unscoped `refreshCells`, or `redrawRows` occurs anywhere in the
edit path (verified structurally in PR 4 via a DOM `MutationObserver` test,
and consistent with every trace's `transaction.rowIds` containing exactly
one ID here).

### Performance decision thresholds

The PRD requires p95 under 50 ms and no individual warmed-up edit exceeding
100 ms.

| Threshold | Required | Visible row | Scrolled row |
| --- | --- | ---: | ---: |
| p95 edit-to-paint | < 50 ms | 16.20 ms | 15.50 ms |
| Max edit-to-paint | < 100 ms | 16.40 ms | 16.80 ms |

Both scenarios pass with substantial margin (p95 at ~32% of budget, max at
~17% of budget).

## Recommendation: **Proceed**

The POC passes every update-scope invariant and both timing thresholds on
the reference environment recorded above. The Redux + AG Grid `applyTransaction`
integration pattern described in the PRD is validated: a single-cell edit
produces exactly one targeted row transaction, never a full-grid refresh, at
well under the 50 ms p95 / 100 ms max thresholds.

This recommendation supports the specific integration pattern tested here.
Per the PRD's decision rule, it does not validate API/WebSocket, Dexie,
worker, calculation, or full P&L behavior, and these benchmark numbers are
not production SLOs.

### Caveats for the next design review

- **Reference environment was agreed after the fact**, not before
  implementation as the plan specified. The next design review should
  confirm whether this environment (or a different one) is the one that
  should gate the ECP-1 decision, and whether a re-run is needed.
- **A real, non-race-condition-inducing input speed was assumed.** PR 6's
  development uncovered that driving edits faster than the app's own
  edit-to-paint completion signal (i.e., faster than a human could
  plausibly type) can desync AG Grid's per-edit `applyTransaction` row-swap
  from the next edit's `onCellValueChanged`, silently dropping that edit
  before it reaches Redux. This is not a scope violation — no invariant was
  broken, and every edit that did commit was correctly scoped — but it is a
  real characteristic of the current bridge design worth flagging: the
  bridge does not defend against an edit being issued before the previous
  one has fully round-tripped through AG Grid. A production implementation
  should decide whether to add explicit debouncing/queuing at the bridge
  boundary or rely on the editor UI naturally rate-limiting input.
- Diagnostic scale was only exercised at 100 rows with a single edit, not the
  optional 5,000-row fixture; the 1,000-row scenarios are the acceptance
  dataset per the PRD and are what this recommendation is based on.
