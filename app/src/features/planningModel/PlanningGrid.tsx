import type { GetRowIdParams, GridApi, GridReadyEvent } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useEffect, useMemo, useRef } from 'react'
import { useDispatch, useStore } from 'react-redux'
import type { AppDispatch, RootState } from '../../app/store'
import { noteGridShellRender } from '../../instrumentation/traceStore'
import { planningGridTheme } from './agGridSetup'
import { subscribeToChangedRows, type ChangedRow } from './changedRowNotifier'
import { buildColumnDefs, DEFAULT_COL_DEF } from './gridColumns'
import { selectRowHandles } from './selectors'
import type { GridRowHandle } from './types'

function getRowId(params: GetRowIdParams<GridRowHandle>): string {
  return params.data.id
}

/**
 * Targets exactly the named rows/columns via the Grid API's row-node lookup.
 * A row not currently rendered (off-screen/virtualized out) has no row node,
 * so `getRowNode` returns undefined and this performs no DOM work for it;
 * its value getters read the fresh Redux value once it scrolls into view.
 */
function refreshChangedRows(gridApi: GridApi<GridRowHandle>, changedRows: ChangedRow[]): void {
  const rowNodes = changedRows
    .map((changedRow) => gridApi.getRowNode(changedRow.planLineId))
    .filter((node): node is NonNullable<typeof node> => node !== undefined)
  if (rowNodes.length === 0) {
    return
  }
  const columns = Array.from(new Set(changedRows.flatMap((changedRow) => changedRow.columns)))
  gridApi.refreshCells({ rowNodes, columns, force: true })
}

/**
 * Renders one row handle per plan line, built once from the fixture.
 * Every display and editable column reads/writes the canonical Redux value
 * on demand via valueGetter/valueSetter (gridColumns.ts); the row handle
 * itself never stores a period result or display label, so `rowData` keeps
 * its reference across an ordinary edit and this component does not
 * re-render because of one.
 *
 * A result mutation's changed-row notification (resultMutationMiddleware.ts)
 * is turned into a targeted `api.refreshCells` call here -- the only place
 * the changed-row boundary meets the Grid API.
 */
export function PlanningGrid() {
  noteGridShellRender()

  const store = useStore<RootState>()
  const dispatch = useDispatch<AppDispatch>()
  const gridApiRef = useRef<GridApi<GridRowHandle> | null>(null)

  const columnDefs = useMemo(
    () => buildColumnDefs({ getState: store.getState, dispatch }),
    [store, dispatch],
  )

  // Built once per mount (the store instance is stable for the component's
  // lifetime); rowData keeps this same array reference across ordinary
  // edits, since edits never touch state.planningModel.rowHandles.
  const rowData = useMemo<GridRowHandle[]>(() => selectRowHandles(store.getState()), [store])

  useEffect(
    () =>
      subscribeToChangedRows((changedRows) => {
        const gridApi = gridApiRef.current
        if (gridApi && !gridApi.isDestroyed()) {
          refreshChangedRows(gridApi, changedRows)
        }
      }),
    [],
  )

  return (
    <AgGridReact<GridRowHandle>
      theme={planningGridTheme}
      rowData={rowData}
      columnDefs={columnDefs}
      defaultColDef={DEFAULT_COL_DEF}
      getRowId={getRowId}
      onGridReady={(event: GridReadyEvent<GridRowHandle>) => {
        gridApiRef.current = event.api
        window.__gridApi__ = event.api
      }}
    />
  )
}
