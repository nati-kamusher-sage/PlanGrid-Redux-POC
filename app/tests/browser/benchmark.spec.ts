import { test, expect } from '@playwright/test'
import {
  assertNoInvariantOrCorrectnessViolations,
  getInstrumentationExport,
  measureInitialLoad,
  persistBenchmarkResult,
  REFERENCE_ENVIRONMENT,
  runInstrumentedEdits,
  selectFixtureSize,
  waitForGridReady,
} from './support/benchmarkHelpers.ts'

const FIXTURE_SIZE = 50_000
const WARM_UP_COUNT = 3
const MEASURED_COUNT = 30

test.describe.configure({ mode: 'serial' })

test('initial load at 50,000 rows: fixture/reset and grid-ready, stable handles, no edit work', async ({
  page,
}) => {
  const load = await measureInitialLoad(page, FIXTURE_SIZE)

  expect(load.rowCount).toBe(FIXTURE_SIZE)
  expect(load.stableHandles).toBe(true)
  expect(load.fixtureGenerationMs).toBeGreaterThanOrEqual(0)
  expect(load.gridReadyMs).toBeGreaterThanOrEqual(load.fixtureGenerationMs)

  const traceCountAfterLoad = await page.evaluate(() => window.__getTraces__().length)
  expect(traceCountAfterLoad).toBe(0)

  persistBenchmarkResult('initial-load-50k.json', {
    metadata: { fixtureSize: FIXTURE_SIZE, referenceEnvironment: REFERENCE_ENVIRONMENT },
    load,
  })
})

test('visible edit at 50,000 rows: 3 warm-up + 30 measured edits on an initially visible row', async ({
  page,
}) => {
  await page.goto('/')
  await selectFixtureSize(page, FIXTURE_SIZE)
  await waitForGridReady(page)
  await page.evaluate(() => window.__resetTraces__())

  const traces = await runInstrumentedEdits(page, {
    rowIndexes: [0],
    periodId: 'M06',
    scenario: 'visible',
    warmUpCount: WARM_UP_COUNT,
    measuredCount: MEASURED_COUNT,
  })

  expect(traces).toHaveLength(WARM_UP_COUNT + MEASURED_COUNT)
  assertNoInvariantOrCorrectnessViolations(traces)

  const measuredTraces = traces.slice(WARM_UP_COUNT)
  const syncCpuValues = measuredTraces.map((trace) => trace.syncCpuMs).sort((a, b) => a - b)
  const p95Index = Math.min(syncCpuValues.length - 1, Math.ceil(0.95 * syncCpuValues.length) - 1)
  const p95SyncCpuMs = syncCpuValues[p95Index]

  const exportPayload = await getInstrumentationExport(page, FIXTURE_SIZE)
  persistBenchmarkResult('visible-edit-50k.json', {
    ...exportPayload,
    warmUpCount: WARM_UP_COUNT,
    measuredCount: MEASURED_COUNT,
    p95SyncCpuMs,
  })
})

test('later-viewport edit at 50,000 rows: same scope invariants after virtualization/scroll', async ({
  page,
}) => {
  await page.goto('/')
  await selectFixtureSize(page, FIXTURE_SIZE)
  await waitForGridReady(page)
  await page.evaluate(() => window.__resetTraces__())

  const scrolledRowIndex = 25_000
  await page.evaluate((rowIndex) => {
    window.__gridApi__.ensureIndexVisible(rowIndex, 'top')
  }, scrolledRowIndex)

  const traces = await runInstrumentedEdits(page, {
    rowIndexes: [scrolledRowIndex],
    periodId: 'M06',
    scenario: 'later-viewport',
    warmUpCount: WARM_UP_COUNT,
    measuredCount: MEASURED_COUNT,
  })

  expect(traces).toHaveLength(WARM_UP_COUNT + MEASURED_COUNT)
  assertNoInvariantOrCorrectnessViolations(traces)

  const exportPayload = await getInstrumentationExport(page, FIXTURE_SIZE)
  persistBenchmarkResult('later-viewport-edit-50k.json', {
    ...exportPayload,
    warmUpCount: WARM_UP_COUNT,
    measuredCount: MEASURED_COUNT,
    scrolledRowIndex,
  })
})

test('off-screen edit at 50,000 rows: no unrelated visible refresh, correct once scrolled into view', async ({
  page,
}) => {
  await page.goto('/')
  await selectFixtureSize(page, FIXTURE_SIZE)
  await waitForGridReady(page)
  await page.evaluate(() => window.__resetTraces__())

  const offscreenRowIndex = 40_000

  const visibleRowIdsBefore = await page.evaluate(() =>
    window.__gridApi__.getRenderedNodes().map((node) => node.id),
  )

  const [trace] = await runInstrumentedEdits(page, {
    rowIndexes: [offscreenRowIndex],
    periodId: 'M07',
    scenario: 'off-screen',
    warmUpCount: 0,
    measuredCount: 1,
  })

  assertNoInvariantOrCorrectnessViolations([trace])

  const visibleRowIdsAfter = await page.evaluate(() =>
    window.__gridApi__.getRenderedNodes().map((node) => node.id),
  )
  expect(visibleRowIdsAfter).toEqual(visibleRowIdsBefore)

  await page.evaluate((rowIndex) => {
    window.__gridApi__.ensureIndexVisible(rowIndex, 'top')
  }, offscreenRowIndex)

  const revealedValue = await page.evaluate(
    ({ rowIndex, periodId }) => {
      const node = window.__gridApi__.getDisplayedRowAtIndex(rowIndex)
      return node ? window.__gridApi__.getCellValue({ rowNode: node, colKey: periodId }) : undefined
    },
    { rowIndex: offscreenRowIndex, periodId: 'M07' },
  )
  expect(revealedValue).toBe(100)

  persistBenchmarkResult('off-screen-edit-50k.json', {
    fixtureSize: FIXTURE_SIZE,
    referenceEnvironment: REFERENCE_ENVIRONMENT,
    offscreenRowIndex,
    trace,
    noUnrelatedVisibleRefresh: JSON.stringify(visibleRowIdsBefore) === JSON.stringify(visibleRowIdsAfter),
    revealedValueCorrect: revealedValue === 100,
  })
})

test('burst at 50,000 rows: a defined number of same/different-row edits coalesce with correct final values', async ({
  page,
}) => {
  await page.goto('/')
  await selectFixtureSize(page, FIXTURE_SIZE)
  await waitForGridReady(page)

  const EDIT_COUNT = 20
  const DISTINCT_ROW_COUNT = 5

  const result = await page.evaluate(
    async ({ editCount, distinctRowCount }) => {
      let refreshCallCount = 0
      const originalRefreshCells = window.__gridApi__.refreshCells
      window.__gridApi__.refreshCells = function (this: unknown, params) {
        refreshCallCount += 1
        return originalRefreshCells.call(window.__gridApi__, params)
      }

      const targetRows = Array.from({ length: distinctRowCount }, (_, i) => i)
      const start = performance.now()
      window.__batchChangedRowNotifications__(() => {
        for (let i = 0; i < editCount; i += 1) {
          const rowIndex = targetRows[i % targetRows.length]
          const node = window.__gridApi__.getDisplayedRowAtIndex(rowIndex)
          if (!node?.data) continue
          window.__store__.dispatch({
            type: 'planningModel/planLineResultCellChanged',
            payload: { planLineId: node.data.id, periodId: 'M08', value: 200 + i },
          })
        }
      })

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      const durationMs = performance.now() - start

      window.__gridApi__.refreshCells = originalRefreshCells

      const finalValuesCorrect = targetRows.every((rowIndex) => {
        const node = window.__gridApi__.getDisplayedRowAtIndex(rowIndex)
        if (!node?.data) return false
        const state = window.__store__.getState().planningModel
        const row = state.rowByPlanLineId[node.data.id]
        const periodIndex = 7 // M08
        const value = state.resultValues[row * 12 + periodIndex]
        return typeof value === 'number' && value >= 200 && value < 200 + editCount
      })

      return { refreshCallCount, durationMs, finalValuesCorrect, distinctRowCount }
    },
    { editCount: EDIT_COUNT, distinctRowCount: DISTINCT_ROW_COUNT },
  )

  expect(result.refreshCallCount).toBe(1)
  expect(result.finalValuesCorrect).toBe(true)

  persistBenchmarkResult('burst-50k.json', {
    fixtureSize: FIXTURE_SIZE,
    referenceEnvironment: REFERENCE_ENVIRONMENT,
    editCount: EDIT_COUNT,
    ...result,
  })
})
