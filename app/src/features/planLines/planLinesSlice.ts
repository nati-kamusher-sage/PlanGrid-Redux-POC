import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { createPlanLineFixture } from './fixtures'
import type { FixtureSize, PeriodId, PlanLine } from './types'

const DEFAULT_FIXTURE_SIZE: FixtureSize = 1000

export interface PlanLinesState {
  ids: string[]
  entities: Record<string, PlanLine>
  fixtureSize: FixtureSize
}

function buildState(fixtureSize: FixtureSize): PlanLinesState {
  const lines = createPlanLineFixture(fixtureSize)
  const ids: string[] = []
  const entities: Record<string, PlanLine> = {}
  for (const line of lines) {
    ids.push(line.id)
    entities[line.id] = line
  }
  return { ids, entities, fixtureSize }
}

const initialState: PlanLinesState = buildState(DEFAULT_FIXTURE_SIZE)

export interface PlanLineCellChangedPayload {
  id: string
  periodId: PeriodId
  value: number
}

const planLinesSlice = createSlice({
  name: 'planLines',
  initialState,
  reducers: {
    planLineCellChanged(state, action: PayloadAction<PlanLineCellChangedPayload>) {
      const { id, periodId, value } = action.payload
      const entity = state.entities[id]
      if (!entity) {
        return
      }

      const previousValue = entity.monthlyValuesByPeriodId[periodId]
      entity.monthlyValuesByPeriodId[periodId] = value
      entity.annualTotal = Math.round((entity.annualTotal - previousValue + value) * 100) / 100
    },
    fixtureReset(state, action: PayloadAction<{ size: FixtureSize }>) {
      const next = buildState(action.payload.size)
      state.ids = next.ids
      state.entities = next.entities
      state.fixtureSize = next.fixtureSize
    },
  },
})

export const { planLineCellChanged, fixtureReset } = planLinesSlice.actions
export default planLinesSlice.reducer
