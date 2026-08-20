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

async function selectFixtureSize(page: Page, size: number) {
  await page.getByLabel('Fixture size:').selectOption(String(size))
}

test('editing a monthly cell refreshes that cell and the same row annual total, from one notification', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.ag-row').first()).toBeVisible()

  await scrollGridFullyRight(page)
  await expect(cell(page, 'annualTotal', 0)).toHaveText('574.43')

  const monthCell = cell(page, 'M02', 0)
  await monthCell.scrollIntoViewIfNeeded()
  await monthCell.click()
  await page.keyboard.press('1')
  await page.keyboard.press('0')
  await page.keyboard.press('0')
  await page.keyboard.press('Enter')
  await expect(monthCell).toHaveText('100.00')

  // Baseline row total is 574.43 with M02 = 66.24; replacing it with 100 shifts the total by +33.76.
  await scrollGridFullyRight(page)
  await expect(cell(page, 'annualTotal', 0)).toHaveText('608.19')
})

test('an ordinary edit mutates only the edited row in the DOM', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.ag-row').first()).toBeVisible()

  const editedRowIndex = 3
  const otherRowIndex = 7

  await page.evaluate(() => {
    const container = document.querySelector('.ag-grid-scrolling-container') ?? document.querySelector('.ag-center-cols-container')
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

  expect(touchedRowIndexes).toContain(String(editedRowIndex))
  expect(touchedRowIndexes).not.toContain(String(otherRowIndex))
})

test('a batched burst of edits deduplicates by row/column into one refresh call, not one per action', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.ag-row').first()).toBeVisible()

  const refreshCallCount = await page.evaluate(() => {
    let calls = 0
    const originalRefreshCells = window.__gridApi__.refreshCells.bind(window.__gridApi__)
    window.__gridApi__.refreshCells = (params) => {
      calls += 1
      return originalRefreshCells(params)
    }

    return new Promise<number>((resolve) => {
      // Exercises the same batching entry point a bulk/cascade path would
      // use: several synchronous dispatches to the same and different rows,
      // coalesced into one animation-frame flush instead of one grid
      // operation per action.
      window.__batchChangedRowNotifications__(() => {
        for (let i = 0; i < 5; i += 1) {
          window.__store__.dispatch({
            type: 'planningModel/planLineResultCellChanged',
            payload: { planLineId: 'pl-000001', periodId: 'M04', value: i },
          })
        }
        for (let row = 1; row <= 5; row += 1) {
          window.__store__.dispatch({
            type: 'planningModel/planLineResultCellChanged',
            payload: { planLineId: `pl-${String(row + 1).padStart(6, '0')}`, periodId: 'M01', value: row },
          })
        }
      })
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(calls)))
    })
  })

  expect(refreshCallCount).toBe(1)
})

test('an off-screen edit at 50,000 rows performs no visible-row refresh and is correct once scrolled into view', async ({
  page,
}) => {
  await page.goto('/')
  await selectFixtureSize(page, 50_000)
  await expect(page.locator('.ag-row').first()).toBeVisible()

  // Edit a row far outside the initial viewport via the grid API + Redux
  // dispatch path (same domain action a real edit dispatches), then confirm
  // no currently-rendered row was refreshed as a side effect.
  const visibleRowIdsBefore = await page.evaluate(() =>
    window.__gridApi__.getRenderedNodes().map((node) => node.id),
  )

  await page.evaluate(() => {
    window.__store__.dispatch({
      type: 'planningModel/planLineResultCellChanged',
      payload: { planLineId: 'pl-049999', periodId: 'M05', value: 12_345 },
    })
  })

  const visibleRowIdsAfter = await page.evaluate(() =>
    window.__gridApi__.getRenderedNodes().map((node) => node.id),
  )
  expect(visibleRowIdsAfter).toEqual(visibleRowIdsBefore)

  await page.evaluate(() => {
    window.__gridApi__.ensureIndexVisible(49_998, 'top')
  })
  const offscreenRowIndex = await page.evaluate(
    () => window.__gridApi__.getRowNode('pl-049999')?.rowIndex,
  )
  expect(offscreenRowIndex).toBe(49_998)
  await expect(cell(page, 'M05', 49_998)).toHaveText('12,345.00')
})
