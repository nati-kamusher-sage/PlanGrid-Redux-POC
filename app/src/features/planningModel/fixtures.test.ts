import { describe, expect, it } from 'vitest'
import { createPlanningModelFixture, createPlanningModelFixtureWithTiming } from './fixtures'
import { PERIOD_IDS, type FixtureSize } from './types'

const SIZES: FixtureSize[] = [100, 1000, 50_000]

describe('createPlanningModelFixture', () => {
  it.each(SIZES)('is deterministic at %i rows: identical seed reproduces identical fixture', (size) => {
    const a = createPlanningModelFixture(size)
    const b = createPlanningModelFixture(size)
    expect(a).toEqual(b)
  })

  it.each(SIZES)('produces %i plan lines, results, and row handles with stable IDs', (size) => {
    const fixture = createPlanningModelFixture(size)
    expect(fixture.planLines).toHaveLength(size)
    expect(fixture.results).toHaveLength(size)
    expect(fixture.rowHandles).toHaveLength(size)
    expect(new Set(fixture.planLines.map((line) => line.id)).size).toBe(size)
    expect(new Set(fixture.results.map((result) => result.id)).size).toBe(size)
  })

  it.each(SIZES)('every plan line at %i rows resolves one account, its dimensions, and one result', (size) => {
    const fixture = createPlanningModelFixture(size)
    const accountKeys = new Set(fixture.accounts.map((account) => account.key))
    const dimensionValueKeys = new Set(
      fixture.dimensionValues.map((value) => `${value.dimensionId}:${value.key}`),
    )
    const resultByPlanLineId = new Map(fixture.results.map((result) => [result.planLineId, result]))

    for (const line of fixture.planLines) {
      expect(accountKeys.has(line.glAccountKey)).toBe(true)
      expect(dimensionValueKeys.has(`department:${line.dimensions.department}`)).toBe(true)
      expect(dimensionValueKeys.has(`location:${line.dimensions.location}`)).toBe(true)

      const result = resultByPlanLineId.get(line.id)
      expect(result).toBeDefined()
      expect(Object.keys(result!.reportingPeriodsResultMap)).toHaveLength(PERIOD_IDS.length)
    }
  })

  it('builds a stable bidirectional row/planLineId/resultId lookup', () => {
    const fixture = createPlanningModelFixture(1000)
    for (const handle of fixture.rowHandles) {
      expect(fixture.rowByPlanLineId[handle.id]).toBe(handle.row)
      const resultId = fixture.resultIdByPlanLineId[handle.id]
      expect(fixture.results[handle.row].id).toBe(resultId)
      expect(fixture.results[handle.row].planLineId).toBe(handle.id)
    }
  })

  it('does not copy account name or dimension labels onto plan lines', () => {
    const fixture = createPlanningModelFixture(100)
    for (const line of fixture.planLines) {
      expect(line).not.toHaveProperty('accountName')
      expect(line).not.toHaveProperty('department')
      expect(line).not.toHaveProperty('location')
      expect(line).not.toHaveProperty('reportingPeriodsResultMap')
    }
  })
})

describe('createPlanningModelFixtureWithTiming', () => {
  it('reports a non-negative generation duration', () => {
    const fixture = createPlanningModelFixtureWithTiming(1000)
    expect(fixture.generationDurationMs).toBeGreaterThanOrEqual(0)
    expect(fixture.planLines).toHaveLength(1000)
  })
})
