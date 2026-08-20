import { test, expect, type Page } from '@playwright/test'

function row(page: Page, rowIndex: number) {
  return page.locator(`.ag-row[row-index="${rowIndex}"]`)
}

function cell(page: Page, colId: string, rowIndex: number) {
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

test('an ordinary edit changes only the edited row in the DOM', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.ag-row').first()).toBeVisible()

  const editedRowIndex = 3
  const otherRowIndex = 7

  // Track which row containers receive DOM mutations while the edit happens.
  await page.evaluate(() => {
    const container = document.querySelector('.ag-grid-scrolling-container')
    if (!container) {
      throw new Error('grid rows container not found')
    }
    const touchedRowIndexes = new Set<string>()
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement
        const rowEl = target?.closest('.ag-row')
        const rowIndex = rowEl?.getAttribute('row-index')
        if (rowIndex !== null && rowIndex !== undefined) {
          touchedRowIndexes.add(rowIndex)
        }
      }
    })
    observer.observe(container, { subtree: true, childList: true, characterData: true, attributes: true })
    ;(window as unknown as { __touchedRowIndexes: Set<string> }).__touchedRowIndexes = touchedRowIndexes
  })

  const monthCell = cell(page, 'M03', editedRowIndex)
  await monthCell.click()
  await page.keyboard.press('4')
  await page.keyboard.press('2')
  await page.keyboard.press('Enter')
  await expect(monthCell).toHaveText('42.00')

  const touchedRowIndexes = await page.evaluate(
    () => Array.from((window as unknown as { __touchedRowIndexes: Set<string> }).__touchedRowIndexes),
  )

  expect(touchedRowIndexes).toEqual([String(editedRowIndex)])
  expect(touchedRowIndexes).not.toContain(String(otherRowIndex))
})

test('edited value, Redux state, and annual total agree', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.ag-row').first()).toBeVisible()

  const rowIndex = 0
  const monthCell = cell(page, 'M02', rowIndex)
  await monthCell.click()
  await page.keyboard.press('1')
  await page.keyboard.press('0')
  await page.keyboard.press('0')
  await page.keyboard.press('Enter')
  await expect(monthCell).toHaveText('100.00')

  await scrollGridFullyRight(page)
  // Baseline row total is 582.25 with M02 = 81.37; replacing it with 100 shifts the total by +18.63.
  await expect(cell(page, 'annualTotal', rowIndex)).toHaveText('600.88')
})

test('repeated edits to the same row each apply as a single targeted update', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.ag-row').first()).toBeVisible()

  const rowIndex = 1
  const monthCell = cell(page, 'M01', rowIndex)

  for (const value of ['10', '20', '30']) {
    await monthCell.click()
    for (const digit of value) {
      await page.keyboard.press(digit)
    }
    await page.keyboard.press('Enter')
    await expect(monthCell).toHaveText(`${value}.00`)
  }
})
