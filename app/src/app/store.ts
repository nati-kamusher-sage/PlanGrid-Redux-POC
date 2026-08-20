import { configureStore } from '@reduxjs/toolkit'
import planLinesReducer from '../features/planLines/planLinesSlice'
import planningModelReducer from '../features/planningModel/planningModelSlice'

export const store = configureStore({
  reducer: {
    planLines: planLinesReducer,
    planningModel: planningModelReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
