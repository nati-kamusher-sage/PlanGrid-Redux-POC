import { PERIOD_IDS, type FixtureSize, type PlanLine, type PlanLineType } from './types'

const DEFAULT_SEED = 0x50_4c_47_31 // "PLG1"

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

function buildMonthlyValues(random: () => number): PlanLine['monthlyValuesByPeriodId'] {
  const values = {} as PlanLine['monthlyValuesByPeriodId']
  for (const periodId of PERIOD_IDS) {
    values[periodId] = Math.round(random() * 10_000) / 100
  }
  return values
}

function sumMonthlyValues(values: PlanLine['monthlyValuesByPeriodId']): number {
  let total = 0
  for (const periodId of PERIOD_IDS) {
    total += values[periodId]
  }
  return Math.round(total * 100) / 100
}

export function createPlanLineFixture(size: FixtureSize, seed: number = DEFAULT_SEED): PlanLine[] {
  const random = mulberry32(seed)
  const lines: PlanLine[] = []

  for (let index = 0; index < size; index += 1) {
    const monthlyValuesByPeriodId = buildMonthlyValues(random)
    const type: PlanLineType = random() < 0.1 ? 'formula' : 'input'
    lines.push({
      id: `pl-${String(index + 1).padStart(6, '0')}`,
      accountCode: `${4000 + (index % 900)}`,
      accountName: pick(ACCOUNT_NAMES, random),
      department: pick(DEPARTMENTS, random),
      location: pick(LOCATIONS, random),
      type,
      monthlyValuesByPeriodId,
      annualTotal: sumMonthlyValues(monthlyValuesByPeriodId),
    })
  }

  return lines
}
