import { configureStore } from '@reduxjs/toolkit'
import planLinesReducer from '../features/planLines/planLinesSlice'

export const store = configureStore({
  reducer: {
    planLines: planLinesReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
