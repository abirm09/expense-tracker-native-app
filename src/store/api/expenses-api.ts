import { supabase } from '@/lib/supabase';
import { fetchAllPages } from '@/lib/fetch-all';
import { apiSlice } from '@/store/api/api-slice';
import { AccountingSummary, Database, Expense, ExpenseWithCategory } from '@/types/database.types';

export interface ExpenseFilterParams {
  type?: 'expense' | 'income' | 'transfer' | null;
  categoryId?: string | null;
  accountId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  limit?: number;
}

export interface CategoryDistribution {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  total: number;
  percentage: number;
}

export interface ExpenseStats {
  totalSpent: number;
  totalIncome: number;
  netSavings: number;
  savingsRate: number;
  transactionCount: number;
  categoryBreakdown: CategoryDistribution[];
  incomeBreakdown: CategoryDistribution[];
}

export type AddExpenseInput = Omit<Database['public']['Tables']['expenses']['Insert'], 'id' | 'user_id'>;
export type UpdateExpenseInput = Database['public']['Tables']['expenses']['Update'] & { id: string };

export const expensesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getExpenses: builder.query<ExpenseWithCategory[], ExpenseFilterParams | void>({
      queryFn: async (params) => {
        try {
          const buildExpensesQuery = () => {
            let query = supabase
              .from('expenses')
              .select(`
                id,
                user_id,
                category_id,
                account_id,
                to_account_id,
                contact_id,
                debt_type,
                due_date,
                transfer_group_id,
                title,
                amount,
                type,
                entry_type,
                currency,
                date,
                notes,
                created_at,
                updated_at,
                categories (
                  id,
                  user_id,
                  name,
                  icon,
                  color,
                  type,
                  is_default,
                  created_at
                ),
                accounts:account_id (
                  id,
                  name,
                  type,
                  color
                ),
                to_accounts:to_account_id (
                  id,
                  name,
                  type,
                  color
                ),
                contacts:contact_id (
                  id,
                  name,
                  phone,
                  email,
                  whatsapp
                )
              `)
              .order('date', { ascending: false })
              .order('created_at', { ascending: false })
              .order('id');

            if (params?.type) {
              query = query.eq('type', params.type);
            }
            if (params?.categoryId) {
              query = query.eq('category_id', params.categoryId);
            }
            if (params?.accountId) {
              query = query.eq('account_id', params.accountId);
            }
            if (params?.startDate) {
              query = query.gte('date', params.startDate);
            }
            if (params?.endDate) {
              query = query.lte('date', params.endDate);
            }

            return query;
          };

          const buildFallbackExpensesQuery = () => {
            let query = supabase
              .from('expenses')
              .select('*, categories (*)')
              .order('date', { ascending: false })
              .order('created_at', { ascending: false })
              .order('id');

            if (params?.type) query = query.eq('type', params.type);
            if (params?.categoryId) query = query.eq('category_id', params.categoryId);
            if (params?.accountId) query = query.eq('account_id', params.accountId);
            if (params?.startDate) query = query.gte('date', params.startDate);
            if (params?.endDate) query = query.lte('date', params.endDate);

            return query;
          };

          const runQuery = async (
            build: () => any
          ): Promise<{ data: unknown[] | null; error: string | null }> => {
            if (params?.limit) {
              const res = await build().limit(params.limit);
              return { data: res.data, error: res.error?.message ?? null };
            }
            const res = await fetchAllPages((from, to) => build().range(from, to));
            return { data: res.data, error: res.error };
          };

          const primary = await runQuery(buildExpensesQuery);
          if (!primary.error && primary.data) {
            return { data: primary.data as unknown as ExpenseWithCategory[] };
          }

          // Resilient fallback: If embedded relationships fail due to schema cache, fetch basic expenses with categories
          const fallback = await runQuery(buildFallbackExpensesQuery);
          if (!fallback.error && fallback.data) {
            return { data: fallback.data as unknown as ExpenseWithCategory[] };
          }

          return { error: { message: primary.error ?? 'Failed to fetch expenses' } };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch expenses';
          return { error: { message } };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Expense' as const, id })),
              { type: 'Expense', id: 'LIST' },
            ]
          : [{ type: 'Expense', id: 'LIST' }],
    }),

    getExpenseById: builder.query<ExpenseWithCategory, string>({
      queryFn: async (id) => {
        try {
          const { data, error } = await supabase
            .from('expenses')
            .select(`
              id,
              user_id,
              category_id,
              account_id,
              to_account_id,
              contact_id,
              debt_type,
              due_date,
              transfer_group_id,
              title,
              amount,
              type,
              entry_type,
              currency,
              date,
              notes,
              created_at,
              updated_at,
              categories (
                id,
                user_id,
                name,
                icon,
                color,
                type,
                is_default,
                created_at
              ),
              accounts:account_id (
                id,
                name,
                type,
                color
              ),
              to_accounts:to_account_id (
                id,
                name,
                type,
                color
              ),
              contacts:contact_id (
                id,
                name,
                phone,
                email,
                whatsapp
              )
            `)
            .eq('id', id)
            .single();

          if (error) {
            const fallbackRes = await supabase
              .from('expenses')
              .select('*, categories (*)')
              .eq('id', id)
              .single();
            if (!fallbackRes.error && fallbackRes.data) {
              return { data: fallbackRes.data as unknown as ExpenseWithCategory };
            }
            return { error: { message: error.message } };
          }
          return { data: data as unknown as ExpenseWithCategory };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch expense';
          return { error: { message } };
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'Expense', id }],
    }),

    addExpense: builder.mutation<Expense, AddExpenseInput>({
      queryFn: async (newExpense) => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            return { error: { message: 'User not authenticated' } };
          }

          const inferredType = newExpense.type || (newExpense.amount < 0 ? 'expense' : 'income');
          const cleanAmount = Math.abs(Number(newExpense.amount));

          const { data, error } = await supabase
            .from('expenses')
            .insert({
              ...newExpense,
              user_id: user.id,
              amount: cleanAmount,
              type: inferredType,
            } as Database['public']['Tables']['expenses']['Insert'])
            .select('*')
            .single();

          if (error) {
            return { error: { message: error.message } };
          }
          return { data: data as Expense };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to add expense';
          return { error: { message } };
        }
      },
      invalidatesTags: [{ type: 'Expense', id: 'LIST' }, 'Stats', 'Budget', 'Account', 'Cashbook'],
    }),

    updateExpense: builder.mutation<Expense, UpdateExpenseInput>({
      queryFn: async ({ id, ...updates }) => {
        try {
          const { data, error } = await supabase
            .from('expenses')
            .update({
              ...updates,
              updated_at: new Date().toISOString(),
            } as Database['public']['Tables']['expenses']['Update'])
            .eq('id', id)
            .select('*')
            .single();

          if (error) {
            return { error: { message: error.message } };
          }
          return { data: data as Expense };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to update expense';
          return { error: { message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Expense', id },
        { type: 'Expense', id: 'LIST' },
        'Stats',
        'Budget',
        'Account',
        'Cashbook',
      ],
    }),

    deleteExpense: builder.mutation<{ success: boolean; id: string }, string>({
      queryFn: async (id) => {
        try {
          const { data: item } = await supabase
            .from('expenses')
            .select('id, transfer_group_id, account_id, to_account_id')
            .eq('id', id)
            .single();

          if (item?.transfer_group_id) {
            // Delete both legs of the transfer atomically to keep double-entry ledger balanced
            const { error } = await supabase
              .from('expenses')
              .delete()
              .eq('transfer_group_id', item.transfer_group_id);

            if (error) {
              return { error: { message: error.message } };
            }

            if (item.account_id) {
              await supabase.rpc('recalculate_account_balance', {
                target_account_id: item.account_id,
              });
            }
            if (item.to_account_id) {
              await supabase.rpc('recalculate_account_balance', {
                target_account_id: item.to_account_id,
              });
            }

            return { data: { success: true, id } };
          }

          const { error } = await supabase.from('expenses').delete().eq('id', id);
          if (error) {
            return { error: { message: error.message } };
          }
          return { data: { success: true, id } };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to delete expense';
          return { error: { message } };
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Expense', id },
        { type: 'Expense', id: 'LIST' },
        'Stats',
        'Budget',
        'Account',
        'Cashbook',
      ],
    }),

    getExpenseStats: builder.query<
      ExpenseStats,
      { startDate?: string; endDate?: string } | void
    >({
      queryFn: async (params) => {
        try {
          const buildStatsQuery = () => {
            let query = supabase
              .from('expenses')
              .select(`
                id,
                amount,
                type,
                entry_type,
                category_id,
                transfer_group_id,
                title,
                date,
                categories (
                  id,
                  name,
                  color,
                  type
                )
              `)
              .order('id');

            if (params?.startDate) {
              query = query.gte('date', params.startDate);
            }
            if (params?.endDate) {
              query = query.lte('date', params.endDate);
            }

            return query;
          };

          const { data, error } = await fetchAllPages((from, to) =>
            buildStatsQuery().range(from, to)
          );
          if (error) {
            return { error: { message: error } };
          }

          const records = (data ?? []) as unknown as {
            id: string;
            amount: number;
            type?: 'expense' | 'income' | 'transfer';
            entry_type?: 'debit' | 'credit' | 'transfer_out' | 'transfer_in' | 'adjustment';
            category_id: string | null;
            transfer_group_id?: string | null;
            title?: string | null;
            date: string;
            categories: { id?: string; name?: string; color?: string; type?: string } | null;
          }[];

          let totalSpent = 0;
          let totalIncome = 0;
          let transactionCount = 0;
          const expenseCategoryMap = new Map<
            string,
            { name: string; color: string; total: number }
          >();
          const incomeCategoryMap = new Map<
            string,
            { name: string; color: string; total: number }
          >();

          for (const item of records) {
            // Transfers between user accounts are internal fund movements, NOT income or spending.
            // Excluding them prevents the transferred amount from being deducted from net savings!
            const isTransfer =
              item.type === 'transfer' ||
              item.entry_type === 'transfer_out' ||
              item.entry_type === 'transfer_in' ||
              Boolean(item.transfer_group_id) ||
              item.title?.toLowerCase().startsWith('transfer to') ||
              item.title?.toLowerCase().startsWith('transfer from');

            // Balance reconciliation adjustments change an account balance but are
            // not real income or expenses, so they must not distort savings stats.
            const isAdjustment = item.entry_type === 'adjustment';

            if (isTransfer || isAdjustment) {
              continue;
            }

            transactionCount += 1;

            const rawAmount = Number(item.amount);
            const isIncome =
              item.type === 'income' ||
              item.entry_type === 'credit' ||
              (!item.type && rawAmount > 0);
            const absAmount = Math.abs(rawAmount);

            if (isIncome) {
              totalIncome += absAmount;
              const catId = item.category_id ?? 'uncategorized_income';
              const catDetails = item.categories;
              const existing = incomeCategoryMap.get(catId);
              if (existing) {
                existing.total += absAmount;
              } else {
                incomeCategoryMap.set(catId, {
                  name: catDetails?.name ?? 'Other Income',
                  color: catDetails?.color ?? '#10b981',
                  total: absAmount,
                });
              }
            } else {
              totalSpent += absAmount;
              const catId = item.category_id ?? 'uncategorized_expense';
              const catDetails = item.categories;
              const existing = expenseCategoryMap.get(catId);
              if (existing) {
                existing.total += absAmount;
              } else {
                expenseCategoryMap.set(catId, {
                  name: catDetails?.name ?? 'General Expense',
                  color: catDetails?.color ?? '#64748b',
                  total: absAmount,
                });
              }
            }
          }

          const categoryBreakdown = Array.from(expenseCategoryMap.entries()).map(
            ([catId, cat]) => ({
              categoryId: catId.startsWith('uncategorized') ? null : catId,
              categoryName: cat.name,
              categoryColor: cat.color,
              total: cat.total,
              percentage: totalSpent > 0 ? (cat.total / totalSpent) * 100 : 0,
            })
          );

          const incomeBreakdown = Array.from(incomeCategoryMap.entries()).map(
            ([catId, cat]) => ({
              categoryId: catId.startsWith('uncategorized') ? null : catId,
              categoryName: cat.name,
              categoryColor: cat.color,
              total: cat.total,
              percentage: totalIncome > 0 ? (cat.total / totalIncome) * 100 : 0,
            })
          );

          const netSavings = totalIncome - totalSpent;
          const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

          return {
            data: {
              totalSpent,
              totalIncome,
              netSavings,
              savingsRate,
              transactionCount,
              categoryBreakdown,
              incomeBreakdown,
            },
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to calculate stats';
          return { error: { message } };
        }
      },
      providesTags: ['Stats'],
    }),

    getAccountingSummary: builder.query<
      AccountingSummary,
      { startDate?: string; endDate?: string } | void
    >({
      queryFn: async (params) => {
        try {
          // Prefer the database-side aggregate; unlike a table select it is not
          // truncated by the API's default 1000-row response cap.
          const rpcRes = await supabase.rpc('get_accounting_summary' as any, {
            start_date: params?.startDate ?? null,
            end_date: params?.endDate ?? null,
          });
          const rpcData = rpcRes.data as AccountingSummary | null;
          if (
            !rpcRes.error &&
            rpcData &&
            rpcData.total_credits !== undefined &&
            rpcData.total_credits !== null
          ) {
            return { data: rpcData };
          }

          // Fallback: calculate client-side, paging through every row.
          const buildSummaryQuery = () => {
            let query = supabase
              .from('expenses')
              .select('amount, type, entry_type, title, date')
              .order('id');

            if (params?.startDate) {
              query = query.gte('date', params.startDate);
            }
            if (params?.endDate) {
              query = query.lte('date', params.endDate);
            }

            return query;
          };

          const { data, error } = await fetchAllPages((from, to) =>
            buildSummaryQuery().range(from, to)
          );
          if (error) return { error: { message: error } };

          const records = data || [];
          let totalDebits = 0;
          let totalCredits = 0;

          for (const row of records) {
            const amt = Math.abs(Number(row.amount) || 0);
            const entryType = row.entry_type;
            const type = row.type;
            const title = (row as any).title?.toLowerCase() || '';

            const isTransferIn = entryType === 'transfer_in' || title.startsWith('transfer from');
            const isTransferOut = entryType === 'transfer_out' || title.startsWith('transfer to');

            // Credits include: income credits and incoming transfer credits
            // Debits include: expense debits and outgoing transfer debits
            if (entryType === 'credit' || isTransferIn || (!isTransferOut && type === 'income')) {
              totalCredits += amt;
            } else if (entryType === 'debit' || isTransferOut || (!isTransferIn && type === 'expense')) {
              totalDebits += amt;
            } else if (entryType === 'adjustment') {
              const rawAmt = Number(row.amount) || 0;
              if (rawAmt >= 0) totalCredits += rawAmt;
              else totalDebits += Math.abs(rawAmt);
            }
          }

          const netBalance = totalCredits - totalDebits;
          return {
            data: {
              total_debits: totalDebits,
              total_credits: totalCredits,
              net_balance: netBalance,
              transaction_count: records.length,
              status: netBalance >= 0 ? 'surplus' : 'deficit',
            },
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch accounting summary';
          return { error: { message } };
        }
      },
      providesTags: ['Stats', 'Expense'],
    }),
  }),
});

export const {
  useGetExpensesQuery,
  useGetExpenseByIdQuery,
  useAddExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useGetExpenseStatsQuery,
  useGetAccountingSummaryQuery,
} = expensesApi;
