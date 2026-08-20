import type { GetRowIdParams, GridReadyEvent } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useMemo } from 'react'
import { useDispatch, useStore } from 'react-redux'
import type { AppDispatch, RootState } from '../../app/store'
import { noteGridShellRender } from '../../instrumentation/traceStore'
import { planningGridTheme } from './agGridSetup'
import { buildColumnDefs, DEFAULT_COL_DEF } from './gridColumns'
import { selectRowHandles } from './selectors'
import type { GridRowHandle } from './types'

function getRowId(params: GetRowIdParams<GridRowHandle>): string {
  return params.data.id
}

/**
 * Renders one row handle per plan line, built once from the fixture.
 * Every display and editable column reads/writes the canonical Redux value
 * on demand via valueGetter/valueSetter (gridColumns.ts); the row handle
 * itself never stores a period result or display label, so `rowData` keeps
 * its reference across an ordinary edit and this component does not
 * re-render because of one.
 */
export function PlanningGrid() {
  noteGridShellRender()

  const store = useStore<RootState>()
  const dispatch = useDispatch<AppDispatch>()

  const columnDefs = useMemo(
    () => buildColumnDefs({ getState: store.getState, dispatch }),
    [store, dispatch],
  )

  // Built once per mount (the store instance is stable for the component's
  // lifetime); rowData keeps this same array reference across ordinary
  // edits, since edits never touch state.planningModel.rowHandles.
  const rowData = useMemo<GridRowHandle[]>(() => selectRowHandles(store.getState()), [store])

  return (
    <AgGridReact<GridRowHandle>
      theme={planningGridTheme}
      rowData={rowData}
      columnDefs={columnDefs}
      defaultColDef={DEFAULT_COL_DEF}
      getRowId={getRowId}
      onGridReady={(event: GridReadyEvent<GridRowHandle>) => {
        window.__gridApi__ = event.api
      }}
    />
  )
}
