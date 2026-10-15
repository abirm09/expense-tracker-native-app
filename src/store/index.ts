import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import { apiSlice } from './api/api-slice';
import authReducer from './slices/auth-slice';
import uiReducer from './slices/ui-slice';

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(apiSlice.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Re-export RTK Query APIs & Slices
export * from './api/accounts-api';
export * from './api/api-slice';
export * from './api/budgets-api';
export * from './api/categories-api';
export * from './api/expenses-api';
export * from './api/profile-api';
export * from './slices/auth-slice';
export * from './slices/ui-slice';
