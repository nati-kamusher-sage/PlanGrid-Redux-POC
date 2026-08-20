import { test, expect, type Page } from '@playwright/test'

function row(page: Page, rowIndex = 0) {
  return page.locator(`.ag-row[row-index="${rowIndex}"]`)
}

function cell(page: Page, colId: string, rowIndex = 0) {
  return row(page, rowIndex).locator(`.ag-cell[col-id="${colId}"]`)
}

async function scrollGridFullyRight(page: Page) {
  await page
    .getByTestId('planning-grid')
    .locator('.ag-body-horizontal-scroll-viewport')
    .evaluate((el) => {
      el.scrollLeft = el.scrollWidth
    })
}

test('grid becomes ready with 1,000 rows and the intended columns', async ({ page }) => {
  await page.goto('/')

  const grid = page.getByTestId('planning-grid')
  await expect(grid.locator('.ag-row').first()).toBeVisible()

  await expect(grid.locator('.ag-header-cell-text')).toContainText([
    'Row ID',
    'Account Code',
    'Account Name',
    'Department',
    'Location',
    'Type',
    'M01',
    'M02',
  ])

  await expect(cell(page, 'id')).toHaveText('pl-000001')
  await expect(cell(page, 'accountCode')).toHaveText('4000')
  await expect(cell(page, 'M01')).toHaveText('44.12')

  await scrollGridFullyRight(page)
  await expect(grid.locator('.ag-header-cell-text')).toContainText(['M12', 'Annual Total'])
  await expect(cell(page, 'annualTotal')).toHaveText('582.25')
})

test('a monthly cell is editable and the annual total is read-only', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.ag-row').first()).toBeVisible()

  const monthCell = cell(page, 'M01')
  await monthCell.click()
  await page.keyboard.press('7')
  await page.keyboard.press('Enter')
  await expect(monthCell).toHaveText('7.00')

  await scrollGridFullyRight(page)
  const totalCell = cell(page, 'annualTotal')
  await totalCell.dblclick()
  await expect(totalCell.locator('input')).toHaveCount(0)
})
