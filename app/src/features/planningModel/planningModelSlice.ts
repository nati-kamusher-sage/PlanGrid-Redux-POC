import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { createPlanningModelFixtureWithTiming } from './fixtures'
import type {
  Account,
  DimensionValue,
  FixtureSize,
  GridRowHandle,
  PeriodId,
  PlanLine,
  PlanLineResult,
} from './types'

const DEFAULT_FIXTURE_SIZE: FixtureSize = 1000

export interface PlanningModelState {
  fixtureSize: FixtureSize
  accounts: Record<string, Account>
  accountIds: string[]
  dimensionValues: Record<string, DimensionValue>
  dimensionValueIds: string[]
  planLines: Record<string, PlanLine>
  results: Record<string, PlanLineResult>
  rowHandles: GridRowHandle[]
  rowByPlanLineId: Record<string, number>
  resultIdByPlanLineId: Record<string, string>
  lastGenerationDurationMs: number
}

function buildState(fixtureSize: FixtureSize): PlanningModelState {
  const fixture = createPlanningModelFixtureWithTiming(fixtureSize)

  const accounts: Record<string, Account> = {}
  const accountIds: string[] = []
  for (const account of fixture.accounts) {
    accounts[account.key] = account
    accountIds.push(account.key)
  }

  const dimensionValues: Record<string, DimensionValue> = {}
  const dimensionValueIds: string[] = []
  for (const value of fixture.dimensionValues) {
    const key = `${value.dimensionId}:${value.key}`
    dimensionValues[key] = value
    dimensionValueIds.push(key)
  }

  const planLines: Record<string, PlanLine> = {}
  for (const line of fixture.planLines) {
    planLines[line.id] = line
  }

  const results: Record<string, PlanLineResult> = {}
  for (const result of fixture.results) {
    results[result.id] = result
  }

  return {
    fixtureSize,
    accounts,
    accountIds,
    dimensionValues,
    dimensionValueIds,
    planLines,
    results,
    rowHandles: fixture.rowHandles,
    rowByPlanLineId: fixture.rowByPlanLineId,
    resultIdByPlanLineId: fixture.resultIdByPlanLineId,
    lastGenerationDurationMs: fixture.generationDurationMs,
  }
}

const initialState: PlanningModelState = buildState(DEFAULT_FIXTURE_SIZE)

export interface PlanLineResultCellChangedPayload {
  planLineId: string
  periodId: PeriodId
  value: number
}

const planningModelSlice = createSlice({
  name: 'planningModel',
  initialState,
  reducers: {
    planLineResultCellChanged(state, action: PayloadAction<PlanLineResultCellChangedPayload>) {
      const { planLineId, periodId, value } = action.payload
      const resultId = state.resultIdByPlanLineId[planLineId]
      const result = resultId ? state.results[resultId] : undefined
      if (!result) {
        return
      }
      result.reportingPeriodsResultMap[periodId] = value
    },
    fixtureReset(_state, action: PayloadAction<{ size: FixtureSize }>) {
      return buildState(action.payload.size)
    },
  },
})

export const { planLineResultCellChanged, fixtureReset } = planningModelSlice.actions
export default planningModelSlice.reducer
