import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '../app/store'
import { buildInstrumentationExport } from './exportRun'
import { computeSummary } from './summary'
import { getTraces, resetTraces, subscribe } from './traceStore'
import type { InstrumentationExport } from './types'

function formatMs(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)} ms`
}

function downloadInstrumentationJson(payload: InstrumentationExport): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `plan-grid-instrumentation-${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export function InstrumentationPanel() {
  const [, forceUpdate] = useState(0)
  const fixtureSize = useSelector((state: RootState) => state.planLines.fixtureSize)
  const totalRowCount = useSelector((state: RootState) => state.planLines.ids.length)

  useEffect(() => subscribe(() => forceUpdate((n) => n + 1)), [])

  const traces = getTraces()
  const summary = computeSummary(traces, totalRowCount, totalRowCount)

  const handleCopy = () => {
    const payload = buildInstrumentationExport(traces, fixtureSize, totalRowCount, totalRowCount)
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
  }

  const handleDownload = () => {
    downloadInstrumentationJson(
      buildInstrumentationExport(traces, fixtureSize, totalRowCount, totalRowCount),
    )
  }

  return (
    <section data-testid="instrumentation-panel">
      <h2>Instrumentation</h2>
      <dl>
        <dt>Edit count</dt>
        <dd data-testid="metric-edit-count">{summary.editCount}</dd>

        <dt>p50 edit-to-paint</dt>
        <dd data-testid="metric-p50">{formatMs(summary.p50EditToPaintMs)}</dd>

        <dt>p95 edit-to-paint</dt>
        <dd data-testid="metric-p95">{formatMs(summary.p95EditToPaintMs)}</dd>

        <dt>Max edit-to-paint</dt>
        <dd data-testid="metric-max">{formatMs(summary.maxEditToPaintMs)}</dd>

        <dt>Grid-shell render delta</dt>
        <dd data-testid="metric-render-delta">{summary.gridShellRenderDelta}</dd>

        <dt>Bridge updates / transactions</dt>
        <dd data-testid="metric-bridge-transactions">
          {summary.totalBridgeUpdates} / {summary.totalTransactions}
        </dd>

        <dt>Updated row IDs / refreshed cell IDs</dt>
        <dd data-testid="metric-updated-refreshed">
          {summary.totalUpdatedRowIds} / {summary.totalRefreshedCellIds}
        </dd>

        <dt>Displayed / total rows</dt>
        <dd data-testid="metric-row-counts">
          {summary.displayedRowCount} / {summary.totalRowCount}
        </dd>

        <dt>Invariant violations</dt>
        <dd data-testid="metric-invariant-violations">{summary.invariantViolationCount}</dd>
      </dl>

      <p>
        Cell-refresh column IDs are derived, not read from a per-cell AG Grid refresh event: this
        AG Grid version does not expose one publicly, so refreshed columns are inferred from the
        known edit shape (the edited period plus the annual total) once a targeted row transaction
        is confirmed via <code>applyTransaction</code>'s own return value.
      </p>

      <button type="button" onClick={resetTraces} data-testid="reset-button">
        Reset
      </button>
      <button type="button" onClick={handleCopy} data-testid="copy-button">
        Copy JSON
      </button>
      <button type="button" onClick={handleDownload} data-testid="download-button">
        Download JSON
      </button>
    </section>
  )
}
