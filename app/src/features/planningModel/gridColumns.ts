import type { ColDef, ValueGetterParams, ValueSetterParams } from 'ag-grid-community'
import { planLineResultCellChanged } from './planningModelSlice'
import {
  readAccountName,
  readAnnualTotal,
  readDimensionLabel,
  readResultCell,
} from './selectors'
import { PERIOD_IDS, type GridRowHandle, type PeriodId } from './types'
import type { AppDispatch, RootState } from '../../app/store'

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: unknown): string {
  return typeof value === 'number' ? numberFormatter.format(value) : ''
}

export interface GridColumnDeps {
  getState: () => RootState
  dispatch: AppDispatch
}

function buildPeriodColumn(periodId: PeriodId, deps: GridColumnDeps): ColDef<GridRowHandle> {
  return {
    colId: periodId,
    headerName: periodId,
    editable: true,
    cellEditor: 'agNumberCellEditor',
    type: 'numericColumn',
    width: 90,
    valueFormatter: (params) => formatCurrency(params.value),
    // Reads the canonical result on demand; the row handle never stores it.
    valueGetter: (params: ValueGetterParams<GridRowHandle>) =>
      params.data ? readResultCell(deps.getState(), params.data.id, periodId) : undefined,
    // Validates and dispatches the domain action; AG Grid's row object is
    // never treated as the source of truth for the edited value.
    valueSetter: (params: ValueSetterParams<GridRowHandle>) => {
      if (!params.data) {
        return false
      }
      const value = Number(params.newValue)
      if (!Number.isFinite(value)) {
        return false
      }
      deps.dispatch(
        planLineResultCellChanged({ planLineId: params.data.id, periodId, value }),
      )
      return true
    },
  }
}

export function buildColumnDefs(deps: GridColumnDeps): ColDef<GridRowHandle>[] {
  const monthColumns = PERIOD_IDS.map((periodId) => buildPeriodColumn(periodId, deps))

  return [
    { colId: 'id', headerName: 'Row ID', field: 'id', pinned: 'left', width: 110 },
    {
      colId: 'account',
      headerName: 'Account',
      width: 220,
      valueGetter: (params: ValueGetterParams<GridRowHandle>) => {
        if (!params.data) {
          return ''
        }
        const state = deps.getState()
        const planLine = state.planningModel.planLines[params.data.id]
        const accountName = readAccountName(state, params.data.id)
        return planLine ? `${planLine.glAccountKey} ${accountName}` : ''
      },
    },
    {
      colId: 'department',
      headerName: 'Department',
      width: 130,
      valueGetter: (params: ValueGetterParams<GridRowHandle>) =>
        params.data ? readDimensionLabel(deps.getState(), params.data.id, 'department') : '',
    },
    {
      colId: 'location',
      headerName: 'Location',
      width: 100,
      valueGetter: (params: ValueGetterParams<GridRowHandle>) =>
        params.data ? readDimensionLabel(deps.getState(), params.data.id, 'location') : '',
    },
    ...monthColumns,
    {
      colId: 'annualTotal',
      headerName: 'Annual Total',
      editable: false,
      valueFormatter: (params) => formatCurrency(params.value),
      type: 'numericColumn',
      width: 120,
      pinned: 'right',
      // Derived from the 12 period values on every read; PR 4 adds the
      // targeted refresh that repaints this cell after an edit to another
      // column on the same row.
      valueGetter: (params: ValueGetterParams<GridRowHandle>) =>
        params.data ? readAnnualTotal(deps.getState(), params.data.id) : undefined,
    },
  ]
}

export const DEFAULT_COL_DEF: ColDef<GridRowHandle> = {
  sortable: true,
  resizable: true,
}
