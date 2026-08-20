import { test, expect, type Page } from '@playwright/test'

function row(page: Page, rowIndex: number) {
  return page.locator(`.ag-row[row-index="${rowIndex}"]`)
}

function cell(page: Page, colId: string, rowIndex: number) {
  return row(page, rowIndex).locator(`.ag-cell[col-id="${colId}"]`)
}

test('instrumentation panel starts at zero and updates after an edit', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.ag-row').first()).toBeVisible()

  const panel = page.getByTestId('instrumentation-panel')
  await expect(panel.getByTestId('metric-edit-count')).toHaveText('0')
  await expect(panel.getByTestId('metric-invariant-violations')).toHaveText('0')

  const monthCell = cell(page, 'M05', 2)
  await monthCell.click()
  await page.keyboard.press('8')
  await page.keyboard.press('8')
  await page.keyboard.press('Enter')
  await expect(monthCell).toHaveText('88.00')

  await expect(panel.getByTestId('metric-edit-count')).toHaveText('1')
  await expect(panel.getByTestId('metric-render-delta')).toHaveText('0')
  await expect(panel.getByTestId('metric-bridge-transactions')).toHaveText('1 / 1')
  await expect(panel.getByTestId('metric-updated-refreshed')).toHaveText('1 / 2')
  await expect(panel.getByTestId('metric-invariant-violations')).toHaveText('0')
})

test('reset clears the run without changing the fixture', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.ag-row').first()).toBeVisible()

  const panel = page.getByTestId('instrumentation-panel')
  const monthCell = cell(page, 'M01', 0)
  await monthCell.click()
  await page.keyboard.press('5')
  await page.keyboard.press('Enter')
  await expect(monthCell).toHaveText('5.00')
  await expect(panel.getByTestId('metric-edit-count')).toHaveText('1')

  await panel.getByTestId('reset-button').click()

  await expect(panel.getByTestId('metric-edit-count')).toHaveText('0')
  await expect(panel.getByTestId('metric-p50')).toHaveText('—')
  // The fixture itself is untouched by reset.
  await expect(monthCell).toHaveText('5.00')
})

test('copy JSON produces a payload with metadata, summary, and raw traces', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await expect(page.locator('.ag-row').first()).toBeVisible()

  const panel = page.getByTestId('instrumentation-panel')
  const monthCell = cell(page, 'M01', 0)
  await monthCell.click()
  await page.keyboard.press('3')
  await page.keyboard.press('Enter')
  await expect(monthCell).toHaveText('3.00')
  await expect(panel.getByTestId('metric-edit-count')).toHaveText('1')

  await panel.getByTestId('copy-button').click()

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  const parsed = JSON.parse(clipboardText)

  expect(parsed.metadata.agGridVersion).toBe('36.1.0')
  expect(parsed.metadata.buildMode).toBe('production')
  expect(typeof parsed.metadata.timestamp).toBe('string')
  expect(parsed.summary.editCount).toBe(1)
  expect(parsed.traces).toHaveLength(1)

  const trace = parsed.traces[0]
  expect(trace.rowId).toBe('pl-000001')
  expect(trace.periodId).toBe('M01')
  expect(trace.transaction.rowIds).toEqual(['pl-000001'])
  expect(trace.invariants.singleTransactionSingleRow).toBe(true)
})
