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
    planLineId: 'pl-000001',
    row: 0,
    periodId: 'M01',
    scenario: 'visible',
    startTime: 0,
    reducer: { actionCount: 1, durationMs: 0.1 },
    notification: { notificationCount: 1, row: 0, columns: ['M01', 'annualTotal'], durationMs: 0.1 },
    gridRefresh: { refreshCellsCallCount: 1, rowNodeCount: 1, columns: ['M01', 'annualTotal'], durationMs: 0.2 },
    syncCpuMs: 0.5,
    render: { gridShellRenderCountBefore: 0, gridShellRenderCountAfter: 0 },
    paint: { editToPaintMs: 5 },
    correctness: { resultValueCorrect: true, annualTotalCorrect: true },
    invariants: {
      singleActionDispatched: true,
      singleNotificationSingleRow: true,
      targetedColumnsCorrect: true,
      gridShellRenderCountStable: true,
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
