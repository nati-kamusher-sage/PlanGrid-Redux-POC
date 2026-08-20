import { describe, expect, it } from 'vitest'
import { createResultBuffer, readAnnualTotal, readCell, writeCell } from './resultBuffer'
import { PERIOD_IDS, type PlanLineResult, type ReportingPeriodsResultMap } from './types'

function makeResults(count: number): { results: PlanLineResult[]; rowByPlanLineId: Record<string, number> } {
  const results: PlanLineResult[] = []
  const rowByPlanLineId: Record<string, number> = {}
  for (let row = 0; row < count; row += 1) {
    const planLineId = `pl-${row}`
    const reportingPeriodsResultMap = {} as ReportingPeriodsResultMap
    PERIOD_IDS.forEach((periodId, index) => {
      reportingPeriodsResultMap[periodId] = row * 100 + index
    })
    results.push({ id: `plr-${row}`, planLineId, reportingPeriodsResultMap })
    rowByPlanLineId[planLineId] = row
  }
  return { results, rowByPlanLineId }
}

describe('createResultBuffer', () => {
  it('sizes the buffer to rowCount * 12 and places each period at its own row-major slot', () => {
    const { results, rowByPlanLineId } = makeResults(5)
    const values = createResultBuffer(results, rowByPlanLineId)

    expect(values).toHaveLength(5 * PERIOD_IDS.length)
    for (let row = 0; row < 5; row += 1) {
      PERIOD_IDS.forEach((_periodId, periodIndex) => {
        expect(values[row * PERIOD_IDS.length + periodIndex]).toBe(row * 100 + periodIndex)
      })
    }
  })
})

describe('readCell / readAnnualTotal', () => {
  it('reads back exactly the value written for each row and period', () => {
    const { results, rowByPlanLineId } = makeResults(10)
    const values = createResultBuffer(results, rowByPlanLineId)

    for (const [planLineId, row] of Object.entries(rowByPlanLineId)) {
      const result = results.find((r) => r.planLineId === planLineId)!
      for (const periodId of PERIOD_IDS) {
        expect(readCell(values, 10, row, periodId)).toBe(result.reportingPeriodsResultMap[periodId])
      }
    }
  })

  it('computes the annual total as the sum of that row only, rounded to cents', () => {
    const { results, rowByPlanLineId } = makeResults(3)
    const values = createResultBuffer(results, rowByPlanLineId)

    for (const [planLineId, row] of Object.entries(rowByPlanLineId)) {
      const result = results.find((r) => r.planLineId === planLineId)!
      const expected =
        Math.round(
          Object.values(result.reportingPeriodsResultMap).reduce((sum, v) => sum + v, 0) * 100,
        ) / 100
      expect(readAnnualTotal(values, 3, row)).toBeCloseTo(expected, 2)
    }
  })

  it('throws for a negative, non-integer, or out-of-range row (bounds protection)', () => {
    const { results, rowByPlanLineId } = makeResults(5)
    const values = createResultBuffer(results, rowByPlanLineId)

    expect(() => readCell(values, 5, -1, 'M01')).toThrow(RangeError)
    expect(() => readCell(values, 5, 5, 'M01')).toThrow(RangeError)
    expect(() => readCell(values, 5, 1.5, 'M01')).toThrow(RangeError)
    expect(() => readAnnualTotal(values, 5, 5)).toThrow(RangeError)
    expect(() => writeCell(values, 5, 5, 'M01', 1)).toThrow(RangeError)
  })
})

describe('writeCell', () => {
  it('writes exactly the targeted row/period slot, leaving every other slot untouched', () => {
    const { results, rowByPlanLineId } = makeResults(4)
    const values = createResultBuffer(results, rowByPlanLineId)
    const before = Array.from(values)

    writeCell(values, 4, 2, 'M05', 12345)

    expect(readCell(values, 4, 2, 'M05')).toBe(12345)
    for (let i = 0; i < values.length; i += 1) {
      const row = Math.floor(i / PERIOD_IDS.length)
      const periodIndex = i % PERIOD_IDS.length
      if (row === 2 && periodIndex === PERIOD_IDS.indexOf('M05')) {
        continue
      }
      expect(values[i]).toBe(before[i])
    }
  })

  it('mutates the same array in place; it never returns or requires a replacement reference', () => {
    const { results, rowByPlanLineId } = makeResults(2)
    const values = createResultBuffer(results, rowByPlanLineId)
    const identityBefore = values

    writeCell(values, 2, 0, 'M01', 999)

    expect(values).toBe(identityBefore)
    expect(readCell(values, 2, 0, 'M01')).toBe(999)
  })

  it('maps every period ID to a distinct, correctly ordered index (period-mapping protection)', () => {
    const { results, rowByPlanLineId } = makeResults(1)
    const values = createResultBuffer(results, rowByPlanLineId)

    PERIOD_IDS.forEach((periodId, index) => {
      writeCell(values, 1, 0, periodId, index + 1)
    })

    PERIOD_IDS.forEach((periodId, index) => {
      expect(readCell(values, 1, 0, periodId)).toBe(index + 1)
      expect(values[index]).toBe(index + 1)
    })
  })
})
