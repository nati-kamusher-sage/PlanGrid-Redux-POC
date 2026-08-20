import { configureStore } from '@reduxjs/toolkit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetChangedRowNotifierForTest, subscribeToChangedRows } from './changedRowNotifier'
import planningModelReducer, { fixtureReset, planLineResultCellChanged } from './planningModelSlice'
import { resultMutationMiddleware } from './resultMutationMiddleware'

function makeStore() {
  const store = configureStore({
    reducer: { planningModel: planningModelReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(resultMutationMiddleware),
  })
  store.dispatch(fixtureReset({ size: 100 }))
  return store
}

afterEach(() => {
  resetChangedRowNotifierForTest()
})

describe('resultMutationMiddleware', () => {
  it('one dispatched result action emits exactly one notification naming that row and its edited/annual-total columns', () => {
    const store = makeStore()
    const targetId = store.getState().planningModel.rowHandles[10].id
    const listener = vi.fn()
    subscribeToChangedRows(listener)

    store.dispatch(planLineResultCellChanged({ planLineId: targetId, periodId: 'M03', value: 42 }))

    expect(listener).toHaveBeenCalledTimes(1)
    const [changedRows] = listener.mock.calls[0]
    expect(changedRows).toEqual([{ planLineId: targetId, row: 10, columns: ['M03', 'annualTotal'] }])
  })

  it('reads the row index directly from the stable lookup, not by scanning the result collection', () => {
    const store = makeStore()
    const targetId = store.getState().planningModel.rowHandles[42].id
    const listener = vi.fn()
    subscribeToChangedRows(listener)

    store.dispatch(planLineResultCellChanged({ planLineId: targetId, periodId: 'M01', value: 1 }))

    expect(listener.mock.calls[0][0][0].row).toBe(42)
  })

  it('does not notify for an unrelated action or an unknown plan-line ID', () => {
    const store = makeStore()
    const listener = vi.fn()
    subscribeToChangedRows(listener)

    store.dispatch(
      planLineResultCellChanged({ planLineId: 'does-not-exist', periodId: 'M01', value: 1 }),
    )

    expect(listener).not.toHaveBeenCalled()
  })
})
