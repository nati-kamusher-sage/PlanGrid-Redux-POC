import type { RootState } from '../../app/store'
import { PERIOD_IDS, type DimensionId, type GridRowHandle, type PeriodId } from './types'

// --- Allocation-free cell reads (grid valueGetters) -------------------------
// Each function reads exactly one value from the normalized collections. None
// allocates a new object/array, so they are safe to call once per rendered
// cell without creating per-render garbage or a new `rowData` projection.

export function readAccountName(state: RootState, planLineId: string): string {
  const planLine = state.planningModel.planLines[planLineId]
  if (!planLine) {
    return ''
  }
  return state.planningModel.accounts[planLine.glAccountKey]?.name ?? ''
}

export function readAccountCode(state: RootState, planLineId: string): string {
  const planLine = state.planningModel.planLines[planLineId]
  return planLine?.glAccountKey ?? ''
}

export function readDimensionLabel(
  state: RootState,
  planLineId: string,
  dimensionId: DimensionId,
): string {
  const planLine = state.planningModel.planLines[planLineId]
  const valueKey = planLine?.dimensions[dimensionId]
  if (!valueKey) {
    return ''
  }
  return state.planningModel.dimensionValues[`${dimensionId}:${valueKey}`]?.name ?? ''
}

export function readResultCell(
  state: RootState,
  planLineId: string,
  periodId: PeriodId,
): number | undefined {
  const resultId = state.planningModel.resultIdByPlanLineId[planLineId]
  if (!resultId) {
    return undefined
  }
  return state.planningModel.results[resultId]?.reportingPeriodsResultMap[periodId]
}

/** Derived from the 12 period values on every read; never stored as a separate source of truth. */
export function readAnnualTotal(state: RootState, planLineId: string): number {
  const resultId = state.planningModel.resultIdByPlanLineId[planLineId]
  const result = resultId ? state.planningModel.results[resultId] : undefined
  if (!result) {
    return 0
  }
  let total = 0
  for (const periodId of PERIOD_IDS) {
    total += result.reportingPeriodsResultMap[periodId]
  }
  return Math.round(total * 100) / 100
}

export function selectRowHandles(state: RootState): GridRowHandle[] {
  return state.planningModel.rowHandles
}

export function selectFixtureSize(state: RootState): number {
  return state.planningModel.fixtureSize
}

export function selectLastGenerationDurationMs(state: RootState): number {
  return state.planningModel.lastGenerationDurationMs
}

// --- Materializing selectors (non-grid UI, tests, exports) ------------------
// These build a plain object/array per call. Fine for a details panel, a
// test assertion, or a JSON export; must not be used per-cell in the grid.

export interface MaterializedPlanLine {
  id: string
  accountCode: string
  accountName: string
  department: string
  location: string
  reportingPeriodsResultMap: Record<PeriodId, number>
  annualTotal: number
}

export function materializePlanLine(
  state: RootState,
  planLineId: string,
): MaterializedPlanLine | undefined {
  const planLine = state.planningModel.planLines[planLineId]
  if (!planLine) {
    return undefined
  }
  const resultId = state.planningModel.resultIdByPlanLineId[planLineId]
  const result = resultId ? state.planningModel.results[resultId] : undefined

  return {
    id: planLine.id,
    accountCode: planLine.glAccountKey,
    accountName: readAccountName(state, planLineId),
    department: readDimensionLabel(state, planLineId, 'department'),
    location: readDimensionLabel(state, planLineId, 'location'),
    reportingPeriodsResultMap: result ? { ...result.reportingPeriodsResultMap } : ({} as Record<PeriodId, number>),
    annualTotal: readAnnualTotal(state, planLineId),
  }
}

export function materializeAllPlanLines(state: RootState): MaterializedPlanLine[] {
  return state.planningModel.rowHandles.map(
    (handle) => materializePlanLine(state, handle.id) as MaterializedPlanLine,
  )
}
