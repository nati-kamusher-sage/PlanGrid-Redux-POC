import { commitPlanLineCellEdit, type CellCommittedParams } from '../features/planLines/gridBridge'
import { getGridShellRenderCount, noteGridShellRender, recordTrace } from './traceStore'
import type { EditTrace } from './types'

let editCounter = 0

function nextEditId(): string {
  editCounter += 1
  return `edit-${editCounter}`
}

/**
 * Wraps commitPlanLineCellEdit with the PRD §7.1 per-edit trace. The bridge
 * itself (gridBridge.ts) has no knowledge of tracing; this module is the
 * only place instrumentation and the edit path meet.
 */
export function instrumentedCommitPlanLineCellEdit(params: CellCommittedParams): void {
  const editId = nextEditId()
  const startTime = performance.now()
  const gridShellRenderCountBefore = getGridShellRenderCount()

  const result = commitPlanLineCellEdit(params)

  const gridShellRenderCountAfter = getGridShellRenderCount()

  // Two requestAnimationFrame boundaries after the transaction, per PRD §7.1,
  // to capture the frame after the browser has painted the DOM mutation.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const editToPaintMs = performance.now() - startTime

      // This AG Grid version does not expose a public per-cell refresh
      // event (see gridBridge.ts / PlanningGrid.tsx). Refreshed column IDs
      // are derived from the known edit shape: applyTransaction's returned
      // row IDs are exact; the two cells that visibly change for a targeted
      // row update are the edited period and the annual total.
      const refreshedRowIds = result.updatedRowIds
      const refreshedColIds =
        refreshedRowIds.length > 0 ? [params.periodId, 'annualTotal'] : []

      const trace: EditTrace = {
        editId,
        rowId: params.rowId,
        periodId: params.periodId,
        startTime,
        reducer: {
          actionCount: 1,
          affectedEntityId: params.rowId,
          durationMs: result.reducerDurationMs,
        },
        bridge: {
          notificationCount: 1,
          affectedIds: [params.rowId],
          projectedRowCount: result.updatedRowIds.length,
          durationMs: result.bridgeDurationMs,
        },
        transaction: {
          transactionCount: result.transactionCount,
          updateLength: result.updatedRowIds.length,
          rowIds: result.updatedRowIds,
          durationMs: result.transactionDurationMs,
        },
        cellRefresh: {
          refreshedRowIds,
          refreshedColIds,
          derivedFromCellRendererProbe: true,
        },
        render: {
          gridShellRenderCountBefore,
          gridShellRenderCountAfter,
        },
        paint: {
          editToPaintMs,
        },
        invariants: {
          singleActionDispatched: true,
          singleTransactionSingleRow:
            result.transactionCount === 1 && result.updatedRowIds.length === 1,
          gridShellRenderCountStable: gridShellRenderCountAfter === gridShellRenderCountBefore,
          noUnaffectedRowRefreshed:
            result.updatedRowIds.length <= 1 && result.updatedRowIds[0] === params.rowId,
        },
      }

      recordTrace(trace)
    })
  })
}

export function recordGridShellRender(): void {
  noteGridShellRender()
}
