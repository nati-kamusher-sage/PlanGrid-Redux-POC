import type { ColDef } from 'ag-grid-community'
import { PERIOD_IDS, type PlanLine } from './types'

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number | null | undefined): string {
  return typeof value === 'number' ? numberFormatter.format(value) : ''
}

export function buildColumnDefs(): ColDef<PlanLine>[] {
  const monthColumns: ColDef<PlanLine>[] = PERIOD_IDS.map((periodId) => ({
    colId: periodId,
    headerName: periodId,
    field: `monthlyValuesByPeriodId.${periodId}` as const,
    editable: true,
    cellEditor: 'agNumberCellEditor',
    valueFormatter: (params) => formatCurrency(params.value as number),
    type: 'numericColumn',
    width: 90,
  }))

  return [
    { colId: 'id', headerName: 'Row ID', field: 'id', pinned: 'left', width: 110 },
    {
      colId: 'account',
      headerName: 'Account',
      valueGetter: (params) =>
        params.data ? `${params.data.accountCode} ${params.data.accountName}` : '',
      width: 220,
    },
    { colId: 'department', headerName: 'Department', field: 'department', width: 130 },
    { colId: 'location', headerName: 'Location', field: 'location', width: 100 },
    ...monthColumns,
    {
      colId: 'annualTotal',
      headerName: 'Annual Total',
      field: 'annualTotal',
      editable: false,
      valueFormatter: (params) => formatCurrency(params.value as number),
      type: 'numericColumn',
      width: 120,
      pinned: 'right',
    },
  ]
}

export const DEFAULT_COL_DEF: ColDef<PlanLine> = {
  sortable: true,
  resizable: true,
}
