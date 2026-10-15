import { supabase } from '@/lib/supabase';
import { apiSlice } from '@/store/api/api-slice';
import { Budget, Category, Database } from '@/types/database.types';

export interface BudgetWithCategory extends Budget {
  categories: Category | null;
}

export interface SetBudgetInput {
  categoryId: string;
  amount: number;
  month: number;
  year: number;
}

export const budgetsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBudgets: builder.query<BudgetWithCategory[], { month: number; year: number }>({
      queryFn: async ({ month, year }) => {
        try {
          const { data, error } = await supabase
            .from('budgets')
            .select(`
              id,
              user_id,
              category_id,
              amount,
              month,
              year,
              created_at,
              categories (
                id,
                user_id,
                name,
                icon,
                color,
                is_default,
                created_at
              )
            `)
            .eq('month', month)
            .eq('year', year);

          if (error) {
            return { error: { message: error.message } };
          }
          return { data: (data ?? []) as unknown as BudgetWithCategory[] };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch budgets';
          return { error: { message } };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Budget' as const, id })),
              { type: 'Budget', id: 'LIST' },
            ]
          : [{ type: 'Budget', id: 'LIST' }],
    }),

    setBudget: builder.mutation<Budget, SetBudgetInput>({
      queryFn: async ({ categoryId, amount, month, year }) => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            return { error: { message: 'User not authenticated' } };
          }

          const { data, error } = await supabase
            .from('budgets')
            .upsert(
              {
                user_id: user.id,
                category_id: categoryId,
                amount,
                month,
                year,
              } as Database['public']['Tables']['budgets']['Insert'],
              { onConflict: 'user_id, category_id, month, year' }
            )
            .select('*')
            .single();

          if (error) {
            return { error: { message: error.message } };
          }
          return { data: data as Budget };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to set budget';
          return { error: { message } };
        }
      },
      invalidatesTags: [{ type: 'Budget', id: 'LIST' }],
    }),
  }),
});

export const { useGetBudgetsQuery, useSetBudgetMutation } = budgetsApi;
