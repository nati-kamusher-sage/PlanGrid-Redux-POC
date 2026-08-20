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

/**
 * Dispatches the domain edit, then projects the single updated entity back
 * into AG Grid via one targeted row transaction. Synchronous and
 * event-driven (no timers), so a single completed edit always yields
 * exactly one action and one one-row transaction.
 */
export function commitPlanLineCellEdit(params: CellCommittedParams): void {
  const { rowId, periodId, value, dispatch, getState, gridApi } = params

  dispatch(planLineCellChanged({ id: rowId, periodId, value }))

  const entity = getState().planLines.entities[rowId]
  if (!entity) {
    return
  }

  gridApi.applyTransaction({ update: [projectPlanLineForGrid(entity)] })
}
