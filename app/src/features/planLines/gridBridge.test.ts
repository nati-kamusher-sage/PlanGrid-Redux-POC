import { configureStore } from '@reduxjs/toolkit'
import { describe, expect, it, vi } from 'vitest'
import { commitPlanLineCellEdit, parseMonthlyValueField } from './gridBridge'
import planLinesReducer, { fixtureReset } from './planLinesSlice'
import planningModelReducer from '../planningModel/planningModelSlice'

function makeStore() {
  const store = configureStore({
    reducer: { planLines: planLinesReducer, planningModel: planningModelReducer },
  })
  store.dispatch(fixtureReset({ size: 100 }))
  return store
}

describe('parseMonthlyValueField', () => {
  it('extracts the period ID from a monthly value field path', () => {
    expect(parseMonthlyValueField('monthlyValuesByPeriodId.M01')).toBe('M01')
    expect(parseMonthlyValueField('monthlyValuesByPeriodId.M12')).toBe('M12')
  })

  it('returns undefined for non-monthly fields', () => {
    expect(parseMonthlyValueField('annualTotal')).toBeUndefined()
    expect(parseMonthlyValueField('accountCode')).toBeUndefined()
    expect(parseMonthlyValueField(undefined)).toBeUndefined()
  })

  it('returns undefined for an unrecognized period suffix', () => {
    expect(parseMonthlyValueField('monthlyValuesByPeriodId.M13')).toBeUndefined()
  })
})

describe('commitPlanLineCellEdit', () => {
  it('dispatches exactly one domain action and issues exactly one transaction with one row', () => {
    const store = makeStore()
    const targetId = store.getState().planLines.ids[5]

    const applyTransaction = vi.fn()
    const gridApi = { applyTransaction } as unknown as Parameters<
      typeof commitPlanLineCellEdit
    >[0]['gridApi']

    const dispatchSpy = vi.spyOn(store, 'dispatch')

    commitPlanLineCellEdit({
      rowId: targetId,
      periodId: 'M04',
      value: 250,
      dispatch: store.dispatch,
      getState: store.getState,
      gridApi,
    })

    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    expect(applyTransaction).toHaveBeenCalledTimes(1)

    const transactionArg = applyTransaction.mock.calls[0][0]
    expect(transactionArg.update).toHaveLength(1)
    expect(transactionArg.update[0].id).toBe(targetId)
    expect(transactionArg.update[0].monthlyValuesByPeriodId.M04).toBe(250)

    const entity = store.getState().planLines.entities[targetId]
    expect(entity.monthlyValuesByPeriodId.M04).toBe(250)
    const expectedTotal = Object.values(entity.monthlyValuesByPeriodId).reduce(
      (sum, value) => sum + value,
      0,
    )
    expect(entity.annualTotal).toBeCloseTo(expectedTotal, 2)
    expect(transactionArg.update[0].annualTotal).toBeCloseTo(expectedTotal, 2)
  })

  it('projects a plain, writable row object rather than the frozen Redux entity', () => {
    const store = makeStore()
    const targetId = store.getState().planLines.ids[0]
    const applyTransaction = vi.fn()
    const gridApi = { applyTransaction } as unknown as Parameters<
      typeof commitPlanLineCellEdit
    >[0]['gridApi']

    commitPlanLineCellEdit({
      rowId: targetId,
      periodId: 'M01',
      value: 1,
      dispatch: store.dispatch,
      getState: store.getState,
      gridApi,
    })

    const projectedRow = applyTransaction.mock.calls[0][0].update[0]
    expect(() => {
      projectedRow.monthlyValuesByPeriodId.M02 = 999
    }).not.toThrow()
  })

  it('returns timing/count facts derived from what actually happened', () => {
    const store = makeStore()
    const targetId = store.getState().planLines.ids[2]
    const applyTransaction = vi.fn().mockImplementation((transaction) => ({
      add: [],
      remove: [],
      update: transaction.update.map((data: { id: string }) => ({ data })),
    }))
    const gridApi = { applyTransaction } as unknown as Parameters<
      typeof commitPlanLineCellEdit
    >[0]['gridApi']

    const result = commitPlanLineCellEdit({
      rowId: targetId,
      periodId: 'M06',
      value: 42,
      dispatch: store.dispatch,
      getState: store.getState,
      gridApi,
    })

    expect(result.transactionCount).toBe(1)
    expect(result.updatedRowIds).toEqual([targetId])
    expect(result.reducerDurationMs).toBeGreaterThanOrEqual(0)
    expect(result.bridgeDurationMs).toBeGreaterThanOrEqual(0)
    expect(result.transactionDurationMs).toBeGreaterThanOrEqual(0)
  })

  it('does not touch the grid when the row ID is unknown', () => {
    const store = makeStore()
    const applyTransaction = vi.fn()
    const gridApi = { applyTransaction } as unknown as Parameters<
      typeof commitPlanLineCellEdit
    >[0]['gridApi']

    const result = commitPlanLineCellEdit({
      rowId: 'does-not-exist',
      periodId: 'M01',
      value: 1,
      dispatch: store.dispatch,
      getState: store.getState,
      gridApi,
    })

    expect(applyTransaction).not.toHaveBeenCalled()
    expect(result.transactionCount).toBe(0)
    expect(result.updatedRowIds).toEqual([])
  })
})
