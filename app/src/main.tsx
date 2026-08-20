import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import App from './App.tsx'
import { store } from './app/store.ts'
import { getGridShellRenderCount } from './instrumentation/traceStore.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)

// Exposed for browser-test inspection (read-only usage expected): canonical
// Redux state is client-side data the user's own browser already holds, and
// the render count is the same counter PlanningGrid.tsx increments on render.
window.__store__ = store
window.__getGridShellRenderCount__ = getGridShellRenderCount
