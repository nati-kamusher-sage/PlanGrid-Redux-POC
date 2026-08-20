import { describe, expect, it } from 'vitest'
import { createPlanLineFixture } from './fixtures'
import reducer, { fixtureReset, planLineCellChanged, type PlanLinesState } from './planLinesSlice'

function stateFor(size: 100 | 1000 | 5000): PlanLinesState {
  return reducer(undefined, fixtureReset({ size }))
}

describe('fixture generation', () => {
  it('produces exactly 1000 stable IDs and 12 editable periods by default', () => {
    const state = stateFor(1000)
    expect(state.ids).toHaveLength(1000)
    expect(new Set(state.ids).size).toBe(1000)
    for (const id of state.ids) {
      expect(Object.keys(state.entities[id].monthlyValuesByPeriodId)).toHaveLength(12)
    }
  })

  it('is deterministic: recreating a fixture produces the same records and values', () => {
    const a = createPlanLineFixture(1000)
    const b = createPlanLineFixture(1000)
    expect(a).toEqual(b)
  })

  it('supports 100 and 5000-row diagnostic fixtures', () => {
    expect(stateFor(100).ids).toHaveLength(100)
    expect(stateFor(5000).ids).toHaveLength(5000)
  })
})

describe('planLineCellChanged', () => {
  it('changes only the targeted entity and derives the correct annual total', () => {
    const before = stateFor(1000)
    const targetId = before.ids[10]
    const otherIds = before.ids.filter((id) => id !== targetId)
    const otherEntitiesBefore = otherIds.map((id) => before.entities[id])

    const after = reducer(
      before,
      planLineCellChanged({ id: targetId, periodId: 'M03', value: 999 }),
    )

    expect(after.entities[targetId].monthlyValuesByPeriodId.M03).toBe(999)

    const expectedTotal = Object.values(after.entities[targetId].monthlyValuesByPeriodId).reduce(
      (sum, value) => sum + value,
      0,
    )
    expect(after.entities[targetId].annualTotal).toBeCloseTo(expectedTotal, 2)

    for (const id of otherIds) {
      expect(after.entities[id]).toBe(before.entities[id])
    }
    expect(otherIds.map((id) => after.entities[id])).toEqual(otherEntitiesBefore)

    expect(after.ids).toBe(before.ids)
  })

  it('is a no-op when the plan-line ID does not exist', () => {
    const before = stateFor(100)
    const after = reducer(
      before,
      planLineCellChanged({ id: 'does-not-exist', periodId: 'M01', value: 1 }),
    )
    expect(after).toEqual(before)
  })
})

describe('fixtureReset', () => {
  it('replaces ids, entities, and fixtureSize deterministically', () => {
    const state = stateFor(100)
    expect(state.fixtureSize).toBe(100)
    expect(state.ids).toHaveLength(100)
  })
})
