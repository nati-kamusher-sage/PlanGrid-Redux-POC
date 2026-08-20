import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import App from './App.tsx'
import { store } from './app/store.ts'
import { buildInstrumentationExport } from './instrumentation/exportRun.ts'
import { getTraces } from './instrumentation/traceStore.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)

// Exposed for browser-test inspection (read-only usage expected): canonical
// Redux state is client-side data the user's own browser already holds, and
// the instrumentation export is the same JSON the dashboard's own Copy/
// Download controls produce, so exposing both carries no additional risk.
window.__store__ = store
window.__getInstrumentationExport__ = () => {
  const state = store.getState()
  const totalRowCount = state.planLines.ids.length
  return buildInstrumentationExport(getTraces(), state.planLines.fixtureSize, totalRowCount, totalRowCount)
}
