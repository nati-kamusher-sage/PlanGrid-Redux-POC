import type { Middleware } from '@reduxjs/toolkit'
import { notifyChangedRow } from './changedRowNotifier'
import { planLineResultCellChanged } from './planningModelSlice'
import type { PlanningModelState } from './planningModelSlice'

interface StateWithPlanningModel {
  planningModel: PlanningModelState
}

/**
 * Redux middleware boundary for the changed-row notification (Phase 2 plan,
 * PR 4). Reads `planLineId`/`row` directly from the action payload and the
 * stable `rowByPlanLineId` lookup built once at fixture load; it must never
 * scan the result collection to discover what changed.
 *
 * Typed against the `planningModel` slice shape directly (not the app's
 * `RootState`) to avoid a circular type reference: `RootState` is inferred
 * from the store, which is configured with this middleware.
 */
export const resultMutationMiddleware: Middleware<object, StateWithPlanningModel> =
  (store) => (next) => (action) => {
    const result = next(action)

    if (planLineResultCellChanged.match(action)) {
      const { planLineId, periodId } = action.payload
      const row = store.getState().planningModel.rowByPlanLineId[planLineId]
      if (row !== undefined) {
        notifyChangedRow({ planLineId, row, columns: [periodId, 'annualTotal'] })
      }
    }

    return result
  }
