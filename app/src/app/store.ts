import { configureStore } from '@reduxjs/toolkit'
import planningModelReducer from '../features/planningModel/planningModelSlice'

export const store = configureStore({
  reducer: {
    planningModel: planningModelReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
