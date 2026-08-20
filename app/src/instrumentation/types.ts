export interface EditTrace {
  editId: string
  rowId: string
  periodId: string
  startTime: number
  reducer: {
    actionCount: number
    affectedEntityId: string
    durationMs: number
  }
  bridge: {
    notificationCount: number
    affectedIds: string[]
    projectedRowCount: number
    durationMs: number
  }
  transaction: {
    transactionCount: number
    updateLength: number
    rowIds: string[]
    durationMs: number
  }
  cellRefresh: {
    refreshedRowIds: string[]
    refreshedColIds: string[]
    /** True when the AG Grid version in use cannot expose an exact refresh
     * event and refresh counts are derived from instrumented cell renderers instead. */
    derivedFromCellRendererProbe: boolean
  }
  render: {
    gridShellRenderCountBefore: number
    gridShellRenderCountAfter: number
  }
  paint: {
    editToPaintMs: number | null
  }
  invariants: {
    singleActionDispatched: boolean
    singleTransactionSingleRow: boolean
    gridShellRenderCountStable: boolean
    noUnaffectedRowRefreshed: boolean
  }
}

export interface AggregateSummary {
  editCount: number
  p50EditToPaintMs: number | null
  p95EditToPaintMs: number | null
  maxEditToPaintMs: number | null
  reducerDurationMs: { p50: number | null; p95: number | null }
  bridgeDurationMs: { p50: number | null; p95: number | null }
  transactionDurationMs: { p50: number | null; p95: number | null }
  gridShellRenderDelta: number
  totalBridgeUpdates: number
  totalTransactions: number
  totalUpdatedRowIds: number
  totalRefreshedCellIds: number
  displayedRowCount: number
  totalRowCount: number
  invariantViolationCount: number
}

export interface RunMetadata {
  timestamp: string
  userAgent: string
  buildMode: string
  agGridVersion: string
  fixtureSize: number
}

export interface InstrumentationExport {
  metadata: RunMetadata
  summary: AggregateSummary
  traces: EditTrace[]
}
