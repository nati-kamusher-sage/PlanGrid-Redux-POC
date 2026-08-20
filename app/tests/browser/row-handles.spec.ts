import { test, expect, type Page } from '@playwright/test'

function row(page: Page, rowIndex: number) {
  return page.locator(`.ag-row[row-index="${rowIndex}"]`)
}

function cell(page: Page, colId: string, rowIndex: number) {
  return row(page, rowIndex).locator(`.ag-cell[col-id="${colId}"]`)
}

async function selectFixtureSize(page: Page, size: number) {
  await page.getByLabel('Fixture size:').selectOption(String(size))
}

test('50,000 row handles load, getRowId matches the plan-line ID, and account/dimension columns resolve', async ({
  page,
}) => {
  await page.goto('/')
  await selectFixtureSize(page, 50_000)

  const grid = page.getByTestId('planning-grid')
  await expect(grid.locator('.ag-row').first()).toBeVisible()

  const rowCount = await page.evaluate(() => window.__gridApi__.getDisplayedRowCount())
  expect(rowCount).toBe(50_000)

  const firstRowId = await page.evaluate(() => window.__gridApi__.getRowNode('pl-000001')?.id)
  expect(firstRowId).toBe('pl-000001')

  await expect(cell(page, 'id', 0)).toHaveText('pl-000001')
  await expect(cell(page, 'account', 0)).not.toHaveText('')
  await expect(cell(page, 'department', 0)).not.toHaveText('')
  await expect(cell(page, 'location', 0)).not.toHaveText('')
})

test('an ordinary edit keeps the rowData array reference and the grid shell does not re-render', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.ag-row').first()).toBeVisible()

  const renderCountBefore = await page.evaluate(() => window.__getGridShellRenderCount__())

  const monthCell = cell(page, 'M02', 2)
  await monthCell.click()
  await page.keyboard.press('9')
  await page.keyboard.press('Enter')
  await expect(monthCell).toHaveText('9.00')

  const renderCountAfter = await page.evaluate(() => window.__getGridShellRenderCount__())
  expect(renderCountAfter).toBe(renderCountBefore)
})
