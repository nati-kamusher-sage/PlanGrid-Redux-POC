export const PERIOD_IDS = [
  'M01',
  'M02',
  'M03',
  'M04',
  'M05',
  'M06',
  'M07',
  'M08',
  'M09',
  'M10',
  'M11',
  'M12',
] as const

export type PeriodId = (typeof PERIOD_IDS)[number]

export type ReportingPeriodsResultMap = Record<PeriodId, number>

export const DIMENSION_IDS = ['department', 'location'] as const

export type DimensionId = (typeof DIMENSION_IDS)[number]

/** Canonical account record. Referenced by a plan line via `glAccountKey`; never copied onto a plan line. */
export interface Account {
  id: string
  key: string
  name: string
}

/** Canonical dimension value (e.g. one department or one location). Referenced by a plan line via `dimensions[dimensionId]`. */
export interface DimensionValue {
  id: string
  key: string
  name: string
  dimensionId: DimensionId
}

/**
 * A plan line's identity and dimensions, following XPNA's `GlPlanLine`
 * (`glAccountKey` + `BasePlanLine.dimensions`). Holds references only:
 * no account name, dimension label, or period amount.
 */
export interface PlanLine {
  id: string
  glAccountKey: string
  dimensions: Record<DimensionId, string>
}

/**
 * A plan line's editable result, following XPNA's `PlanLineResult`
 * (`planLineId` + `reportingPeriodsResultMap`). A separate collection from
 * `PlanLine`, keyed by its own `id` and looked up by `planLineId`.
 */
export interface PlanLineResult {
  id: string
  planLineId: string
  reportingPeriodsResultMap: ReportingPeriodsResultMap
}

/**
 * A stable grid row handle: identity plus the row index used for O(1)
 * result lookup. The row index is an implementation detail; `id`
 * (the plan-line ID) remains the domain identity used by `getRowId`.
 */
export interface GridRowHandle {
  id: string
  row: number
}

export type FixtureSize = 100 | 1000 | 50_000
