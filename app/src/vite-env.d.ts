/// <reference types="vite/client" />

declare global {
  const __AG_GRID_VERSION__: string

  interface Window {
    __store__: typeof import('./app/store').store
    __getInstrumentationExport__: () => import('./instrumentation/types').InstrumentationExport
    __gridApi__: import('ag-grid-community').GridApi<import('./features/planLines/types').PlanLine>
  }
}

export {}
