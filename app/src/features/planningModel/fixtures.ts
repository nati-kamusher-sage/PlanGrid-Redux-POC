import {
  PERIOD_IDS,
  type Account,
  type DimensionId,
  type DimensionValue,
  type FixtureSize,
  type GridRowHandle,
  type PlanLine,
  type PlanLineResult,
  type ReportingPeriodsResultMap,
} from './types'

const DEFAULT_SEED = 0x50_4c_47_32 // "PLG2"

const DEPARTMENTS = ['Sales', 'Marketing', 'Engineering', 'Operations', 'Finance', 'HR'] as const
const LOCATIONS = ['US-East', 'US-West', 'EMEA', 'APAC'] as const
const ACCOUNT_NAMES = [
  'Salaries',
  'Travel',
  'Software Licenses',
  'Office Supplies',
  'Consulting',
  'Advertising',
  'Equipment',
  'Utilities',
] as const

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d_2b_79_f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]
}

function buildAccounts(): Account[] {
  return ACCOUNT_NAMES.map((name, index) => ({
    id: `acct-${String(index + 1).padStart(3, '0')}`,
    key: `${4000 + index}`,
    name,
  }))
}

function buildDimensionValues(): DimensionValue[] {
  const departments = DEPARTMENTS.map((name, index) => ({
    id: `dept-${String(index + 1).padStart(2, '0')}`,
    key: name,
    name,
    dimensionId: 'department' as DimensionId,
  }))
  const locations = LOCATIONS.map((name, index) => ({
    id: `loc-${String(index + 1).padStart(2, '0')}`,
    key: name,
    name,
    dimensionId: 'location' as DimensionId,
  }))
  return [...departments, ...locations]
}

function buildReportingPeriodsResultMap(random: () => number): ReportingPeriodsResultMap {
  const values = {} as ReportingPeriodsResultMap
  for (const periodId of PERIOD_IDS) {
    values[periodId] = Math.round(random() * 10_000) / 100
  }
  return values
}

export interface PlanningModelFixture {
  accounts: Account[]
  dimensionValues: DimensionValue[]
  planLines: PlanLine[]
  results: PlanLineResult[]
  rowHandles: GridRowHandle[]
  /** planLineId -> row, and resultId -> row (resultId === planLineId-derived, kept explicit for the stable lookup contract) */
  rowByPlanLineId: Record<string, number>
  resultIdByPlanLineId: Record<string, string>
}

/**
 * Generates the normalized lookup collections first (accounts, dimension
 * values), then the plan lines and results that reference them by key/ID.
 * Plan lines never copy account names or dimension labels; grid row handles
 * are the only thing indexed by row.
 */
export function createPlanningModelFixture(
  size: FixtureSize,
  seed: number = DEFAULT_SEED,
): PlanningModelFixture {
  const random = mulberry32(seed)
  const accounts = buildAccounts()
  const dimensionValues = buildDimensionValues()
  const departmentValues = dimensionValues.filter((value) => value.dimensionId === 'department')
  const locationValues = dimensionValues.filter((value) => value.dimensionId === 'location')

  const planLines: PlanLine[] = []
  const results: PlanLineResult[] = []
  const rowHandles: GridRowHandle[] = []
  const rowByPlanLineId: Record<string, number> = {}
  const resultIdByPlanLineId: Record<string, string> = {}

  for (let row = 0; row < size; row += 1) {
    const id = `pl-${String(row + 1).padStart(6, '0')}`
    const account = pick(accounts, random)
    const department = pick(departmentValues, random)
    const location = pick(locationValues, random)

    planLines.push({
      id,
      glAccountKey: account.key,
      dimensions: {
        department: department.key,
        location: location.key,
      },
    })

    const resultId = `plr-${String(row + 1).padStart(6, '0')}`
    results.push({
      id: resultId,
      planLineId: id,
      reportingPeriodsResultMap: buildReportingPeriodsResultMap(random),
    })

    rowHandles.push({ id, row })
    rowByPlanLineId[id] = row
    resultIdByPlanLineId[id] = resultId
  }

  return { accounts, dimensionValues, planLines, results, rowHandles, rowByPlanLineId, resultIdByPlanLineId }
}

export interface PlanningModelFixtureWithTiming extends PlanningModelFixture {
  generationDurationMs: number
}

/** Same generation, wrapped with a duration measurement for benchmark/reset evidence. */
export function createPlanningModelFixtureWithTiming(
  size: FixtureSize,
  seed?: number,
): PlanningModelFixtureWithTiming {
  const start = performance.now()
  const fixture = createPlanningModelFixture(size, seed)
  const generationDurationMs = performance.now() - start
  return { ...fixture, generationDurationMs }
}
