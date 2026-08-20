import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page } from '@playwright/test'

export function row(page: Page, rowIndex: number) {
  return page.locator(`.ag-row[row-index="${rowIndex}"]`)
}

export function cell(page: Page, colId: string, rowIndex: number) {
  return row(page, rowIndex).locator(`.ag-cell[col-id="${colId}"]`)
}

/**
 * Uses AG Grid's own navigation API (exposed on window.__gridApi__ for
 * test support) rather than manual scroll math: manipulating scrollLeft/
 * scrollTop directly fights the grid's row/column virtualization and can
 * leave it in an inconsistent render state.
 */
export async function scrollGridToRow(page: Page, rowIndex: number) {
  await page.evaluate((targetRowIndex) => {
    window.__gridApi__.ensureIndexVisible(targetRowIndex, 'top')
  }, rowIndex)
}

export async function ensureColumnVisible(page: Page, colId: string) {
  await page.evaluate((targetColId) => {
    window.__gridApi__.ensureColumnVisible(targetColId)
  }, colId)
}

export interface EditAssertion {
  rowId: string
  periodId: string
  expectedValue: number
  expectedAnnualTotal: number
}

/**
 * Performs one committed cell edit and asserts correctness across all three
 * sources of truth: the DOM cell, the DOM annual-total cell, and canonical
 * Redux state (window.__store__), per PR 6's acceptance check.
 */
export async function performAndAssertEdit(
  page: Page,
  rowIndex: number,
  periodId: string,
  value: number,
): Promise<EditAssertion> {
  await ensureColumnVisible(page, periodId)
  const monthCell = cell(page, periodId, rowIndex)

  const traceCountBefore = (await getInstrumentationExport(page)).traces.length

  await monthCell.click()
  for (const digit of String(value)) {
    await page.keyboard.press(digit)
  }
  await page.keyboard.press('Enter')

  const expectedText = value.toFixed(2)
  await expect(monthCell).toHaveText(expectedText)
  // Ensure AG Grid has fully exited edit mode for this cell before the
  // caller moves on to the next edit; clicking a new cell while this one is
  // still finishing its stopEditing lifecycle can silently drop the edit.
  await expect(monthCell).not.toHaveClass(/ag-cell-inline-editing/)

  // Wait for the instrumentation trace to actually record this edit (i.e.
  // for both requestAnimationFrame boundaries after the AG Grid transaction
  // to fire, per PRD §7.1) before letting the caller start the next edit.
  // Without this, a fast next edit can race AG Grid's own edit-commit
  // lifecycle and silently drop the following cell's onCellValueChanged.
  await expect
    .poll(async () => (await getInstrumentationExport(page)).traces.length)
    .toBeGreaterThan(traceCountBefore)

  const rowId = await row(page, rowIndex).getAttribute('row-id')
  if (!rowId) {
    throw new Error(`row-id attribute missing for row index ${rowIndex}`)
  }

  const state = await page.evaluate((id: string) => {
    const s = window.__store__.getState()
    return s.planLines.entities[id]
  }, rowId)

  expect(state.monthlyValuesByPeriodId[periodId]).toBe(value)

  const expectedAnnualTotal = Object.values(
    state.monthlyValuesByPeriodId as Record<string, number>,
  ).reduce((sum, v) => sum + v, 0)
  expect(state.annualTotal).toBeCloseTo(expectedAnnualTotal, 2)

  return { rowId, periodId, expectedValue: value, expectedAnnualTotal }
}

export async function getInstrumentationExport(page: Page) {
  return page.evaluate(() => window.__getInstrumentationExport__())
}

export function persistBenchmarkResult(scenarioName: string, payload: unknown): string {
  const dir = join(process.cwd(), 'test-results', 'benchmarks')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${scenarioName}.json`)
  writeFileSync(path, JSON.stringify(payload, null, 2))
  return path
}
