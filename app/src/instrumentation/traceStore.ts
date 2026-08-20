import type { EditTrace } from './types'

/**
 * Deliberately not a Redux slice: recording a trace must never trigger a
 * grid-shell re-render or participate in the plan-line state the bridge
 * observes. Listeners are notified so the dashboard (PR 5 UI) can update
 * itself without the instrumentation store being part of app state.
 */
type Listener = () => void

let traces: EditTrace[] = []
let gridShellRenderCount = 0
const listeners = new Set<Listener>()

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function recordTrace(trace: EditTrace): void {
  traces = [...traces, trace]
  notify()
}

export function getTraces(): EditTrace[] {
  return traces
}

export function resetTraces(): void {
  traces = []
  notify()
}

export function noteGridShellRender(): number {
  gridShellRenderCount += 1
  return gridShellRenderCount
}

export function getGridShellRenderCount(): number {
  return gridShellRenderCount
}
