import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  batchChangedRowNotifications,
  notifyChangedRow,
  resetChangedRowNotifierForTest,
  subscribeToChangedRows,
} from './changedRowNotifier'

afterEach(() => {
  resetChangedRowNotifierForTest()
})

describe('notifyChangedRow (outside a batch)', () => {
  it('flushes synchronously: the listener has already run by the time notifyChangedRow returns', () => {
    const listener = vi.fn()
    subscribeToChangedRows(listener)

    notifyChangedRow({ planLineId: 'pl-000001', row: 0, columns: ['M01', 'annualTotal'] })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith([
      { planLineId: 'pl-000001', row: 0, columns: ['M01', 'annualTotal'] },
    ])
  })

  it('emits one notification per call for two separate, non-batched edits', () => {
    const listener = vi.fn()
    subscribeToChangedRows(listener)

    notifyChangedRow({ planLineId: 'pl-000001', row: 0, columns: ['M01', 'annualTotal'] })
    notifyChangedRow({ planLineId: 'pl-000002', row: 1, columns: ['M02', 'annualTotal'] })

    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('an unsubscribed listener does not receive further notifications', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToChangedRows(listener)
    unsubscribe()

    notifyChangedRow({ planLineId: 'pl-000001', row: 0, columns: ['M01'] })

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('batchChangedRowNotifications', () => {
  it('coalesces a burst of same-row notifications into one flush with deduplicated columns', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const listener = vi.fn()
    subscribeToChangedRows(listener)

    batchChangedRowNotifications(() => {
      notifyChangedRow({ planLineId: 'pl-000001', row: 0, columns: ['M01', 'annualTotal'] })
      notifyChangedRow({ planLineId: 'pl-000001', row: 0, columns: ['M02', 'annualTotal'] })
    })

    expect(listener).toHaveBeenCalledTimes(1)
    const [changedRows] = listener.mock.calls[0]
    expect(changedRows).toHaveLength(1)
    expect(changedRows[0].planLineId).toBe('pl-000001')
    expect(new Set(changedRows[0].columns)).toEqual(new Set(['M01', 'M02', 'annualTotal']))
    vi.unstubAllGlobals()
  })

  it('coalesces a burst across different rows into one flush, not one grid operation per action', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const listener = vi.fn()
    subscribeToChangedRows(listener)

    batchChangedRowNotifications(() => {
      for (let i = 0; i < 20; i += 1) {
        notifyChangedRow({ planLineId: `pl-${i}`, row: i, columns: ['M01', 'annualTotal'] })
      }
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0]).toHaveLength(20)
    vi.unstubAllGlobals()
  })

  it('does not flush before the animation-frame callback runs', () => {
    const rafCallbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    const listener = vi.fn()
    subscribeToChangedRows(listener)

    batchChangedRowNotifications(() => {
      notifyChangedRow({ planLineId: 'pl-000001', row: 0, columns: ['M01'] })
    })

    expect(listener).not.toHaveBeenCalled()
    rafCallbacks[0](0)
    expect(listener).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
