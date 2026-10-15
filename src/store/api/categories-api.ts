import { supabase } from '@/lib/supabase';
import { apiSlice } from '@/store/api/api-slice';
import { Category, Database } from '@/types/database.types';

export type NewCategoryInput = Database['public']['Tables']['categories']['Insert'];
export type UpdateCategoryInput = Database['public']['Tables']['categories']['Update'] & { id: string };

export const categoriesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCategories: builder.query<Category[], { type?: 'expense' | 'income' | 'both' } | void>({
      queryFn: async (params) => {
        try {
          let query = supabase
            .from('categories')
            .select('*')
            .order('name', { ascending: true });

          if (params?.type && params.type !== 'both') {
            query = query.or(`type.eq.${params.type},type.eq.both,type.is.null`);
          }

          const { data, error } = await query;

          if (error) {
            return { error: { message: error.message } };
          }
          return { data: (data ?? []) as Category[] };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch categories';
          return { error: { message } };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Category' as const, id })),
              { type: 'Category', id: 'LIST' },
            ]
          : [{ type: 'Category', id: 'LIST' }],
    }),

    addCategory: builder.mutation<Category, NewCategoryInput>({
      queryFn: async (newCategory) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const user = session?.user || (await supabase.auth.getUser()).data?.user;
          if (!user) {
            return { error: { message: 'User not authenticated' } };
          }

          const { data, error } = await supabase
            .from('categories')
            .insert({
              ...newCategory,
              user_id: user.id,
              is_default: false,
            } as Database['public']['Tables']['categories']['Insert'])
            .select('*')
            .single();

          if (error) {
            return { error: { message: error.message } };
          }
          return { data: data as Category };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to add category';
          return { error: { message } };
        }
      },
      invalidatesTags: [
        { type: 'Category', id: 'LIST' },
        'Category',
        'Expense',
        'Budget',
      ],
    }),

    updateCategory: builder.mutation<Category, UpdateCategoryInput>({
      queryFn: async ({ id, ...updates }) => {
        try {
          const { data, error } = await supabase
            .from('categories')
            .update(updates as Database['public']['Tables']['categories']['Update'])
            .eq('id', id)
            .select('*')
            .single();

          if (error) {
            return { error: { message: error.message } };
          }
          return { data: data as Category };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to update category';
          return { error: { message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Category', id },
        { type: 'Category', id: 'LIST' },
        'Category',
        'Expense',
        'Budget',
      ],
    }),

    deleteCategory: builder.mutation<{ success: boolean; id: string }, string>({
      queryFn: async (id) => {
        try {
          const { error } = await supabase.from('categories').delete().eq('id', id);
          if (error) {
            return { error: { message: error.message } };
          }
          return { data: { success: true, id } };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to delete category';
          return { error: { message } };
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Category', id },
        { type: 'Category', id: 'LIST' },
        'Category',
        'Expense',
        'Budget',
      ],
    }),

    getCategoryMonthlyUsage: builder.query<
      import('@/types/database.types').CategoryMonthlyUsage[],
      { month?: number; year?: number } | void
    >({
      queryFn: async (params) => {
        try {
          const now = new Date();
          const targetMonth = params?.month ?? now.getMonth() + 1;
          const targetYear = params?.year ?? now.getFullYear();

          const { data, error } = await supabase.rpc('get_category_monthly_usage' as any, {
            target_month: targetMonth,
            target_year: targetYear,
          });

          if (error) {
            return { error: { message: error.message } };
          }
          return { data: (data ?? []) as import('@/types/database.types').CategoryMonthlyUsage[] };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch category usage';
          return { error: { message } };
        }
      },
      providesTags: ['Category', 'Expense', 'Budget'],
    }),
  }),
});

export const {
  useGetCategoriesQuery,
  useAddCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useGetCategoryMonthlyUsageQuery,
} = categoriesApi;

