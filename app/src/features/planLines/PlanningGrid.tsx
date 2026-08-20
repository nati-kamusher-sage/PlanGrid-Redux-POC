import type {
  CellValueChangedEvent,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useMemo, useRef } from 'react'
import { useDispatch, useStore } from 'react-redux'
import type { AppDispatch, RootState } from '../../app/store'
import { instrumentedCommitPlanLineCellEdit, recordGridShellRender } from '../../instrumentation/instrumentedCommit'
import './agGridSetup'
import { planningGridTheme } from './agGridSetup'
import { parseMonthlyValueField } from './gridBridge'
import { DEFAULT_COL_DEF, buildColumnDefs } from './gridColumns'
import { projectPlanLineForGrid } from './projectRow'
import type { PlanLine } from './types'

function getRowId(params: GetRowIdParams<PlanLine>): string {
  return params.data.id
}

export function PlanningGrid() {
  recordGridShellRender()

  const store = useStore<RootState>()
  const dispatch = useDispatch<AppDispatch>()
  const gridApiRef = useRef<GridApi<PlanLine> | null>(null)

  const columnDefs = useMemo(() => buildColumnDefs(), [])

  // The store instance is stable for the component's lifetime, so this only
  // re-runs on mount: the row-data snapshot is projected on initial readiness
  // only, not re-derived on every Redux update.
  const initialRowData = useMemo<PlanLine[]>(() => {
    const state = store.getState()
    return state.planLines.ids.map((id) => projectPlanLineForGrid(state.planLines.entities[id]))
  }, [store])

  const onGridReady = useCallback((event: GridReadyEvent<PlanLine>) => {
    gridApiRef.current = event.api
  }, [])

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<PlanLine>) => {
      const periodId = parseMonthlyValueField(event.colDef.field)
      const gridApi = gridApiRef.current
      if (!periodId || !gridApi) {
        return
      }

      const value = Number(event.newValue)
      if (!Number.isFinite(value)) {
        return
      }

      instrumentedCommitPlanLineCellEdit({
        rowId: event.data.id,
        periodId,
        value,
        dispatch,
        getState: store.getState,
        gridApi,
      })
    },
    [dispatch, store],
  )

  return (
    <AgGridReact<PlanLine>
      theme={planningGridTheme}
      rowData={initialRowData}
      columnDefs={columnDefs}
      defaultColDef={DEFAULT_COL_DEF}
      getRowId={getRowId}
      onGridReady={onGridReady}
      onCellValueChanged={onCellValueChanged}
    />
  )
}
