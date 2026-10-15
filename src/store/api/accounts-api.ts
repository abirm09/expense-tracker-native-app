import { supabase } from '@/lib/supabase';
import { apiSlice } from './api-slice';
import { Account, AdjustmentRequest, Database, ExpenseWithCategory, TransferRequest } from '@/types/database.types';

export interface CreateAccountDto {
  name: string;
  type: 'cash' | 'bank' | 'mobile_wallet' | 'other';
  account_number?: string | null;
  opening_balance?: number;
  is_default?: boolean;
  notes?: string | null;
  color?: string | null;
}

export interface UpdateAccountDto {
  id: string;
  name?: string;
  type?: 'cash' | 'bank' | 'mobile_wallet' | 'other';
  account_number?: string | null;
  opening_balance?: number;
  is_default?: boolean;
  notes?: string | null;
  color?: string | null;
}

export interface GetCashbookParams {
  account_id?: string | null;
  entry_type?: 'debit' | 'credit' | 'transfer_out' | 'transfer_in' | 'adjustment' | 'all' | null;
  search?: string;
  limit?: number;
}

export const accountsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAccounts: builder.query<Account[], void>({
      queryFn: async () => {
        try {
          const { data, error } = await supabase
            .from('accounts')
            .select('*')
            .order('is_default', { ascending: false })
            .order('name', { ascending: true });

          if (error) {
            return { error: { status: 'CUSTOM_ERROR', error: error.message } };
          }

          return { data: (data as Account[]) || [] };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch accounts';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Account' as const, id })),
              { type: 'Account', id: 'LIST' },
            ]
          : [{ type: 'Account', id: 'LIST' }],
    }),

    getAccount: builder.query<Account, string>({
      queryFn: async (id) => {
        try {
          const { data, error } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', id)
            .single();

          if (error) {
            return { error: { status: 'CUSTOM_ERROR', error: error.message } };
          }

          return { data: data as Account };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch account';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'Account', id }],
    }),

    createAccount: builder.mutation<Account, CreateAccountDto>({
      queryFn: async (accountData) => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            return { error: { status: 'CUSTOM_ERROR', error: 'User not authenticated' } };
          }

          // If set as default, unset other accounts first
          if (accountData.is_default) {
            await supabase
              .from('accounts')
              .update({ is_default: false })
              .eq('user_id', user.id);
          }

          const { data, error } = await supabase
            .from('accounts')
            .insert({
              user_id: user.id,
              name: accountData.name.trim(),
              type: accountData.type,
              account_number: accountData.account_number?.trim() || null,
              opening_balance: accountData.opening_balance ?? 0.0,
              current_balance: accountData.opening_balance ?? 0.0,
              is_default: !!accountData.is_default,
              notes: accountData.notes?.trim() || null,
              color: accountData.color || '#10b981',
            })
            .select()
            .single();

          if (error) {
            return { error: { status: 'CUSTOM_ERROR', error: error.message } };
          }

          return { data: data as Account };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to create account';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      invalidatesTags: [{ type: 'Account', id: 'LIST' }, 'Stats'],
    }),

    updateAccount: builder.mutation<Account, UpdateAccountDto>({
      queryFn: async ({ id, ...accountData }) => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            return { error: { status: 'CUSTOM_ERROR', error: 'User not authenticated' } };
          }

          if (accountData.is_default) {
            await supabase
              .from('accounts')
              .update({ is_default: false })
              .eq('user_id', user.id);
          }

          const updatePayload: Database['public']['Tables']['accounts']['Update'] = {
            updated_at: new Date().toISOString(),
          };

          if (accountData.name !== undefined) updatePayload.name = accountData.name.trim();
          if (accountData.type !== undefined) updatePayload.type = accountData.type;
          if (accountData.account_number !== undefined)
            updatePayload.account_number = accountData.account_number?.trim() || null;
          if (accountData.opening_balance !== undefined)
            updatePayload.opening_balance = accountData.opening_balance;
          if (accountData.is_default !== undefined)
            updatePayload.is_default = accountData.is_default;
          if (accountData.notes !== undefined)
            updatePayload.notes = accountData.notes?.trim() || null;
          if (accountData.color !== undefined) updatePayload.color = accountData.color;

          const { data, error } = await supabase
            .from('accounts')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

          if (error) {
            return { error: { status: 'CUSTOM_ERROR', error: error.message } };
          }

          // Trigger server recalculation of balance if opening_balance changed
          if (accountData.opening_balance !== undefined) {
            await supabase.rpc('recalculate_account_balance', { target_account_id: id });
          }

          return { data: data as Account };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to update account';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Account', id },
        { type: 'Account', id: 'LIST' },
        'Stats',
      ],
    }),

    deleteAccount: builder.mutation<{ success: boolean; id: string }, string>({
      queryFn: async (id) => {
        try {
          const { error } = await supabase.from('accounts').delete().eq('id', id);

          if (error) {
            return { error: { status: 'CUSTOM_ERROR', error: error.message } };
          }

          return { data: { success: true, id } };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to delete account';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      invalidatesTags: [{ type: 'Account', id: 'LIST' }, 'Expense', 'Stats', 'Cashbook'],
    }),

    transferBetweenAccounts: builder.mutation<
      { success: boolean; transfer_group_id: string },
      TransferRequest
    >({
      queryFn: async ({ from_account_id, to_account_id, amount, notes, transfer_date }) => {
        try {
          const absAmount = Math.abs(amount);
          const tDate = transfer_date || new Date().toISOString().split('T')[0];
          const cleanNotes = notes?.trim() || null;

          // Try RPC first
          const { data, error } = await supabase.rpc('transfer_between_accounts', {
            from_account_id,
            to_account_id,
            amount: absAmount,
            notes: cleanNotes,
            transfer_date: tDate,
          });

          if (!error && data) {
            return { data: data as { success: boolean; transfer_group_id: string } };
          }

          // Resilient Fallback: perform direct double-entry inserts if RPC is unavailable
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                error: error?.message || 'User not authenticated',
              },
            };
          }

          // Fetch account names for descriptive titles
          const [fromAccRes, toAccRes] = await Promise.all([
            supabase.from('accounts').select('name').eq('id', from_account_id).single(),
            supabase.from('accounts').select('name').eq('id', to_account_id).single(),
          ]);

          const fromName = fromAccRes.data?.name || 'Account';
          const toName = toAccRes.data?.name || 'Account';
          const groupId =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                  const r = (Math.random() * 16) | 0;
                  const v = c === 'x' ? r : (r & 0x3) | 0x8;
                  return v.toString(16);
                });

          // 1. Insert Transfer Out (Outflow Debit from Source Account)
          const { error: outErr } = await supabase.from('expenses').insert({
            user_id: user.id,
            account_id: from_account_id,
            to_account_id: to_account_id,
            transfer_group_id: groupId,
            title: `Transfer to ${toName}`,
            amount: absAmount,
            type: 'transfer',
            entry_type: 'transfer_out',
            date: tDate,
            notes: cleanNotes,
            currency: 'BDT',
          });

          if (outErr) {
            return { error: { status: 'CUSTOM_ERROR', error: outErr.message } };
          }

          // 2. Insert Transfer In (Inflow Credit to Destination Account)
          const { error: inErr } = await supabase.from('expenses').insert({
            user_id: user.id,
            account_id: to_account_id,
            to_account_id: from_account_id,
            transfer_group_id: groupId,
            title: `Transfer from ${fromName}`,
            amount: absAmount,
            type: 'transfer',
            entry_type: 'transfer_in',
            date: tDate,
            notes: cleanNotes,
            currency: 'BDT',
          });

          if (inErr) {
            return { error: { status: 'CUSTOM_ERROR', error: inErr.message } };
          }

          // Trigger server recalculation of both accounts
          await Promise.allSettled([
            supabase.rpc('recalculate_account_balance', { target_account_id: from_account_id }),
            supabase.rpc('recalculate_account_balance', { target_account_id: to_account_id }),
          ]);

          return { data: { success: true, transfer_group_id: groupId } };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Transfer failed';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      invalidatesTags: [
        { type: 'Account', id: 'LIST' },
        { type: 'Expense', id: 'LIST' },
        'Stats',
        'Cashbook',
      ],
    }),

    adjustAccountBalance: builder.mutation<
      { success: boolean; id: string },
      AdjustmentRequest
    >({
      queryFn: async ({ account_id, amount, direction, title, notes, adjustment_date }) => {
        try {
          const { data, error } = await supabase.rpc('adjust_account_balance', {
            target_account_id: account_id,
            amount: Math.abs(amount),
            direction,
            title: title?.trim() || 'Balance Adjustment',
            notes: notes?.trim() || null,
            adjustment_date: adjustment_date || new Date().toISOString().split('T')[0],
          });

          if (error) {
            return { error: { status: 'CUSTOM_ERROR', error: error.message } };
          }

          return { data: data as { success: boolean; id: string } };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Adjustment failed';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      invalidatesTags: [
        { type: 'Account', id: 'LIST' },
        { type: 'Expense', id: 'LIST' },
        'Stats',
        'Cashbook',
      ],
    }),

    getCashbookEntries: builder.query<ExpenseWithCategory[], GetCashbookParams | void>({
      queryFn: async (params) => {
        try {
          let query = supabase
            .from('expenses')
            .select(`
              *,
              categories (*),
              accounts:account_id (*),
              to_accounts:to_account_id (*)
            `)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });

          if (params?.account_id && params.account_id !== 'all') {
            query = query.eq('account_id', params.account_id);
          }

          if (params?.entry_type && params.entry_type !== 'all') {
            if (params.entry_type === 'credit') {
              // Include income credits and transfer-in credits
              query = query.in('entry_type', ['credit', 'transfer_in']);
            } else if (params.entry_type === 'debit') {
              // Include expense debits and transfer-out debits
              query = query.in('entry_type', ['debit', 'transfer_out']);
            } else {
              query = query.eq('entry_type', params.entry_type);
            }
          }

          if (params?.search) {
            query = query.ilike('title', `%${params.search}%`);
          }

          if (params?.limit) {
            query = query.limit(params.limit);
          }

          const { data, error } = await query;

          if (error) {
            // Resilient fallback: If embedded relationships fail due to schema cache, fetch basic expenses with categories
            let fallbackQuery = supabase
              .from('expenses')
              .select('*, categories (*)')
              .order('date', { ascending: false })
              .order('created_at', { ascending: false });

            if (params?.account_id && params.account_id !== 'all') {
              fallbackQuery = fallbackQuery.eq('account_id', params.account_id);
            }
            if (params?.search) {
              fallbackQuery = fallbackQuery.ilike('title', `%${params.search}%`);
            }
            if (params?.limit) {
              fallbackQuery = fallbackQuery.limit(params.limit);
            }

            const fallbackRes = await fallbackQuery;
            if (!fallbackRes.error && fallbackRes.data) {
              return { data: (fallbackRes.data as unknown as ExpenseWithCategory[]) || [] };
            }

            return { error: { status: 'CUSTOM_ERROR', error: error.message } };
          }

          return { data: (data as unknown as ExpenseWithCategory[]) || [] };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch cashbook entries';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      providesTags: [{ type: 'Cashbook', id: 'LIST' }, { type: 'Expense', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetAccountsQuery,
  useGetAccountQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
  useTransferBetweenAccountsMutation,
  useAdjustAccountBalanceMutation,
  useGetCashbookEntriesQuery,
} = accountsApi;
