import type { AggregateSummary, EditTrace } from './types'

function percentile(sortedValues: number[], p: number): number | null {
  if (sortedValues.length === 0) {
    return null
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil((p / 100) * sortedValues.length) - 1,
  )
  return sortedValues[Math.max(0, index)]
}

function durationPercentiles(values: number[]): { p50: number | null; p95: number | null } {
  const sorted = [...values].sort((a, b) => a - b)
  return { p50: percentile(sorted, 50), p95: percentile(sorted, 95) }
}

export function computeSummary(
  traces: EditTrace[],
  displayedRowCount: number,
  totalRowCount: number,
): AggregateSummary {
  const editToPaintValues = traces
    .map((trace) => trace.paint.editToPaintMs)
    .filter((value): value is number => value !== null)
  const sortedEditToPaint = [...editToPaintValues].sort((a, b) => a - b)

  const gridShellRenderDelta = traces.reduce((delta, trace) => {
    return delta + (trace.render.gridShellRenderCountAfter - trace.render.gridShellRenderCountBefore)
  }, 0)

  const totalUpdatedRowIds = traces.reduce((sum, trace) => sum + trace.transaction.rowIds.length, 0)
  const totalRefreshedCellIds = traces.reduce(
    (sum, trace) => sum + trace.cellRefresh.refreshedColIds.length,
    0,
  )

  const invariantViolationCount = traces.filter(
    (trace) =>
      !trace.invariants.singleActionDispatched ||
      !trace.invariants.singleTransactionSingleRow ||
      !trace.invariants.gridShellRenderCountStable ||
      !trace.invariants.noUnaffectedRowRefreshed,
  ).length

  return {
    editCount: traces.length,
    p50EditToPaintMs: percentile(sortedEditToPaint, 50),
    p95EditToPaintMs: percentile(sortedEditToPaint, 95),
    maxEditToPaintMs: sortedEditToPaint.length > 0 ? sortedEditToPaint[sortedEditToPaint.length - 1] : null,
    reducerDurationMs: durationPercentiles(traces.map((trace) => trace.reducer.durationMs)),
    bridgeDurationMs: durationPercentiles(traces.map((trace) => trace.bridge.durationMs)),
    transactionDurationMs: durationPercentiles(traces.map((trace) => trace.transaction.durationMs)),
    gridShellRenderDelta,
    totalBridgeUpdates: traces.reduce((sum, trace) => sum + trace.bridge.projectedRowCount, 0),
    totalTransactions: traces.reduce((sum, trace) => sum + trace.transaction.transactionCount, 0),
    totalUpdatedRowIds,
    totalRefreshedCellIds,
    displayedRowCount,
    totalRowCount,
    invariantViolationCount,
  }
}
