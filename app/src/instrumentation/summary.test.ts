import { describe, expect, it } from 'vitest'
import { computeSummary } from './summary'
import type { EditTrace } from './types'

function makeTrace(overrides: Partial<EditTrace> = {}): EditTrace {
  return {
    editId: 'edit-1',
    rowId: 'pl-000001',
    periodId: 'M01',
    startTime: 0,
    reducer: { actionCount: 1, affectedEntityId: 'pl-000001', durationMs: 1 },
    bridge: { notificationCount: 1, affectedIds: ['pl-000001'], projectedRowCount: 1, durationMs: 2 },
    transaction: { transactionCount: 1, updateLength: 1, rowIds: ['pl-000001'], durationMs: 1 },
    cellRefresh: {
      refreshedRowIds: ['pl-000001'],
      refreshedColIds: ['M01', 'annualTotal'],
      derivedFromCellRendererProbe: true,
    },
    render: { gridShellRenderCountBefore: 1, gridShellRenderCountAfter: 1 },
    paint: { editToPaintMs: 10 },
    invariants: {
      singleActionDispatched: true,
      singleTransactionSingleRow: true,
      gridShellRenderCountStable: true,
      noUnaffectedRowRefreshed: true,
    },
    ...overrides,
  }
}

describe('computeSummary', () => {
  it('returns null percentiles and zero counts for an empty run', () => {
    const summary = computeSummary([], 1000, 1000)
    expect(summary.editCount).toBe(0)
    expect(summary.p50EditToPaintMs).toBeNull()
    expect(summary.p95EditToPaintMs).toBeNull()
    expect(summary.maxEditToPaintMs).toBeNull()
    expect(summary.invariantViolationCount).toBe(0)
  })

  it('computes p50/p95/max edit-to-paint from raw traces', () => {
    const traces = [10, 20, 30, 40, 100].map((ms) =>
      makeTrace({ paint: { editToPaintMs: ms } }),
    )
    const summary = computeSummary(traces, 1000, 1000)
    expect(summary.editCount).toBe(5)
    expect(summary.maxEditToPaintMs).toBe(100)
    expect(summary.p50EditToPaintMs).toBe(30)
  })

  it('counts invariant violations without double-counting a trace with multiple violations', () => {
    const traces = [
      makeTrace(),
      makeTrace({
        invariants: {
          singleActionDispatched: true,
          singleTransactionSingleRow: false,
          gridShellRenderCountStable: false,
          noUnaffectedRowRefreshed: true,
        },
      }),
    ]
    const summary = computeSummary(traces, 1000, 1000)
    expect(summary.invariantViolationCount).toBe(1)
  })

  it('sums bridge updates, transactions, updated row IDs, and refreshed cell IDs across traces', () => {
    const traces = [makeTrace(), makeTrace({ rowId: 'pl-000002' })]
    const summary = computeSummary(traces, 1000, 1000)
    expect(summary.totalBridgeUpdates).toBe(2)
    expect(summary.totalTransactions).toBe(2)
    expect(summary.totalUpdatedRowIds).toBe(2)
    expect(summary.totalRefreshedCellIds).toBe(4)
  })

  it('reports grid-shell render delta as zero when renders stayed stable', () => {
    const traces = [makeTrace(), makeTrace()]
    const summary = computeSummary(traces, 1000, 1000)
    expect(summary.gridShellRenderDelta).toBe(0)
  })

  it('passes through displayed and total row counts', () => {
    const summary = computeSummary([], 100, 1000)
    expect(summary.displayedRowCount).toBe(100)
    expect(summary.totalRowCount).toBe(1000)
  })
})
