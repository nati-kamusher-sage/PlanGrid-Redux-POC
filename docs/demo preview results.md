we made a demo to the group.

# applicable docs
1. implementation plan: `docs/implementation-plan.md`
2. follow-on work: [Phase 2 implementation plan](phase-2-implementation-plan.md)

# purpsoe
After completion of the implementation plan (ref 1), a demo was conducted with the team to showcase the results of the implementation.

# Questions raised:
1. do we use the same plan line structure as xpna project use (xpna/_shared/types/src/types.ts)
export type BasePlanLine = Entity & {
  dimensions: Dimensions;
};
ophir said: "we need to have set of results, set of dimensions and set of accounts" not sure how it connects...

2. the demo should include 50000 plan lines

3. the time to edit is high. need to be less then 1 ms. need to understand whe.

## next steps. 
review the questions raised and answer the questions. suggest how to proceed to close the gaps.

## Decisions recorded (PR 1 of the Phase 2 plan)

The three questions above are answered as firm decisions in [PRD §13](planning-grid-redux-ag-grid-prd.md#13-phase-2-contract--50000-row-model-and-performance-targets):

1. **Model alignment:** yes, use XPNA's `PlanLineResult`
   (`planLineId` + `reportingPeriodsResultMap`) as the result contract, and
   `GlPlanLine`/`BasePlanLine` (`glAccountKey` + `dimensions`) as the plan-line
   identity. Accounts, dimensions, and results become three separate
   collections; a plan line holds references, not copies.
2. **50,000 plan lines:** in scope as a new deterministic fixture size,
   benchmarked separately from the completed 1,000-row result (PR 6 of the
   Phase 2 plan).
3. **Sub-1-ms requirement:** split into two metrics — synchronous edit CPU
   (p95 < 1 ms target, action start through targeted grid API completion) and
   edit-to-paint (recorded p50/p95/max, no fixed threshold, frame-aware).
   The 1,000-row 16.20 ms/15.50 ms p95 figures below are edit-to-paint, not a
   miss against the new synchronous target.

The typed-buffer question raised implicitly by Ophir's prototype (below) is
rejected for the initial implementation and accepted only conditionally; see
PRD §13.4.

## Review and proposed decisions

### 1. Align the model with XPNA without putting all domain data on every row

The current POC `PlanLine` is intentionally a display-oriented fixture: it
duplicates `accountCode`, `accountName`, `department`, and `location` onto each
row, and puts the period amounts directly on that row. It is sufficient to
prove the Redux-to-AG Grid update boundary, but it is not the XPNA model.

XPNA's `BasePlanLine` identifies a line by `id` and `dimensions`; a `GlPlanLine`
adds the GL-account key. `PlanLineResult` holds reporting-period amounts
separately. Ophir's comment is therefore consistent with modelling three
separate normalized sets:

| Set | Canonical contents | Row references |
| --- | --- | --- |
| Accounts | GL account ID/key, code, name, metadata | `glAccountKey` |
| Dimensions | dimension values, labels, hierarchy | `dimensions[dimensionId]` |
| Results | plan-line ID and reporting-period amount map | `planLineId` |

**Decision:** use the XPNA-shaped normalized model as the canonical Redux
state. Create a lightweight, writable grid-row projection that joins exactly
one plan line, its account/dimension labels, and its result map. Keep the
projection at the existing explicit bridge boundary; AG Grid must not become
the source of truth. This preserves the POC's key property: a committed edit
updates one result entity and then applies one targeted grid-row transaction.

Before implementing, confirm with Ophir whether “results” means the existing
`PlanLineResult` contract and which dimension IDs must be included in the
50,000-line scenario. This is the only open product-model decision; the
separation itself already matches the XPNA types.

### 2. Make 50,000 plan lines an explicit performance scenario

The current fixture union supports 100, 1,000, and 5,000 rows. The completed
benchmark decision is valid only for 1,000 rows; 5,000 was optional and was
not benchmarked. A 50,000-line request is a new acceptance target, not merely
a larger demo dropdown value.

Add a deterministic 50,000-row fixture using the XPNA-shaped normalized
entities, then run production-build browser benchmarks for both an initially
visible row and a later virtualized row. Record separately:

- initial fixture construction and grid-ready time;
- memory footprint, if a repeatable measurement method is agreed;
- 30 warmed-up edits per viewport, including reducer, bridge,
  `applyTransaction`, and edit-to-paint timings;
- the existing one-action / one-row-transaction / no-unaffected-row
  invariants.

Do this incrementally: first prove initial loading and one edit at 50,000;
then run the full 30-edit matrix only after update scope remains correct. Do
not compensate by rebuilding `rowData` or weakening the targeted-update
invariants.

### 3. Split the under-1-ms requirement from visible latency

The stated requirement cannot mean end-to-end visible paint in a normal
60 Hz browser. The POC measures edit-to-paint after two
`requestAnimationFrame` boundaries, which has a practical floor of roughly
two frames. Its recorded p95 is 16.20 ms (visible row) and 15.50 ms (scrolled
row), with maxima of 16.40 ms and 16.80 ms respectively.

For the synchronous edit path itself, the same raw benchmark traces show:

| Metric (p95) | Visible row | Scrolled row |
| --- | ---: | ---: |
| Redux reducer | 0.30 ms | 0.30 ms |
| Redux-to-grid bridge, including transaction | 0.80 ms | 0.90 ms |
| `applyTransaction` | 0.60 ms | 0.70 ms |

**Decision needed:** define “edit time” as either (a) synchronous
edit-start-to-`applyTransaction` completion, for which a p95 under 1 ms is
plausible on the recorded reference machine, or (b) edit-to-visible-paint,
for which the requirement must be frame-aware (for example, a p95 under one
or two display frames). The acceptance criterion should state percentile,
reference device/browser, fixture size, and whether a cold first edit is
excluded as warm-up.

## Recommended delivery order

1. Agree the XPNA entity mapping and the precise under-1-ms metric.
2. Replace the POC fixture/state with normalized accounts, dimensions, plan
   lines, and results; add reducer and projection tests.
3. Preserve the current one-row `applyTransaction` bridge and verify its
   invariants against the new model at 1,000 rows.
4. Add and benchmark 50,000 rows in a production build, first for loading and
   a single edit, then for the full visible/scrolled matrix.
5. Publish the 50,000-row raw traces and a revised recommendation against the
   agreed threshold and reference environment.

The implementation detail, pull-request sequence, acceptance checks, and
benchmark matrix for these steps are in the [Phase 2 implementation
plan](phase-2-implementation-plan.md).

## Comparison with Ophir's 50,000-row prototype

[Ophir's `ag-grid-test`](https://github.com/ophir-gross-sage/ag-grid-test)
substantially clarifies all three demo questions. It is a focused 50,000-row
AG Grid + Redux prototype, rather than a direct XPNA implementation, but its
model is deliberately split into four sets:

| Ophir's set | Intended role | XPNA/Planning-grid analogue |
| --- | --- | --- |
| `mainEntities` | stable row identity and per-row aspect references | plan lines |
| `aspects` | shared vocabulary and labels | dimension definitions/values |
| `results` | 12 editable/computed numbers per entity | `PlanLineResult.reportingPeriodsResultMap` |
| `extraData` | separate per-entity display data | account or supplementary lookup data |

This supports the interpretation of Ophir's demo comment: results, dimensions,
and accounts should be distinct canonical collections, with a plan line holding
references rather than a fully denormalized copy of each.

### What the prototype demonstrates

- It renders a stable 50,000-item `rowData` array once. Its row objects contain
  only identity and row index; cell `valueGetter`s read the canonical store
  directly for the virtualized viewport.
- Its hot results store is one `Float64Array(50,000 × 12)`, indexed by row and
  period. A cell edit writes one number in O(1), without copying a 50,000-key
  object map or allocating a replacement row.
- Middleware carries the changed row index from the action and coalesces grid
  work to one animation-frame flush. For a normal edit it refreshes only the
  changed row's result cells; it has a separate viewport refresh strategy for
  large calculation cascades.
- The repository reports approximately 0.0 ms reducer time, 0.2 ms targeted
  grid refresh, and 0.2 ms CPU total for a 50,000-row inline edit in production
  Chromium. These are useful design evidence, but must be reproduced with this
  POC's automated trace format and agreed reference environment before becoming
  an acceptance result.

### Important difference from this POC

The current POC keeps values on its projected grid row and, after an edit,
uses `api.applyTransaction({ update: [row] })`. Ophir keeps values outside row
data and uses `valueGetter`/`valueSetter` plus explicit `api.refreshCells`.
Both approaches avoid an O(50,000) `rowData` rebuild and can preserve Redux as
the source of truth. They should not be mixed accidentally:

| Situation | Recommended synchronization |
| --- | --- |
| One plan-line result changes | retain the current one-row transaction initially; benchmark it at 50,000 |
| Measurements show projection/immutable-copy cost exceeds the agreed budget | adopt Ophir's stable-row, store-read and targeted-refresh pattern |
| A calculation changes many rows | coalesce changes; refresh only named row nodes below a measured threshold, otherwise refresh the relevant rendered column family |

For the existing POC requirement, a normal one-cell edit must still name the
affected row and columns. Ophir's unscoped viewport refresh is appropriate
only for a proven bulk calculation path, not for an ordinary edit.

### Recommendation after the comparison

Use Ophir's repository as the 50,000-row architecture reference, especially
its separation of domain sets, stable `rowData`, changed-row notification, and
typed-array option for the hot numeric matrix. Begin with the simpler normalized
XPNA model plus the current targeted transaction, because it preserves the POC
invariants and is easier to validate. If its 50,000-row p95 cannot meet the
agreed synchronous budget, move the result matrix and grid synchronization to
Ophir's pattern, while documenting the explicit tradeoffs: mutable numeric
buffers, revision-based observation, and no Redux DevTools time-travel for the
result values.
