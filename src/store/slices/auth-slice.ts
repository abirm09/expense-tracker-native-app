import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Profile } from '@/types/database.types';

interface AuthState {
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  hasPin: boolean;
  isLoading: boolean;
}

const initialState: AuthState = {
  userId: null,
  email: null,
  profile: null,
  isAuthenticated: false,
  isLocked: false,
  hasPin: false,
  isLoading: true,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthSession: (
      state,
      action: PayloadAction<{
        userId: string | null;
        email: string | null;
        profile: Profile | null;
        hasPin: boolean;
        isLocked: boolean;
      }>
    ) => {
      state.userId = action.payload.userId;
      state.email = action.payload.email;
      state.profile = action.payload.profile;
      state.isAuthenticated = Boolean(action.payload.userId);
      state.hasPin = action.payload.hasPin;
      state.isLocked = action.payload.isLocked;
      state.isLoading = false;
    },
    setProfileState: (state, action: PayloadAction<Profile | null>) => {
      state.profile = action.payload;
      if (action.payload) {
        state.hasPin = Boolean(action.payload.has_pin && action.payload.pin_enabled);
      }
    },
    setLockStatus: (state, action: PayloadAction<boolean>) => {
      state.isLocked = action.payload;
    },
    setHasPinStatus: (state, action: PayloadAction<boolean>) => {
      state.hasPin = action.payload;
    },
    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    clearAuthSession: (state) => {
      state.userId = null;
      state.email = null;
      state.profile = null;
      state.isAuthenticated = false;
      state.isLocked = false;
      state.hasPin = false;
      state.isLoading = false;
    },
  },
});

export const {
  setAuthSession,
  setProfileState,
  setLockStatus,
  setHasPinStatus,
  setAuthLoading,
  clearAuthSession,
} = authSlice.actions;

export default authSlice.reducer;
