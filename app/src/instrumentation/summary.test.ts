import { describe, expect, it } from 'vitest'
import { computeSummary } from './summary'
import type { EditTrace } from './types'

function makeTrace(overrides: Partial<EditTrace> = {}): EditTrace {
  return {
    editId: 'edit-1',
    planLineId: 'pl-000001',
    row: 0,
    periodId: 'M01',
    scenario: 'visible',
    startTime: 0,
    reducer: { actionCount: 1, durationMs: 0.1 },
    notification: { notificationCount: 1, row: 0, columns: ['M01', 'annualTotal'], durationMs: 0.1 },
    gridRefresh: { refreshCellsCallCount: 1, rowNodeCount: 1, columns: ['M01', 'annualTotal'], durationMs: 0.2 },
    syncCpuMs: 0.5,
    render: { gridShellRenderCountBefore: 1, gridShellRenderCountAfter: 1 },
    paint: { editToPaintMs: 10 },
    correctness: { resultValueCorrect: true, annualTotalCorrect: true },
    invariants: {
      singleActionDispatched: true,
      singleNotificationSingleRow: true,
      targetedColumnsCorrect: true,
      gridShellRenderCountStable: true,
    },
    ...overrides,
  }
}

describe('computeSummary', () => {
  it('returns null percentiles and zero counts for an empty run', () => {
    const summary = computeSummary([])
    expect(summary.editCount).toBe(0)
    expect(summary.syncCpuMs).toEqual({ p50: null, p95: null, max: null })
    expect(summary.editToPaintMs).toEqual({ p50: null, p95: null, max: null })
    expect(summary.invariantViolationCount).toBe(0)
  })

  it('computes p50/p95/max synchronous CPU and edit-to-paint from raw traces', () => {
    const traces = [10, 20, 30, 40, 100].map((ms) =>
      makeTrace({ syncCpuMs: ms / 100, paint: { editToPaintMs: ms } }),
    )
    const summary = computeSummary(traces)
    expect(summary.editCount).toBe(5)
    expect(summary.editToPaintMs.max).toBe(100)
    expect(summary.editToPaintMs.p50).toBe(30)
    expect(summary.syncCpuMs.max).toBe(1)
    expect(summary.syncCpuMs.p50).toBe(0.3)
  })

  it('counts invariant violations without double-counting a trace with multiple violations', () => {
    const traces = [
      makeTrace(),
      makeTrace({
        invariants: {
          singleActionDispatched: true,
          singleNotificationSingleRow: false,
          targetedColumnsCorrect: false,
          gridShellRenderCountStable: true,
        },
      }),
    ]
    const summary = computeSummary(traces)
    expect(summary.invariantViolationCount).toBe(1)
  })

  it('counts a correctness violation independently of invariant violations', () => {
    const traces = [makeTrace(), makeTrace({ correctness: { resultValueCorrect: false, annualTotalCorrect: true } })]
    const summary = computeSummary(traces)
    expect(summary.correctnessViolationCount).toBe(1)
    expect(summary.invariantViolationCount).toBe(0)
  })

  it('sums notifications and refreshCells calls across traces', () => {
    const traces = [makeTrace(), makeTrace({ planLineId: 'pl-000002', row: 1 })]
    const summary = computeSummary(traces)
    expect(summary.totalNotifications).toBe(2)
    expect(summary.totalRefreshCellsCalls).toBe(2)
  })

  it('reports grid-shell render delta as zero when renders stayed stable', () => {
    const traces = [makeTrace(), makeTrace()]
    const summary = computeSummary(traces)
    expect(summary.gridShellRenderDelta).toBe(0)
  })
})
