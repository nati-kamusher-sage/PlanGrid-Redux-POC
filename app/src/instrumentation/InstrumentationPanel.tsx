import { useEffect, useState, type CSSProperties } from 'react'
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

interface Metric {
  label: string
  value: string
  testId: string
}

function MetricCard({ label, value, testId }: Metric) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </span>
      <span data-testid={testId} style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  )
}

const buttonStyle: CSSProperties = {
  padding: '6px 14px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  cursor: 'pointer',
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

  const metrics: Metric[] = [
    { label: 'Edit count', value: String(summary.editCount), testId: 'metric-edit-count' },
    { label: 'p50 edit-to-paint', value: formatMs(summary.p50EditToPaintMs), testId: 'metric-p50' },
    { label: 'p95 edit-to-paint', value: formatMs(summary.p95EditToPaintMs), testId: 'metric-p95' },
    { label: 'Max edit-to-paint', value: formatMs(summary.maxEditToPaintMs), testId: 'metric-max' },
    { label: 'Grid-shell render delta', value: String(summary.gridShellRenderDelta), testId: 'metric-render-delta' },
    {
      label: 'Bridge updates / transactions',
      value: `${summary.totalBridgeUpdates} / ${summary.totalTransactions}`,
      testId: 'metric-bridge-transactions',
    },
    {
      label: 'Updated rows / refreshed cells',
      value: `${summary.totalUpdatedRowIds} / ${summary.totalRefreshedCellIds}`,
      testId: 'metric-updated-refreshed',
    },
    {
      label: 'Displayed / total rows',
      value: `${summary.displayedRowCount} / ${summary.totalRowCount}`,
      testId: 'metric-row-counts',
    },
    {
      label: 'Invariant violations',
      value: String(summary.invariantViolationCount),
      testId: 'metric-invariant-violations',
    },
  ]

  return (
    <section
      data-testid="instrumentation-panel"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>Instrumentation</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={resetTraces} data-testid="reset-button" style={buttonStyle}>
            Reset
          </button>
          <button type="button" onClick={handleCopy} data-testid="copy-button" style={buttonStyle}>
            Copy JSON
          </button>
          <button type="button" onClick={handleDownload} data-testid="download-button" style={buttonStyle}>
            Download JSON
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
        }}
      >
        {metrics.map((metric) => (
          <MetricCard key={metric.testId} {...metric} />
        ))}
      </div>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Cell-refresh column IDs are derived, not read from a per-cell AG Grid refresh event: this
        AG Grid version does not expose one publicly, so refreshed columns are inferred from the
        known edit shape (the edited period plus the annual total) once a targeted row transaction
        is confirmed via <code>applyTransaction</code>'s own return value.
      </p>
    </section>
  )
}
