import { describe, expect, it } from 'vitest'
import reducer, {
  fixtureReset,
  planLineResultCellChanged,
  type PlanningModelState,
} from './planningModelSlice'
import { readAnnualTotal, readResultCell } from './selectors'
import { PERIOD_IDS } from './types'
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

  it('gives each fixture size its own fresh result buffer, sized for its row count', () => {
    const state = stateFor(100)
    expect(state.resultValues).toHaveLength(100 * PERIOD_IDS.length)
    expect(state.resultRevision).toBe(0)
  })
})

describe('planLineResultCellChanged', () => {
  it('changes only the targeted result and leaves account/dimension/plan-line data untouched', () => {
    const before = stateFor(1000)
    const targetHandle = before.rowHandles[10]
    const targetPlanLineId = targetHandle.id
    const otherHandles = before.rowHandles.filter((handle) => handle.id !== targetPlanLineId)

    const accountsBefore = before.accounts
    const dimensionValuesBefore = before.dimensionValues
    const planLinesBefore = before.planLines
    const otherValuesBefore = new Map(
      otherHandles.map((handle) => [
        handle.id,
        PERIOD_IDS.map((periodId) => readResultCell(asRootState(before), handle.id, periodId)),
      ]),
    )

    const after = reducer(
      before,
      planLineResultCellChanged({ planLineId: targetPlanLineId, periodId: 'M03', value: 999 }),
    )

    expect(readResultCell(asRootState(after), targetPlanLineId, 'M03')).toBe(999)

    // Account, dimension, and plan-line collections are untouched by an edit.
    expect(after.accounts).toBe(accountsBefore)
    expect(after.dimensionValues).toBe(dimensionValuesBefore)
    expect(after.planLines).toBe(planLinesBefore)

    // No other plan line's result value changed.
    for (const handle of otherHandles) {
      const valuesAfter = PERIOD_IDS.map((periodId) => readResultCell(asRootState(after), handle.id, periodId))
      expect(valuesAfter).toEqual(otherValuesBefore.get(handle.id))
    }

    // Row handles and the buffer's own identity are untouched by an edit
    // (PR 5: the Float64Array is mutated in place, never replaced).
    expect(after.rowHandles).toBe(before.rowHandles)
    expect(after.resultValues).toBe(before.resultValues)
  })

  it('increments resultRevision on every write, as the immutable value consumers select instead of buffer identity', () => {
    const before = stateFor(100)
    const targetPlanLineId = before.rowHandles[0].id

    const after = reducer(
      before,
      planLineResultCellChanged({ planLineId: targetPlanLineId, periodId: 'M01', value: 1 }),
    )
    expect(after.resultRevision).toBe(before.resultRevision + 1)

    const afterAgain = reducer(
      after,
      planLineResultCellChanged({ planLineId: targetPlanLineId, periodId: 'M02', value: 2 }),
    )
    expect(afterAgain.resultRevision).toBe(after.resultRevision + 1)
  })

  it('derives the annual total from the 12 period values after an edit', () => {
    const before = stateFor(100)
    const targetPlanLineId = before.rowHandles[0].id

    const after = reducer(
      before,
      planLineResultCellChanged({ planLineId: targetPlanLineId, periodId: 'M01', value: 500 }),
    )

    const expectedTotal = PERIOD_IDS.reduce(
      (sum, periodId) => sum + (readResultCell(asRootState(after), targetPlanLineId, periodId) ?? 0),
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
    expect(after.resultRevision).toBe(before.resultRevision)
  })
})
