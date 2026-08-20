/// <reference types="vite/client" />

declare global {
  const __AG_GRID_VERSION__: string

  interface Window {
    __store__: typeof import('./app/store').store
    __gridApi__: import('ag-grid-community').GridApi<
      import('./features/planningModel/types').GridRowHandle
    >
    __getGridShellRenderCount__: () => number
    __batchChangedRowNotifications__: (work: () => void) => void
  }
}

export {}
