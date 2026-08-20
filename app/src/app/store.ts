import { configureStore } from '@reduxjs/toolkit'
import planningModelReducer from '../features/planningModel/planningModelSlice'
import { resultMutationMiddleware } from '../features/planningModel/resultMutationMiddleware'

// planningModel.resultValues is the intentionally mutable Float64Array hot
// result buffer (Phase 2 plan PR 5, resultBuffer.ts): it is written to in
// place, never replaced, and is not JSON-serializable in the plain-object
// sense these checks assume. Both checks are dev-only (stripped from a
// production build) and otherwise apply to the rest of the store
// unchanged; only this one path is excluded.
const RESULT_BUFFER_PATH = 'planningModel.resultValues'

export const store = configureStore({
  reducer: {
    planningModel: planningModelReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      immutableCheck: { ignoredPaths: [RESULT_BUFFER_PATH] },
      serializableCheck: { ignoredPaths: [RESULT_BUFFER_PATH] },
    }).concat(resultMutationMiddleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
