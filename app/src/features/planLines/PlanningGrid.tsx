import type { GetRowIdParams, GridApi, GridReadyEvent } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useMemo, useRef } from 'react'
import { useStore } from 'react-redux'
import type { RootState } from '../../app/store'
import './agGridSetup'
import { planningGridTheme } from './agGridSetup'
import { DEFAULT_COL_DEF, buildColumnDefs } from './gridColumns'
import { projectPlanLineForGrid } from './projectRow'
import type { PlanLine } from './types'

function getRowId(params: GetRowIdParams<PlanLine>): string {
  return params.data.id
}

export function PlanningGrid() {
  const store = useStore<RootState>()
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

  return (
    <AgGridReact<PlanLine>
      theme={planningGridTheme}
      rowData={initialRowData}
      columnDefs={columnDefs}
      defaultColDef={DEFAULT_COL_DEF}
      getRowId={getRowId}
      onGridReady={onGridReady}
    />
  )
}
