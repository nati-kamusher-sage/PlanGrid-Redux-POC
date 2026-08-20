import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { createPlanningModelFixtureWithTiming } from './fixtures'
import { createResultBuffer, writeCell } from './resultBuffer'
import type { Account, DimensionValue, FixtureSize, GridRowHandle, PeriodId, PlanLine } from './types'

const DEFAULT_FIXTURE_SIZE: FixtureSize = 1000

export interface PlanningModelState {
  fixtureSize: FixtureSize
  accounts: Record<string, Account>
  accountIds: string[]
  dimensionValues: Record<string, DimensionValue>
  dimensionValueIds: string[]
  planLines: Record<string, PlanLine>
  /**
   * Hot result storage (Phase 2 plan PR 5): Float64Array(rowCount * 12),
   * see resultBuffer.ts. Mutated in place by writeCell; its reference never
   * changes for a given fixture. `resultRevision` is the ordinary immutable
   * counter to select instead, incremented on every write.
   */
  resultValues: Float64Array
  resultRevision: number
  rowHandles: GridRowHandle[]
  rowByPlanLineId: Record<string, number>
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

  return {
    fixtureSize,
    accounts,
    accountIds,
    dimensionValues,
    dimensionValueIds,
    planLines,
    resultValues: createResultBuffer(fixture.results, fixture.rowByPlanLineId),
    resultRevision: 0,
    rowHandles: fixture.rowHandles,
    rowByPlanLineId: fixture.rowByPlanLineId,
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
      const row = state.rowByPlanLineId[planLineId]
      if (row === undefined) {
        return
      }
      // state.resultValues is the mutable Float64Array from resultBuffer.ts,
      // written in place -- Immer never drafts it (see store.ts's
      // immutableCheck/serializableCheck ignoredPaths). Only resultRevision
      // is an ordinary immutable value a selector can observe changing.
      writeCell(state.resultValues, state.rowHandles.length, row, periodId, value)
      state.resultRevision += 1
    },
    fixtureReset(_state, action: PayloadAction<{ size: FixtureSize }>) {
      return buildState(action.payload.size)
    },
  },
})

export const { planLineResultCellChanged, fixtureReset } = planningModelSlice.actions
export default planningModelSlice.reducer
