import type { GridApi } from 'ag-grid-community'
import type { AppDispatch, RootState } from '../app/store'
import { subscribeToChangedRows, type ChangedRow } from '../features/planningModel/changedRowNotifier'
import { planLineResultCellChanged } from '../features/planningModel/planningModelSlice'
import { PERIOD_IDS, type GridRowHandle, type PeriodId } from '../features/planningModel/types'
import { getGridShellRenderCount, recordTrace } from './traceStore'
import type { EditTrace } from './types'

let editCounter = 0

function nextEditId(): string {
  editCounter += 1
  return `edit-${editCounter}`
}

export interface CommitPlanLineResultCellParams {
  planLineId: string
  row: number
  periodId: PeriodId
  value: number
  scenario: EditTrace['scenario']
  dispatch: AppDispatch
  getState: () => RootState
  gridApi: GridApi<GridRowHandle>
}

/**
 * Drives exactly the production edit path (dispatch the same domain action a
 * real valueSetter dispatches) while measuring it, for the PR 6 benchmark
 * matrix. Not used by PlanningGrid.tsx's normal edit path, which stays free
 * of instrumentation overhead; this module is the only place the two meet.
 *
 * `refreshCells` is temporarily wrapped for the duration of this one commit
 * to count grid-API calls without permanently instrumenting the production
 * component -- the wrapper is removed synchronously before this function
 * returns.
 */
export function commitInstrumentedPlanLineResultCellEdit(
  params: CommitPlanLineResultCellParams,
): EditTrace {
  const { planLineId, row, periodId, value, scenario, dispatch, getState, gridApi } = params
  const editId = nextEditId()

  let notificationCount = 0
  let notifiedRow: number | null = null
  let notifiedColumns: string[] = []
  let notificationDurationMs = 0
  const unsubscribe = subscribeToChangedRows((changedRows: ChangedRow[]) => {
    const notifyStart = performance.now()
    notificationCount += changedRows.length
    const own = changedRows.find((changedRow) => changedRow.planLineId === planLineId)
    if (own) {
      notifiedRow = own.row
      notifiedColumns = own.columns
    }
    notificationDurationMs += performance.now() - notifyStart
  })

  // Wraps refreshCells to attribute its own cost separately from the
  // reducer's: both run synchronously inside the same dispatch() call
  // (PR 4's notifier flushes and PlanningGrid.tsx calls refreshCells before
  // dispatch() returns), so only a wrapper around the grid API call itself
  // can separate "reducer + middleware" time from "grid API" time.
  let refreshCellsCallCount = 0
  let refreshedRowNodeCount = 0
  let refreshedColumns: string[] = []
  let gridRefreshDurationMs = 0
  const originalRefreshCells = gridApi.refreshCells
  gridApi.refreshCells = (refreshParams) => {
    refreshCellsCallCount += 1
    refreshedRowNodeCount += refreshParams?.rowNodes?.length ?? 0
    refreshedColumns = (refreshParams?.columns ?? []).map(String)
    const refreshStart = performance.now()
    const result = originalRefreshCells.call(gridApi, refreshParams)
    gridRefreshDurationMs += performance.now() - refreshStart
    return result
  }

  const gridShellRenderCountBefore = getGridShellRenderCount()
  const startTime = performance.now()

  try {
    dispatch(planLineResultCellChanged({ planLineId, periodId, value }))
  } finally {
    gridApi.refreshCells = originalRefreshCells
    unsubscribe()
  }

  const syncCpuMs = performance.now() - startTime
  const reducerDurationMs = Math.max(0, syncCpuMs - notificationDurationMs - gridRefreshDurationMs)
  const gridShellRenderCountAfter = getGridShellRenderCount()

  const state = getState()
  const resultId = state.planningModel.resultIdByPlanLineId[planLineId]
  const result = resultId ? state.planningModel.results[resultId] : undefined
  const resultValueCorrect = result?.reportingPeriodsResultMap[periodId] === value

  let expectedAnnualTotal = 0
  for (const id of PERIOD_IDS) {
    expectedAnnualTotal += result?.reportingPeriodsResultMap[id] ?? 0
  }
  expectedAnnualTotal = Math.round(expectedAnnualTotal * 100) / 100
  const rowNode = gridApi.getRowNode(planLineId)
  const renderedAnnualTotal = rowNode ? gridApi.getCellValue({ rowNode, colKey: 'annualTotal' }) : undefined
  const annualTotalCorrect = result !== undefined && renderedAnnualTotal === expectedAnnualTotal

  const trace: EditTrace = {
    editId,
    planLineId,
    row,
    periodId,
    scenario,
    startTime,
    reducer: { actionCount: 1, durationMs: reducerDurationMs },
    notification: {
      notificationCount,
      row: notifiedRow,
      columns: notifiedColumns,
      durationMs: notificationDurationMs,
    },
    gridRefresh: {
      refreshCellsCallCount,
      rowNodeCount: refreshedRowNodeCount,
      columns: refreshedColumns,
      durationMs: gridRefreshDurationMs,
    },
    syncCpuMs,
    render: { gridShellRenderCountBefore, gridShellRenderCountAfter },
    paint: { editToPaintMs: null },
    correctness: {
      resultValueCorrect,
      annualTotalCorrect,
    },
    invariants: {
      singleActionDispatched: true,
      singleNotificationSingleRow: notificationCount === 1,
      targetedColumnsCorrect:
        notifiedRow === row &&
        notifiedColumns.includes(periodId) &&
        notifiedColumns.includes('annualTotal') &&
        notifiedColumns.length === 2,
      gridShellRenderCountStable: gridShellRenderCountAfter === gridShellRenderCountBefore,
    },
  }

  return trace
}

/**
 * Records the trace and resolves once the edit-to-paint measurement (two
 * requestAnimationFrame boundaries after the synchronous commit) is filled
 * in, per PRD §13.3's frame-aware paint metric.
 */
export function commitAndRecordInstrumentedEdit(
  params: CommitPlanLineResultCellParams,
): Promise<EditTrace> {
  const trace = commitInstrumentedPlanLineResultCellEdit(params)
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        trace.paint.editToPaintMs = performance.now() - trace.startTime
        recordTrace(trace)
        resolve(trace)
      })
    })
  })
}
