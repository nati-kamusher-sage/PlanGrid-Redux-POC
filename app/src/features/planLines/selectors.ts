import type { RootState } from '../../app/store'
import type { PlanLine } from './types'

export function selectPlanLineIds(state: RootState): string[] {
  return state.planLines.ids
}

export function selectPlanLineById(state: RootState, id: string): PlanLine | undefined {
  return state.planLines.entities[id]
}

export function selectFixtureSize(state: RootState): number {
  return state.planLines.fixtureSize
}
