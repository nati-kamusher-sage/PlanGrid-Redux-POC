import { describe, expect, it } from 'vitest'
import reducer, {
  fixtureReset,
  planLineResultCellChanged,
  type PlanningModelState,
} from './planningModelSlice'
import { readAnnualTotal, readResultCell } from './selectors'
import type { RootState } from '../../app/store'
import type { FixtureSize } from './types'

function stateFor(size: FixtureSize): PlanningModelState {
  return reducer(undefined, fixtureReset({ size }))
}

function asRootState(planningModel: PlanningModelState): RootState {
  return { planningModel } as unknown as RootState
}

describe('fixtureReset', () => {
  it('replaces the full normalized state deterministically and reports a duration', () => {
    const state = stateFor(100)
    expect(state.fixtureSize).toBe(100)
    expect(state.rowHandles).toHaveLength(100)
    expect(state.lastGenerationDurationMs).toBeGreaterThanOrEqual(0)
  })

  it.each([100, 1000, 50_000] as FixtureSize[])('supports the %i-row fixture size', (size) => {
    expect(stateFor(size).rowHandles).toHaveLength(size)
  })
})

describe('planLineResultCellChanged', () => {
  it('changes only the targeted result and leaves account/dimension/other-result data untouched', () => {
    const before = stateFor(1000)
    const targetHandle = before.rowHandles[10]
    const targetPlanLineId = targetHandle.id
    const otherHandles = before.rowHandles.filter((handle) => handle.id !== targetPlanLineId)

    const accountsBefore = before.accounts
    const dimensionValuesBefore = before.dimensionValues
    const planLinesBefore = before.planLines
    const otherResultsBefore = new Map(
      otherHandles.map((handle) => {
        const resultId = before.resultIdByPlanLineId[handle.id]
        return [handle.id, before.results[resultId]]
      }),
    )

    const after = reducer(
      before,
      planLineResultCellChanged({ planLineId: targetPlanLineId, periodId: 'M03', value: 999 }),
    )

    expect(readResultCell(asRootState(after), targetPlanLineId, 'M03')).toBe(999)

    // Account and dimension collections are untouched by an edit.
    expect(after.accounts).toBe(accountsBefore)
    expect(after.dimensionValues).toBe(dimensionValuesBefore)
    expect(after.planLines).toBe(planLinesBefore)

    // No other plan line's result changed.
    for (const handle of otherHandles) {
      const resultId = after.resultIdByPlanLineId[handle.id]
      expect(after.results[resultId]).toBe(otherResultsBefore.get(handle.id))
    }

    // Row handles are untouched by an edit (stable across ordinary edits).
    expect(after.rowHandles).toBe(before.rowHandles)
  })

  it('derives the annual total from the 12 period values after an edit', () => {
    const before = stateFor(100)
    const targetPlanLineId = before.rowHandles[0].id

    const after = reducer(
      before,
      planLineResultCellChanged({ planLineId: targetPlanLineId, periodId: 'M01', value: 500 }),
    )

    const resultId = after.resultIdByPlanLineId[targetPlanLineId]
    const expectedTotal = Object.values(after.results[resultId].reportingPeriodsResultMap).reduce(
      (sum, value) => sum + value,
      0,
    )
    expect(readAnnualTotal(asRootState(after), targetPlanLineId)).toBeCloseTo(expectedTotal, 2)
  })

  it('is a no-op when the plan-line ID does not exist', () => {
    const before = stateFor(100)
    const after = reducer(
      before,
      planLineResultCellChanged({ planLineId: 'does-not-exist', periodId: 'M01', value: 1 }),
    )
    expect(after).toEqual(before)
  })
})
