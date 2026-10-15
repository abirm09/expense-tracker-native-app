import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type DateFilterType = 'all' | 'today' | 'this_week' | 'this_month' | 'custom';

interface UiState {
  isSidebarOpen: boolean;
  selectedCategoryId: string | null;
  dateFilter: DateFilterType;
  customStartDate: string | null;
  customEndDate: string | null;
  searchQuery: string;
  currency: string;
}

const initialState: UiState = {
  isSidebarOpen: false,
  selectedCategoryId: null,
  dateFilter: 'this_month',
  customStartDate: null,
  customEndDate: null,
  searchQuery: '',
  currency: 'BDT',
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSelectedCategoryId: (state, action: PayloadAction<string | null>) => {
      state.selectedCategoryId = action.payload;
    },
    setDateFilter: (
      state,
      action: PayloadAction<{
        filter: DateFilterType;
        startDate?: string | null;
        endDate?: string | null;
      }>
    ) => {
      state.dateFilter = action.payload.filter;
      if (action.payload.startDate !== undefined) {
        state.customStartDate = action.payload.startDate;
      }
      if (action.payload.endDate !== undefined) {
        state.customEndDate = action.payload.endDate;
      }
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setCurrency: (state, action: PayloadAction<string>) => {
      state.currency = action.payload;
    },
    resetFilters: (state) => {
      state.selectedCategoryId = null;
      state.dateFilter = 'this_month';
      state.customStartDate = null;
      state.customEndDate = null;
      state.searchQuery = '';
    },
    openSidebar: (state) => {
      state.isSidebarOpen = true;
    },
    closeSidebar: (state) => {
      state.isSidebarOpen = false;
    },
    toggleSidebar: (state) => {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
  },
});

export const {
  setSelectedCategoryId,
  setDateFilter,
  setSearchQuery,
  setCurrency,
  resetFilters,
  openSidebar,
  closeSidebar,
  toggleSidebar,
} = uiSlice.actions;

export default uiSlice.reducer;
