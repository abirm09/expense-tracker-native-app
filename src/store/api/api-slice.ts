import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Expense', 'Category', 'Budget', 'Profile', 'Stats', 'Account', 'Cashbook'],
  endpoints: () => ({}),
});
