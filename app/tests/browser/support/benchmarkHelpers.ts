import { expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EditTrace, InstrumentationExport } from '../../../src/instrumentation/types.ts'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

// Not independently agreed before this PR (Phase 2 plan §13.3 allows
// recording the environment and reporting without a pass/fail declaration
// until it is). Captured here, not asserted against a threshold.
export const REFERENCE_ENVIRONMENT =
  'Apple M1 Pro, 32 GB RAM, macOS 26.5.2 (build 25F84), arm64; Playwright-managed Chromium, production preview build (npm run build && npm run preview)'

export async function selectFixtureSize(page: Page, size: number): Promise<void> {
  await page.getByLabel('Fixture size:').selectOption(String(size))
}

export async function waitForGridReady(page: Page): Promise<void> {
  await expect(page.locator('.ag-row').first()).toBeVisible()
}

/**
 * Loads the fixture and measures fixture-generation + grid-ready timing for
 * the PR 6 "initial load" scenario. `fixtureReset` is dispatched directly
 * (mirroring the FixtureSizeSelector's own dispatch) so the timer starts
 * before any React/AG Grid work begins.
 */
export async function measureInitialLoad(page: Page, size: number) {
  await page.goto('/')
  await waitForGridReady(page)

  const result = await page.evaluate(async (fixtureSize) => {
    const start = performance.now()
    window.__store__.dispatch({ type: 'planningModel/fixtureReset', payload: { size: fixtureSize } })
    await new Promise<void>((resolve) => {
      const check = () => {
        const rowCount = window.__gridApi__?.getDisplayedRowCount() ?? 0
        if (rowCount === fixtureSize) {
          resolve()
        } else {
          requestAnimationFrame(check)
        }
      }
      requestAnimationFrame(check)
    })
    const gridReadyMs = performance.now() - start
    const fixtureGenerationMs = window.__store__.getState().planningModel.lastGenerationDurationMs
    const rowCount = window.__gridApi__.getDisplayedRowCount()
    const rowByPlanLineId = window.__store__.getState().planningModel.rowByPlanLineId
    const stableHandles = window.__store__.getState().planningModel.rowHandles.every(
      (handle: { id: string; row: number }) => rowByPlanLineId[handle.id] === handle.row,
    )
    return { fixtureGenerationMs, gridReadyMs, rowCount, stableHandles }
  }, size)

  return { fixtureSize: size, ...result }
}

export interface RunEditsOptions {
  rowIndexes: number[]
  periodId: string
  scenario: EditTrace['scenario']
  warmUpCount: number
  measuredCount: number
}

/**
 * Drives warm-up + measured edits through the exact production edit path
 * (commitAndRecordInstrumentedEdit dispatches the same domain action a real
 * valueSetter would), cycling through `rowIndexes` so a "same/different row"
 * mix is easy to express. Warm-up traces are recorded like any other but the
 * caller is expected to slice them off before computing percentiles.
 */
export async function runInstrumentedEdits(page: Page, options: RunEditsOptions): Promise<EditTrace[]> {
  const { rowIndexes, periodId, scenario, warmUpCount, measuredCount } = options
  const totalCount = warmUpCount + measuredCount

  return page.evaluate(
    async ({ rowIndexes, periodId, scenario, totalCount }) => {
      const traces: EditTrace[] = []
      for (let i = 0; i < totalCount; i += 1) {
        const rowIndex = rowIndexes[i % rowIndexes.length]
        const node = window.__gridApi__.getDisplayedRowAtIndex(rowIndex)
        if (!node?.data) {
          throw new Error(`no row node at displayed index ${rowIndex}`)
        }
        const trace = await window.__commitAndRecordInstrumentedEdit__({
          planLineId: node.data.id,
          row: rowIndex,
          periodId: periodId as never,
          value: 100 + i,
          scenario,
        })
        traces.push(trace)
      }
      return traces
    },
    { rowIndexes, periodId, scenario, totalCount },
  )
}

export function assertNoInvariantOrCorrectnessViolations(traces: EditTrace[]): void {
  for (const trace of traces) {
    expect(trace.invariants.singleActionDispatched, `edit ${trace.editId}`).toBe(true)
    expect(trace.invariants.singleNotificationSingleRow, `edit ${trace.editId}`).toBe(true)
    expect(trace.invariants.targetedColumnsCorrect, `edit ${trace.editId}`).toBe(true)
    expect(trace.invariants.gridShellRenderCountStable, `edit ${trace.editId}`).toBe(true)
    expect(trace.correctness.resultValueCorrect, `edit ${trace.editId}`).toBe(true)
    expect(trace.correctness.annualTotalCorrect, `edit ${trace.editId}`).toBe(true)
  }
}

export async function getInstrumentationExport(
  page: Page,
  fixtureSize: number,
): Promise<InstrumentationExport> {
  return page.evaluate(
    ({ fixtureSize, referenceEnvironment }) =>
      window.__buildInstrumentationExport__(window.__getTraces__(), fixtureSize, referenceEnvironment),
    { fixtureSize, referenceEnvironment: REFERENCE_ENVIRONMENT },
  )
}

/**
 * Writes to docs/benchmark-results/phase-2/, or to a named subdirectory of
 * it when BENCHMARK_OUTPUT_SUBDIR is set -- used to capture a comparison
 * run (e.g. PR 5's typed-buffer storage) alongside the default run's
 * committed baseline without overwriting it.
 */
export function persistBenchmarkResult(fileName: string, payload: unknown): void {
  const subdir = process.env.BENCHMARK_OUTPUT_SUBDIR
  const outDir = path.resolve(
    currentDir,
    '../../../../docs/benchmark-results/phase-2',
    ...(subdir ? [subdir] : []),
  )
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(payload, null, 2))
}
