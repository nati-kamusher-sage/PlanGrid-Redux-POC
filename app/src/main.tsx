import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import App from './App.tsx'
import { store } from './app/store.ts'
import { batchChangedRowNotifications } from './features/planningModel/changedRowNotifier.ts'
import { buildInstrumentationExport } from './instrumentation/exportRun.ts'
import { commitAndRecordInstrumentedEdit } from './instrumentation/instrumentedCommit.ts'
import { getGridShellRenderCount, getTraces, resetTraces } from './instrumentation/traceStore.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)

// Exposed for browser-test inspection and the PR 6 benchmark harness
// (read-only/benchmark-only usage expected): canonical Redux state is
// client-side data the user's own browser already holds; the render count
// is the same counter PlanningGrid.tsx increments on render; batching
// exercises the same bulk/cascade entry point a real caller would use (no
// bulk-edit UI exists yet to trigger it from the page itself); and the
// instrumented commit drives the same domain action a real valueSetter
// dispatches, so a benchmark measures the production edit path exactly.
window.__store__ = store
window.__getGridShellRenderCount__ = getGridShellRenderCount
window.__batchChangedRowNotifications__ = batchChangedRowNotifications
window.__commitAndRecordInstrumentedEdit__ = (params) =>
  commitAndRecordInstrumentedEdit({
    ...params,
    dispatch: store.dispatch,
    getState: store.getState,
    gridApi: window.__gridApi__,
  })
window.__getTraces__ = getTraces
window.__resetTraces__ = resetTraces
window.__buildInstrumentationExport__ = buildInstrumentationExport
