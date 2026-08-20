import { computeSummary } from './summary'
import type { EditTrace, InstrumentationExport, RunMetadata } from './types'

const buildMode = import.meta.env.MODE

export function buildRunMetadata(fixtureSize: number): RunMetadata {
  return {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    buildMode,
    agGridVersion: __AG_GRID_VERSION__,
    fixtureSize,
  }
}

export function buildInstrumentationExport(
  traces: EditTrace[],
  fixtureSize: number,
  displayedRowCount: number,
  totalRowCount: number,
): InstrumentationExport {
  return {
    metadata: buildRunMetadata(fixtureSize),
    summary: computeSummary(traces, displayedRowCount, totalRowCount),
    traces,
  }
}
