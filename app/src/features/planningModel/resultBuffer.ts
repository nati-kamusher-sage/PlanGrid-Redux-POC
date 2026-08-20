import { PERIOD_IDS, type PeriodId, type PlanLineResult } from './types'

const PERIOD_COUNT = PERIOD_IDS.length
const PERIOD_INDEX_BY_ID: Record<PeriodId, number> = Object.fromEntries(
  PERIOD_IDS.map((periodId, index) => [periodId, index]),
) as Record<PeriodId, number>

/**
 * The hot result storage from the Phase 2 plan PR 5: one flat
 * Float64Array(rowCount * 12), where `values[row * 12 + periodIndex]` is
 * the canonical amount for that plan line's period. Replaces the PR 2-4
 * `Record<string, PlanLineResult>` storage only -- the public read/write
 * API (readResultCell/readAnnualTotal, planLineResultCellChanged, the
 * changed-row notification contract) is unchanged.
 *
 * The array is intentionally mutable and keeps one stable identity for the
 * store's lifetime: a write updates one slot in place, never copying or
 * replacing `values`. `revision` is the separate, ordinary immutable
 * counter a consumer selects instead -- `values`' reference never changes,
 * so selecting it would never notify anyone of a write.
 */
export function createResultBuffer(
  results: PlanLineResult[],
  rowByPlanLineId: Record<string, number>,
): Float64Array {
  const rowCount = results.length
  const values = new Float64Array(rowCount * PERIOD_COUNT)
  for (const result of results) {
    const row = rowByPlanLineId[result.planLineId]
    for (const periodId of PERIOD_IDS) {
      values[row * PERIOD_COUNT + PERIOD_INDEX_BY_ID[periodId]] = result.reportingPeriodsResultMap[periodId]
    }
  }
  return values
}

function assertInBounds(rowCount: number, row: number): void {
  if (row < 0 || row >= rowCount || !Number.isInteger(row)) {
    throw new RangeError(`resultBuffer: row ${row} is out of bounds for ${rowCount} rows`)
  }
}

export function readCell(values: Float64Array, rowCount: number, row: number, periodId: PeriodId): number {
  assertInBounds(rowCount, row)
  return values[row * PERIOD_COUNT + PERIOD_INDEX_BY_ID[periodId]]
}

export function readAnnualTotal(values: Float64Array, rowCount: number, row: number): number {
  assertInBounds(rowCount, row)
  const base = row * PERIOD_COUNT
  let total = 0
  for (let i = 0; i < PERIOD_COUNT; i += 1) {
    total += values[base + i]
  }
  return Math.round(total * 100) / 100
}

/** Writes one cell in place. Callers are responsible for incrementing their own revision counter. */
export function writeCell(
  values: Float64Array,
  rowCount: number,
  row: number,
  periodId: PeriodId,
  value: number,
): void {
  assertInBounds(rowCount, row)
  values[row * PERIOD_COUNT + PERIOD_INDEX_BY_ID[periodId]] = value
}
