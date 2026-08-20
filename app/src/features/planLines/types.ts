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

export type PlanLineType = 'input' | 'formula'

export interface PlanLine {
  id: string
  accountCode: string
  accountName: string
  department: string
  location: string
  type: PlanLineType
  monthlyValuesByPeriodId: Record<PeriodId, number>
  annualTotal: number
}

export type FixtureSize = 100 | 1000 | 5000
