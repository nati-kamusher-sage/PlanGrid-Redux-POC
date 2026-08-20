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
    __commitAndRecordInstrumentedEdit__: (
      params: Omit<
        import('./instrumentation/instrumentedCommit').CommitPlanLineResultCellParams,
        'dispatch' | 'getState' | 'gridApi'
      >,
    ) => Promise<import('./instrumentation/types').EditTrace>
    __getTraces__: () => import('./instrumentation/types').EditTrace[]
    __resetTraces__: () => void
    __buildInstrumentationExport__: (
      traces: import('./instrumentation/types').EditTrace[],
      fixtureSize: number,
      referenceEnvironment: string,
      load?: import('./instrumentation/types').LoadTrace | null,
      burst?: import('./instrumentation/types').BurstTrace | null,
    ) => import('./instrumentation/types').InstrumentationExport
  }
}

export {}
