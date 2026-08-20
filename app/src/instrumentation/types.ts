/**
 * Per-edit trace for the current planningModel architecture (Phase 2 plan,
 * PR 4-6): valueSetter -> dispatch(planLineResultCellChanged) -> reducer
 * -> changed-row notifier -> api.refreshCells. `syncCpuMs` is the PRD §13.3
 * "synchronous edit CPU" metric: action start through targeted grid API
 * completion, measured in one synchronous span with no async boundary.
 * `editToPaintMs` is the separate, frame-aware paint metric; it has no
 * fixed threshold.
 */
export interface EditTrace {
  editId: string
  planLineId: string
  row: number
  periodId: string
  /** 'live' is a real on-screen edit typed into the running app; the other three are PR 6 benchmark-harness labels. */
  scenario: 'visible' | 'later-viewport' | 'off-screen' | 'live'
  startTime: number
  reducer: {
    actionCount: number
    durationMs: number
  }
  notification: {
    notificationCount: number
    row: number | null
    columns: string[]
    durationMs: number
  }
  gridRefresh: {
    refreshCellsCallCount: number
    rowNodeCount: number
    columns: string[]
    durationMs: number
  }
  /** action start -> targeted grid API completion, one synchronous span. */
  syncCpuMs: number
  render: {
    gridShellRenderCountBefore: number
    gridShellRenderCountAfter: number
  }
  paint: {
    editToPaintMs: number | null
  }
  correctness: {
    resultValueCorrect: boolean
    annualTotalCorrect: boolean
  }
  invariants: {
    singleActionDispatched: boolean
    singleNotificationSingleRow: boolean
    targetedColumnsCorrect: boolean
    gridShellRenderCountStable: boolean
  }
}

export interface DurationPercentiles {
  p50: number | null
  p95: number | null
  max: number | null
}

export interface AggregateSummary {
  editCount: number
  syncCpuMs: DurationPercentiles
  editToPaintMs: DurationPercentiles
  gridShellRenderDelta: number
  totalNotifications: number
  totalRefreshCellsCalls: number
  invariantViolationCount: number
  correctnessViolationCount: number
}

export interface LoadTrace {
  fixtureSize: number
  /** fixture generation (Redux reducer) duration, from PlanningModelState.lastGenerationDurationMs. */
  fixtureGenerationMs: number
  /** fixture dispatch start -> AG Grid's onGridReady, one synchronous-to-async span. */
  gridReadyMs: number
  rowCount: number
  stableHandles: boolean
}

export interface BurstTrace {
  editCount: number
  distinctRowCount: number
  refreshCellsCallCount: number
  durationMs: number
  finalValuesCorrect: boolean
}

export interface RunMetadata {
  timestamp: string
  userAgent: string
  buildMode: string
  agGridVersion: string
  fixtureSize: number
  referenceEnvironment: string
}

export interface InstrumentationExport {
  metadata: RunMetadata
  summary: AggregateSummary
  traces: EditTrace[]
  load: LoadTrace | null
  burst: BurstTrace | null
}
