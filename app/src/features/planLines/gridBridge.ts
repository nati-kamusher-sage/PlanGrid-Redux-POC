import type { GridApi } from 'ag-grid-community'
import type { AppDispatch, RootState } from '../../app/store'
import { planLineCellChanged } from './planLinesSlice'
import { projectPlanLineForGrid } from './projectRow'
import { PERIOD_IDS, type PeriodId, type PlanLine } from './types'

/**
 * The explicit Redux-to-AG-Grid synchronization boundary (PRD §6.2):
 * AG Grid cell edit -> Redux domain action -> changed entity notification
 * -> row projection -> api.applyTransaction({ update: [row] }).
 *
 * AG Grid's own row object is never treated as canonical; only the plan-line
 * ID and period ID it reports are used to know which Redux entity changed.
 */
export function parseMonthlyValueField(field: string | undefined): PeriodId | undefined {
  if (!field) {
    return undefined
  }
  const [prefix, periodId] = field.split('.')
  if (prefix !== 'monthlyValuesByPeriodId') {
    return undefined
  }
  return (PERIOD_IDS as readonly string[]).includes(periodId) ? (periodId as PeriodId) : undefined
}

export interface CellCommittedParams {
  rowId: string
  periodId: PeriodId
  value: number
  dispatch: AppDispatch
  getState: () => RootState
  gridApi: GridApi<PlanLine>
}

export interface CellCommitResult {
  reducerDurationMs: number
  bridgeDurationMs: number
  transactionDurationMs: number
  transactionCount: number
  updatedRowIds: string[]
}

const EMPTY_RESULT: CellCommitResult = {
  reducerDurationMs: 0,
  bridgeDurationMs: 0,
  transactionDurationMs: 0,
  transactionCount: 0,
  updatedRowIds: [],
}

/**
 * Dispatches the domain edit, then projects the single updated entity back
 * into AG Grid via one targeted row transaction. Synchronous and
 * event-driven (no timers), so a single completed edit always yields
 * exactly one action and one one-row transaction.
 *
 * Returns timing/count facts about what actually happened, for the
 * instrumentation layer (kept separate: this module has no knowledge of
 * trace recording).
 */
export function commitPlanLineCellEdit(params: CellCommittedParams): CellCommitResult {
  const { rowId, periodId, value, dispatch, getState, gridApi } = params
  const bridgeStart = performance.now()

  const reducerStart = performance.now()
  dispatch(planLineCellChanged({ id: rowId, periodId, value }))
  const reducerDurationMs = performance.now() - reducerStart

  const entity = getState().planLines.entities[rowId]
  if (!entity) {
    return { ...EMPTY_RESULT, reducerDurationMs }
  }

  const transactionStart = performance.now()
  const result = gridApi.applyTransaction({ update: [projectPlanLineForGrid(entity)] })
  const transactionDurationMs = performance.now() - transactionStart

  const bridgeDurationMs = performance.now() - bridgeStart
  const updatedRowIds = (result?.update ?? []).map((node) => node.data?.id).filter(
    (id): id is string => typeof id === 'string',
  )

  return {
    reducerDurationMs,
    bridgeDurationMs,
    transactionDurationMs,
    transactionCount: 1,
    updatedRowIds,
  }
}
