# One edit, one row — the Redux/AG Grid integration

Redux and a virtualized grid want opposite things. Redux's contract is
*recompute the view from state* — a component subscribes, state changes, the
component re-renders with fresh props. A grid holding a thousand rows wants
the opposite: touch only the DOM nodes for the row that changed, and leave
the other 999 alone. Wire them together the naive way — select the whole
collection, hand it to the grid as `rowData` on every render — and every edit
anywhere in the sheet forces a diff of the entire row model.

The fix isn't a library. It's three separate decisions that only work
because they're made together: how the state is *shaped*, where the
subscription boundary is *drawn*, and how a change gets *handed off* to the
grid once React is no longer in the loop.

## The path an edit takes

A committed cell edit crosses four stages. Only the last one touches the
DOM, and it touches exactly one row.

```text
Grid edit  →  Redux action  →  Bridge  →  Row transaction
(cell        (one reducer     (reads      (applyTransaction,
 commits)     call, one       back the     one row, DOM
              entity          changed      patched)
              replaced)       entity)
```

## Three techniques, one mechanism

None of these is exotic on its own. What makes the pattern work is that all
three hold at once — drop any one and the edit degrades back to a full-grid
diff.

### 1. Normalize the state so one edit touches one reference

Plan lines live as `{ ids, entities }`, not a flat array. Immer replaces the
one entity that changed; the `entities` map and every sibling entity keep
the reference they had before the dispatch. A flat array can't offer this —
changing one element still means producing a new array, and now every
consumer watching the array reference sees a change, whether it cares about
row 4 or row 940.

```ts
// planLinesSlice.ts
planLineCellChanged(state, action) {
  // state.entities and every OTHER entity keep their reference
  const entity = state.entities[id]
  entity.monthlyValuesByPeriodId[periodId] = value
  entity.annualTotal = recompute(entity)
}
```

### 2. Read the collection once, then stop asking

The instinctive React move is a live selector —
`useSelector(s => s.planLines.ids.map(...))` — re-run on every state change
and handed to `rowData` as a prop. That's the boundary this design refuses
to cross. The grid shell reads the store exactly once, on mount, outside any
reactive subscription. After that, AG Grid owns the row model; Redux is
never asked for the full collection again.

```tsx
// PlanningGrid.tsx
// keyed on the stable store instance — runs once, not on every edit
const initialRowData = useMemo(() => {
  const state = store.getState()
  return state.planLines.ids.map((id) =>
    projectPlanLineForGrid(state.planLines.entities[id]),
  )
}, [store])
```

### 3. Hand the grid a delta, not a dataset

The grid's own cell-edit event already names the exact row and period that
changed — there's no diffing to do. The bridge dispatches the domain action,
reads back that one entity, and calls AG Grid's `applyTransaction` with a
one-row update. AG Grid resolves the transaction against its own row-id
index and patches only that row's DOM nodes.

```ts
// gridBridge.ts — commitPlanLineCellEdit
dispatch(planLineCellChanged({ id: rowId, periodId, value }))

// re-read just the one entity the dispatch above touched
const entity = getState().planLines.entities[rowId]

gridApi.applyTransaction({
  update: [projectPlanLineForGrid(entity)], // exactly one row
})
```

> **The projected row is a plain copy, not the Redux entity itself.** Redux
> Toolkit deep-freezes state in development; AG Grid's own cell editors
> write in-progress values onto the row object they're given. Hand the grid
> the frozen original and the very next keystroke throws.
> `projectPlanLineForGrid` shallow-copies the entity before it ever reaches
> the grid.

## What this replaces

AG Grid gives three ways to move a change into its row model. Two of them
are the ones this design deliberately avoids on the edit path.

| API | What it does | Cost on 1,000 rows | Used here |
| --- | --- | --- | --- |
| `setRowData(all)` | Replaces the entire row array | Full row-model rebuild | Never |
| `redrawRows()` | Recreates row DOM from scratch | Full DOM teardown | Never |
| `applyTransaction()` | Diffs by row id, patches in place | O(1) — one row | Every edit |

## What it measures out to

Instrumented and benchmarked across 60 edits on a 1,000-row fixture — 30 on
a visible row, 30 on a row reached by scrolling — every edit produced
exactly one dispatched action and one one-row transaction. Zero exceptions.

| Metric | Result |
| --- | --- |
| Actions dispatched per edit / transactions per edit | 1 / 1 |
| Grid-shell re-renders caused by an edit | 0 |
| p50 edit-to-paint, reference environment | ~15 ms |
| Rows other than the edited one ever refreshed | 0 |

The grid-shell-render figure is the tell. If the collection-level selector
had crept back in anywhere on the write path, this number stops being zero
the first time it's measured.

See [`docs/benchmark-results/README.md`](benchmark-results/README.md) for
the full benchmark run, environment, and raw traces this table is drawn
from.
