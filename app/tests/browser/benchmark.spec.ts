import { test, expect } from '@playwright/test'
import {
  cell,
  getInstrumentationExport,
  performAndAssertEdit,
  persistBenchmarkResult,
  row,
  scrollGridToRow,
} from './support/benchmarkHelpers.ts'
import type { InstrumentationExport } from '../../src/instrumentation/types.ts'

const MEASURED_EDIT_COUNT = 30
const WARM_UP_EDIT_COUNT = 3
const MONTH_PERIODS = [
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
]

function assertNoInvariantViolations(result: InstrumentationExport, measuredTraceCount: number) {
  const measuredTraces = result.traces.slice(-measuredTraceCount)
  expect(measuredTraces).toHaveLength(measuredTraceCount)

  for (const trace of measuredTraces) {
    expect(trace.invariants.singleActionDispatched).toBe(true)
    expect(trace.invariants.singleTransactionSingleRow).toBe(true)
    expect(trace.invariants.gridShellRenderCountStable).toBe(true)
    expect(trace.invariants.noUnaffectedRowRefreshed).toBe(true)

    expect(trace.reducer.actionCount).toBe(1)
    expect(trace.bridge.projectedRowCount).toBe(1)
    expect(trace.transaction.transactionCount).toBe(1)
    expect(trace.transaction.updateLength).toBe(1)
    expect(trace.transaction.rowIds).toHaveLength(1)
  }

  expect(result.summary.invariantViolationCount).toBe(0)
}

test.describe('1,000-row benchmark matrix', () => {
  test('initial rendering: grid-ready, correct row count, no row updates before any edit', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(row(page, 0)).toBeVisible()

    const state = await page.evaluate(() => window.__store__.getState())
    expect(state.planLines.ids).toHaveLength(1000)

    const result = await getInstrumentationExport(page)
    expect(result.traces).toHaveLength(0)
    expect(result.summary.editCount).toBe(0)
  })

  test('visible-row edits: 30 measured edits after warm-up, no invariant violations', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(row(page, 0)).toBeVisible()

    const rowIndex = 0
    for (let i = 0; i < WARM_UP_EDIT_COUNT; i += 1) {
      await performAndAssertEdit(page, rowIndex, MONTH_PERIODS[i % 12], 10 + i)
    }
    await page.getByTestId('reset-button').click()

    for (let i = 0; i < MEASURED_EDIT_COUNT; i += 1) {
      await performAndAssertEdit(page, rowIndex, MONTH_PERIODS[i % 12], 20 + i)
    }

    const result = await getInstrumentationExport(page)
    persistBenchmarkResult('visible-row', result)

    assertNoInvariantViolations(result, MEASURED_EDIT_COUNT)
  })

  test('scrolled-row edits: 30 measured edits on a row reached after scrolling', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(row(page, 0)).toBeVisible()

    const targetRowIndex = 500
    await scrollGridToRow(page, targetRowIndex)
    await expect(row(page, targetRowIndex)).toBeVisible()

    for (let i = 0; i < WARM_UP_EDIT_COUNT; i += 1) {
      await performAndAssertEdit(page, targetRowIndex, MONTH_PERIODS[i % 12], 10 + i)
    }

    for (let i = 0; i < MEASURED_EDIT_COUNT; i += 1) {
      await performAndAssertEdit(page, targetRowIndex, MONTH_PERIODS[i % 12], 30 + i)
    }

    const result = await getInstrumentationExport(page)
    persistBenchmarkResult('scrolled-row', result)

    const measuredTraces = result.traces.slice(-MEASURED_EDIT_COUNT)
    for (const trace of measuredTraces) {
      expect(trace.rowId).toBe(await row(page, targetRowIndex).getAttribute('row-id'))
    }
    assertNoInvariantViolations(result, MEASURED_EDIT_COUNT)
  })

  test('repeated edits to the same row: correct final value, one targeted update each', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(row(page, 0)).toBeVisible()

    const rowIndex = 3
    const values = [15, 25, 35, 45, 55]
    for (const value of values) {
      await performAndAssertEdit(page, rowIndex, 'M01', value)
    }

    const result = await getInstrumentationExport(page)
    const traces = result.traces.slice(-values.length)
    for (const trace of traces) {
      expect(trace.transaction.updateLength).toBe(1)
    }

    const finalCellText = await cell(page, 'M01', rowIndex).textContent()
    expect(finalCellText).toBe(`${values[values.length - 1]}.00`)
  })

  test('repeated edits to different rows: no accumulating full-grid work', async ({ page }) => {
    await page.goto('/')
    await expect(row(page, 0)).toBeVisible()

    const rowIndexes = [1, 4, 6, 9, 12]
    for (const rowIndex of rowIndexes) {
      await performAndAssertEdit(page, rowIndex, 'M02', 77)
    }

    const result = await getInstrumentationExport(page)
    const traces = result.traces.slice(-rowIndexes.length)
    for (const trace of traces) {
      expect(trace.transaction.updateLength).toBe(1)
      expect(trace.invariants.gridShellRenderCountStable).toBe(true)
    }
    expect(result.summary.gridShellRenderDelta).toBe(0)
  })
})

test.describe('100-row diagnostic fixture', () => {
  test('supports the same edit path and invariants at a smaller scale', async ({ page }) => {
    await page.goto('/')
    await expect(row(page, 0)).toBeVisible()

    await page.getByLabel('Fixture size:').selectOption('100')
    await expect(row(page, 0)).toBeVisible()

    const state = await page.evaluate(() => window.__store__.getState())
    expect(state.planLines.ids).toHaveLength(100)
    expect(state.planLines.fixtureSize).toBe(100)

    await performAndAssertEdit(page, 0, 'M01', 61)

    const result = await getInstrumentationExport(page)
    persistBenchmarkResult('diagnostic-100-row', result)

    const lastTrace = result.traces[result.traces.length - 1]
    expect(lastTrace.invariants.singleTransactionSingleRow).toBe(true)
    expect(lastTrace.invariants.gridShellRenderCountStable).toBe(true)
  })
})
