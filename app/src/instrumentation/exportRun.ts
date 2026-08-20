import { computeSummary } from './summary'
import type { BurstTrace, EditTrace, InstrumentationExport, LoadTrace, RunMetadata } from './types'

const buildMode = import.meta.env.MODE

export function buildRunMetadata(fixtureSize: number, referenceEnvironment: string): RunMetadata {
  return {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    buildMode,
    agGridVersion: __AG_GRID_VERSION__,
    fixtureSize,
    referenceEnvironment,
  }
}

export function buildInstrumentationExport(
  traces: EditTrace[],
  fixtureSize: number,
  referenceEnvironment: string,
  load: LoadTrace | null = null,
  burst: BurstTrace | null = null,
): InstrumentationExport {
  return {
    metadata: buildRunMetadata(fixtureSize, referenceEnvironment),
    summary: computeSummary(traces),
    traces,
    load,
    burst,
  }
}
