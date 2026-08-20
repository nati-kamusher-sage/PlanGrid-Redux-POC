import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getGridShellRenderCount,
  getTraces,
  noteGridShellRender,
  recordTrace,
  resetTraces,
  subscribe,
} from './traceStore'
import type { EditTrace } from './types'

function makeTrace(editId: string): EditTrace {
  return {
    editId,
    rowId: 'pl-000001',
    periodId: 'M01',
    startTime: 0,
    reducer: { actionCount: 1, affectedEntityId: 'pl-000001', durationMs: 1 },
    bridge: { notificationCount: 1, affectedIds: ['pl-000001'], projectedRowCount: 1, durationMs: 1 },
    transaction: { transactionCount: 1, updateLength: 1, rowIds: ['pl-000001'], durationMs: 1 },
    cellRefresh: { refreshedRowIds: ['pl-000001'], refreshedColIds: ['M01'], derivedFromCellRendererProbe: true },
    render: { gridShellRenderCountBefore: 0, gridShellRenderCountAfter: 0 },
    paint: { editToPaintMs: 5 },
    invariants: {
      singleActionDispatched: true,
      singleTransactionSingleRow: true,
      gridShellRenderCountStable: true,
      noUnaffectedRowRefreshed: true,
    },
  }
}

beforeEach(() => {
  resetTraces()
})

describe('traceStore', () => {
  it('accumulates recorded traces in order', () => {
    recordTrace(makeTrace('edit-1'))
    recordTrace(makeTrace('edit-2'))
    expect(getTraces().map((t) => t.editId)).toEqual(['edit-1', 'edit-2'])
  })

  it('reset clears traces deterministically', () => {
    recordTrace(makeTrace('edit-1'))
    resetTraces()
    expect(getTraces()).toEqual([])
  })

  it('notifies subscribers on record and reset', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)

    recordTrace(makeTrace('edit-1'))
    expect(listener).toHaveBeenCalledTimes(1)

    resetTraces()
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    recordTrace(makeTrace('edit-2'))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('increments a monotonic grid-shell render counter', () => {
    const before = getGridShellRenderCount()
    noteGridShellRender()
    noteGridShellRender()
    expect(getGridShellRenderCount()).toBe(before + 2)
  })
})
