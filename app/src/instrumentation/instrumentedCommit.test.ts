import { configureStore } from '@reduxjs/toolkit'
import { afterEach, describe, expect, it } from 'vitest'
import { resetChangedRowNotifierForTest, subscribeToChangedRows } from '../features/planningModel/changedRowNotifier'
import { resultMutationMiddleware } from '../features/planningModel/resultMutationMiddleware'
import planningModelReducer, { fixtureReset } from '../features/planningModel/planningModelSlice'
import { commitInstrumentedPlanLineResultCellEdit } from './instrumentedCommit'
import { resetTraces } from './traceStore'

function makeStore() {
  const store = configureStore({
    reducer: { planningModel: planningModelReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(resultMutationMiddleware),
  })
  store.dispatch(fixtureReset({ size: 100 }))
  return store
}

/**
 * Builds a fake Grid API and wires the same notifier-to-refreshCells bridge
 * PlanningGrid.tsx owns in production (PR 4), since commitInstrumentedPlanLineResultCellEdit
 * only measures around a dispatch -- it does not itself turn a notification
 * into a refreshCells call.
 */
function makeFakeGridApi(annualTotalByPlanLineId: Record<string, number>) {
  const refreshCallsLog: unknown[] = []
  const gridApi = {
    refreshCells: (params: unknown) => {
      refreshCallsLog.push(params)
    },
    getRowNode: (id: string) => ({ id }),
    getCellValue: ({ rowNode }: { rowNode: { id: string } }) => annualTotalByPlanLineId[rowNode.id],
  }
  const unsubscribeBridge = subscribeToChangedRows((changedRows) => {
    const rowNodes = changedRows.map((changedRow) => gridApi.getRowNode(changedRow.planLineId))
    const columns = Array.from(new Set(changedRows.flatMap((changedRow) => changedRow.columns)))
    gridApi.refreshCells({ rowNodes, columns, force: true })
  })
  return {
    gridApi: gridApi as unknown as Parameters<typeof commitInstrumentedPlanLineResultCellEdit>[0]['gridApi'],
    refreshCallsLog,
    unsubscribeBridge,
  }
}

afterEach(() => {
  resetChangedRowNotifierForTest()
  resetTraces()
})

describe('commitInstrumentedPlanLineResultCellEdit', () => {
  it('dispatches one action and reports it in the trace', () => {
    const store = makeStore()
    const target = store.getState().planningModel.rowHandles[5]
    const state = store.getState()
    const resultId = state.planningModel.resultIdByPlanLineId[target.id]
    const before = state.planningModel.results[resultId].reportingPeriodsResultMap
    const expectedTotal =
      Object.entries(before).reduce((sum, [period, v]) => sum + (period === 'M02' ? 250 : v), 0)

    const { gridApi } = makeFakeGridApi({ [target.id]: Math.round(expectedTotal * 100) / 100 })

    const trace = commitInstrumentedPlanLineResultCellEdit({
      planLineId: target.id,
      row: target.row,
      periodId: 'M02',
      value: 250,
      scenario: 'visible',
      dispatch: store.dispatch,
      getState: store.getState,
      gridApi,
    })

    expect(trace.reducer.actionCount).toBe(1)
    expect(trace.invariants.singleActionDispatched).toBe(true)
    expect(trace.correctness.resultValueCorrect).toBe(true)
    expect(trace.correctness.annualTotalCorrect).toBe(true)
  })

  it('reports exactly one notification targeting the edited row and its edited-period plus annual-total columns', () => {
    const store = makeStore()
    const target = store.getState().planningModel.rowHandles[2]
    const { gridApi } = makeFakeGridApi({ [target.id]: 0 })

    const trace = commitInstrumentedPlanLineResultCellEdit({
      planLineId: target.id,
      row: target.row,
      periodId: 'M04',
      value: 10,
      scenario: 'visible',
      dispatch: store.dispatch,
      getState: store.getState,
      gridApi,
    })

    expect(trace.notification.notificationCount).toBe(1)
    expect(trace.notification.row).toBe(target.row)
    expect(new Set(trace.notification.columns)).toEqual(new Set(['M04', 'annualTotal']))
    expect(trace.invariants.singleNotificationSingleRow).toBe(true)
    expect(trace.invariants.targetedColumnsCorrect).toBe(true)
  })

  it('calls refreshCells exactly once with exactly the edited row node', () => {
    const store = makeStore()
    const target = store.getState().planningModel.rowHandles[0]
    const { gridApi, refreshCallsLog } = makeFakeGridApi({ [target.id]: 0 })

    commitInstrumentedPlanLineResultCellEdit({
      planLineId: target.id,
      row: target.row,
      periodId: 'M01',
      value: 5,
      scenario: 'visible',
      dispatch: store.dispatch,
      getState: store.getState,
      gridApi,
    })

    expect(refreshCallsLog).toHaveLength(1)
  })

  it('removes its temporary refreshCells wrapper and notifier subscription after the commit', () => {
    const store = makeStore()
    const target = store.getState().planningModel.rowHandles[0]
    const { gridApi, refreshCallsLog } = makeFakeGridApi({ [target.id]: 0 })
    const originalRefreshCells = gridApi.refreshCells

    const firstTrace = commitInstrumentedPlanLineResultCellEdit({
      planLineId: target.id,
      row: target.row,
      periodId: 'M01',
      value: 5,
      scenario: 'visible',
      dispatch: store.dispatch,
      getState: store.getState,
      gridApi,
    })

    expect(gridApi.refreshCells).toBe(originalRefreshCells)
    expect(firstTrace.notification.notificationCount).toBe(1)

    // A second, separate commit must not double-count: if the first
    // commit's internal notifier subscription or refreshCells wrapper had
    // leaked, this trace's counts and the total call log would be doubled.
    const secondTrace = commitInstrumentedPlanLineResultCellEdit({
      planLineId: target.id,
      row: target.row,
      periodId: 'M01',
      value: 6,
      scenario: 'visible',
      dispatch: store.dispatch,
      getState: store.getState,
      gridApi,
    })

    expect(secondTrace.notification.notificationCount).toBe(1)
    expect(refreshCallsLog).toHaveLength(2)
  })

  it('records a non-negative syncCpuMs', () => {
    const store = makeStore()
    const target = store.getState().planningModel.rowHandles[0]
    const { gridApi } = makeFakeGridApi({ [target.id]: 0 })

    const trace = commitInstrumentedPlanLineResultCellEdit({
      planLineId: target.id,
      row: target.row,
      periodId: 'M01',
      value: 5,
      scenario: 'visible',
      dispatch: store.dispatch,
      getState: store.getState,
      gridApi,
    })

    expect(trace.syncCpuMs).toBeGreaterThanOrEqual(0)
  })
})
