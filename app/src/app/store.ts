import { configureStore } from '@reduxjs/toolkit'
import planningModelReducer from '../features/planningModel/planningModelSlice'
import { resultMutationMiddleware } from '../features/planningModel/resultMutationMiddleware'

export const store = configureStore({
  reducer: {
    planningModel: planningModelReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(resultMutationMiddleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
