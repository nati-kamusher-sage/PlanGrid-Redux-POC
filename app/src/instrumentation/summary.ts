import type { AggregateSummary, DurationPercentiles, EditTrace } from './types'

function percentile(sortedValues: number[], p: number): number | null {
  if (sortedValues.length === 0) {
    return null
  }
  const index = Math.min(sortedValues.length - 1, Math.ceil((p / 100) * sortedValues.length) - 1)
  return sortedValues[Math.max(0, index)]
}

function durationPercentiles(values: number[]): DurationPercentiles {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted.length > 0 ? sorted[sorted.length - 1] : null,
  }
}

export function computeSummary(traces: EditTrace[]): AggregateSummary {
  const editToPaintValues = traces
    .map((trace) => trace.paint.editToPaintMs)
    .filter((value): value is number => value !== null)

  const gridShellRenderDelta = traces.reduce(
    (delta, trace) => delta + (trace.render.gridShellRenderCountAfter - trace.render.gridShellRenderCountBefore),
    0,
  )

  const invariantViolationCount = traces.filter(
    (trace) =>
      !trace.invariants.singleActionDispatched ||
      !trace.invariants.singleNotificationSingleRow ||
      !trace.invariants.targetedColumnsCorrect ||
      !trace.invariants.gridShellRenderCountStable,
  ).length

  const correctnessViolationCount = traces.filter(
    (trace) => !trace.correctness.resultValueCorrect || !trace.correctness.annualTotalCorrect,
  ).length

  return {
    editCount: traces.length,
    syncCpuMs: durationPercentiles(traces.map((trace) => trace.syncCpuMs)),
    editToPaintMs: durationPercentiles(editToPaintValues),
    gridShellRenderDelta,
    totalNotifications: traces.reduce((sum, trace) => sum + trace.notification.notificationCount, 0),
    totalRefreshCellsCalls: traces.reduce((sum, trace) => sum + trace.gridRefresh.refreshCellsCallCount, 0),
    invariantViolationCount,
    correctnessViolationCount,
  }
}
