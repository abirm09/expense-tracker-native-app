import { supabase } from '@/lib/supabase';
import { fetchAllPages } from '@/lib/fetch-all';
import { getLocalDateString } from '@/lib/date-utils';
import { apiSlice } from './api-slice';
import {
  Contact,
  ContactWithLedger,
  Database,
  DebtSummary,
  DebtType,
  ExpenseWithCategory,
  RecordDebtRequest,
} from '@/types/database.types';

export interface CreateContactDto {
  name?: string | null;
  phone: string;
  email?: string | null;
  whatsapp?: string | null;
  notes?: string | null;
}

export interface UpdateContactDto {
  id: string;
  name?: string | null;
  phone?: string;
  email?: string | null;
  whatsapp?: string | null;
  notes?: string | null;
}

export interface GetDebtTransactionsParams {
  contact_id?: string | null;
  debt_type?: DebtType | 'all' | null;
  limit?: number;
}

export const debtsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getContacts: builder.query<ContactWithLedger[], void>({
      queryFn: async () => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            return { error: { status: 'CUSTOM_ERROR', error: 'User not authenticated' } };
          }

          // 1. Fetch contacts
          const { data: contactsData, error: contactsError } = await supabase
            .from('contacts')
            .select('*')
            .order('name', { ascending: true, nullsFirst: false });

          if (contactsError) {
            return { error: { status: 'CUSTOM_ERROR', error: contactsError.message } };
          }

          const contacts = (contactsData as Contact[]) || [];

          // 2. Fetch all debt transactions to compute running balances per contact
          const buildDebtExpensesQuery = () =>
            supabase
              .from('expenses')
              .select('id, contact_id, debt_type, amount, date')
              .not('contact_id', 'is', null)
              .not('debt_type', 'is', null)
              .eq('user_id', user.id)
              .order('id');

          const { data: debtExpenses, error: expensesError } = await fetchAllPages(
            (from, to) => buildDebtExpensesQuery().range(from, to)
          );

          if (expensesError) {
            // Even if debt transactions query fails, return contacts with zero balances
            const emptyLedgerContacts: ContactWithLedger[] = contacts.map((c) => ({
              ...c,
              total_receivable: 0,
              total_receivable_collected: 0,
              outstanding_receivable: 0,
              total_payable: 0,
              total_payable_paid: 0,
              outstanding_payable: 0,
              net_balance: 0,
              transaction_count: 0,
              last_transaction_date: null,
            }));
            return { data: emptyLedgerContacts };
          }

          // Aggregate by contact_id
          const contactStatsMap: Record<
            string,
            {
              total_receivable: number;
              total_receivable_collected: number;
              total_payable: number;
              total_payable_paid: number;
              count: number;
              latest_date: string | null;
            }
          > = {};

          (debtExpenses || []).forEach((item) => {
            const cId = item.contact_id;
            if (!cId) return;

            if (!contactStatsMap[cId]) {
              contactStatsMap[cId] = {
                total_receivable: 0,
                total_receivable_collected: 0,
                total_payable: 0,
                total_payable_paid: 0,
                count: 0,
                latest_date: null,
              };
            }

            const current = contactStatsMap[cId];
            const amt = Math.abs(Number(item.amount) || 0);
            current.count += 1;

            if (item.date) {
              if (!current.latest_date || item.date > current.latest_date) {
                current.latest_date = item.date;
              }
            }

            if (item.debt_type === 'receivable') {
              current.total_receivable += amt;
            } else if (item.debt_type === 'receivable_payment') {
              current.total_receivable_collected += amt;
            } else if (item.debt_type === 'payable') {
              current.total_payable += amt;
            } else if (item.debt_type === 'payable_payment') {
              current.total_payable_paid += amt;
            }
          });

          const contactsWithLedger: ContactWithLedger[] = contacts.map((contact) => {
            const stats = contactStatsMap[contact.id] || {
              total_receivable: 0,
              total_receivable_collected: 0,
              total_payable: 0,
              total_payable_paid: 0,
              count: 0,
              latest_date: null,
            };

            // Outstanding balances are intentionally signed: a negative value
            // means the contact overpaid (a credit in the user's favour).
            const outstanding_receivable = stats.total_receivable - stats.total_receivable_collected;
            const outstanding_payable = stats.total_payable - stats.total_payable_paid;
            // net_balance: > 0 means contact owes current user, < 0 means current user owes contact
            const net_balance = outstanding_receivable - outstanding_payable;

            return {
              ...contact,
              total_receivable: stats.total_receivable,
              total_receivable_collected: stats.total_receivable_collected,
              outstanding_receivable,
              total_payable: stats.total_payable,
              total_payable_paid: stats.total_payable_paid,
              outstanding_payable,
              net_balance,
              last_transaction_date: stats.latest_date,
              transaction_count: stats.count,
            };
          });

          // Sort: active non-zero balances first, then alphabetically
          contactsWithLedger.sort((a, b) => {
            const aHasBalance = Math.abs(a.net_balance) > 0.01 ? 1 : 0;
            const bHasBalance = Math.abs(b.net_balance) > 0.01 ? 1 : 0;
            if (aHasBalance !== bHasBalance) return bHasBalance - aHasBalance;

            const nameA = a.name?.trim() || a.phone;
            const nameB = b.name?.trim() || b.phone;
            return nameA.localeCompare(nameB);
          });

          return { data: contactsWithLedger };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch contacts';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Contact' as const, id })),
              { type: 'Contact', id: 'LIST' },
            ]
          : [{ type: 'Contact', id: 'LIST' }],
    }),

    getContact: builder.query<ContactWithLedger, string>({
      queryFn: async (id) => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            return { error: { status: 'CUSTOM_ERROR', error: 'User not authenticated' } };
          }

          const { data: contact, error: contactErr } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', id)
            .single();

          if (contactErr) {
            return { error: { status: 'CUSTOM_ERROR', error: contactErr.message } };
          }

          // Fetch all debt transactions for this specific contact
          const { data: debtExpenses } = await fetchAllPages((from, to) =>
            supabase
              .from('expenses')
              .select('id, debt_type, amount, date')
              .eq('contact_id', id)
              .eq('user_id', user.id)
              .order('id')
              .range(from, to)
          );

          let total_receivable = 0;
          let total_receivable_collected = 0;
          let total_payable = 0;
          let total_payable_paid = 0;
          let latest_date: string | null = null;
          const count = (debtExpenses || []).length;

          (debtExpenses || []).forEach((item) => {
            const amt = Math.abs(Number(item.amount) || 0);
            if (item.date && (!latest_date || item.date > latest_date)) {
              latest_date = item.date;
            }

            if (item.debt_type === 'receivable') {
              total_receivable += amt;
            } else if (item.debt_type === 'receivable_payment') {
              total_receivable_collected += amt;
            } else if (item.debt_type === 'payable') {
              total_payable += amt;
            } else if (item.debt_type === 'payable_payment') {
              total_payable_paid += amt;
            }
          });

          const outstanding_receivable = total_receivable - total_receivable_collected;
          const outstanding_payable = total_payable - total_payable_paid;
          const net_balance = outstanding_receivable - outstanding_payable;

          const contactWithLedger: ContactWithLedger = {
            ...(contact as Contact),
            total_receivable,
            total_receivable_collected,
            outstanding_receivable,
            total_payable,
            total_payable_paid,
            outstanding_payable,
            net_balance,
            last_transaction_date: latest_date,
            transaction_count: count,
          };

          return { data: contactWithLedger };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch contact';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'Contact', id }],
    }),

    createContact: builder.mutation<Contact, CreateContactDto>({
      queryFn: async (contactData) => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            return { error: { status: 'CUSTOM_ERROR', error: 'User not authenticated' } };
          }

          const cleanPhone = contactData.phone.trim();
          if (!cleanPhone) {
            return { error: { status: 'CUSTOM_ERROR', error: 'Phone number is required' } };
          }

          const { data, error } = await supabase
            .from('contacts')
            .insert({
              user_id: user.id,
              name: contactData.name?.trim() || null,
              phone: cleanPhone,
              email: contactData.email?.trim() || null,
              whatsapp: contactData.whatsapp?.trim() || null,
              notes: contactData.notes?.trim() || null,
            })
            .select()
            .single();

          if (error) {
            return { error: { status: 'CUSTOM_ERROR', error: error.message } };
          }

          return { data: data as Contact };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to create contact';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      invalidatesTags: [{ type: 'Contact', id: 'LIST' }, 'Debt'],
    }),

    updateContact: builder.mutation<Contact, UpdateContactDto>({
      queryFn: async ({ id, ...contactData }) => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            return { error: { status: 'CUSTOM_ERROR', error: 'User not authenticated' } };
          }

          const updatePayload: Database['public']['Tables']['contacts']['Update'] = {
            updated_at: new Date().toISOString(),
          };

          if (contactData.name !== undefined)
            updatePayload.name = contactData.name?.trim() || null;
          if (contactData.phone !== undefined) {
            const cleanPhone = contactData.phone.trim();
            if (!cleanPhone) {
              return { error: { status: 'CUSTOM_ERROR', error: 'Phone number is required' } };
            }
            updatePayload.phone = cleanPhone;
          }
          if (contactData.email !== undefined)
            updatePayload.email = contactData.email?.trim() || null;
          if (contactData.whatsapp !== undefined)
            updatePayload.whatsapp = contactData.whatsapp?.trim() || null;
          if (contactData.notes !== undefined)
            updatePayload.notes = contactData.notes?.trim() || null;

          const { data, error } = await supabase
            .from('contacts')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

          if (error) {
            return { error: { status: 'CUSTOM_ERROR', error: error.message } };
          }

          return { data: data as Contact };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to update contact';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Contact', id },
        { type: 'Contact', id: 'LIST' },
        'Debt',
      ],
    }),

    deleteContact: builder.mutation<{ success: boolean; id: string }, string>({
      queryFn: async (id) => {
        try {
          // Find accounts involved in this contact's transactions to trigger balance recalculation
          const { data: relatedExpenses } = await supabase
            .from('expenses')
            .select('account_id')
            .eq('contact_id', id);

          const affectedAccountIds = Array.from(
            new Set((relatedExpenses || []).map((e) => e.account_id).filter(Boolean))
          ) as string[];

          const { error } = await supabase.from('contacts').delete().eq('id', id);

          if (error) {
            return { error: { status: 'CUSTOM_ERROR', error: error.message } };
          }

          // Recalculate affected accounts if any
          for (const accId of affectedAccountIds) {
            await supabase.rpc('recalculate_account_balance', { target_account_id: accId });
          }

          return { data: { success: true, id } };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to delete contact';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      invalidatesTags: [
        { type: 'Contact', id: 'LIST' },
        'Debt',
        'Account',
        'Expense',
        'Cashbook',
        'Stats',
      ],
    }),

    getDebtTransactions: builder.query<ExpenseWithCategory[], GetDebtTransactionsParams | void>({
      queryFn: async (params) => {
        try {
          const buildDebtTxQuery = () => {
            let query = supabase
              .from('expenses')
              .select(
                `
              *,
              categories (*),
              accounts:account_id (*),
              contacts:contact_id (*)
            `
              )
              .not('debt_type', 'is', null)
              .order('date', { ascending: false })
              .order('created_at', { ascending: false })
              .order('id');

            if (params?.contact_id) {
              query = query.eq('contact_id', params.contact_id);
            }

            if (params?.debt_type && params.debt_type !== 'all') {
              query = query.eq('debt_type', params.debt_type);
            }

            return query;
          };

          let data: unknown[] | null = null;
          let error: { message: string } | null = null;

          if (params?.limit) {
            const res = await buildDebtTxQuery().limit(params.limit);
            data = res.data;
            error = res.error;
          } else {
            const res = await fetchAllPages((from, to) =>
              buildDebtTxQuery().range(from, to)
            );
            data = res.data;
            error = res.error ? { message: res.error } : null;
          }

          if (error) {
            // Resilient fallback: Query basic expenses without embedded foreign tables if schema cache hasn't refreshed
            let fallbackQuery = supabase
              .from('expenses')
              .select('*')
              .not('debt_type', 'is', null)
              .order('date', { ascending: false })
              .order('created_at', { ascending: false })
              .order('id');

            if (params?.contact_id) {
              fallbackQuery = fallbackQuery.eq('contact_id', params.contact_id);
            }
            if (params?.debt_type && params.debt_type !== 'all') {
              fallbackQuery = fallbackQuery.eq('debt_type', params.debt_type);
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
          const message =
            err instanceof Error ? err.message : 'Failed to fetch debt transactions';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      providesTags: [{ type: 'Debt', id: 'LIST' }],
    }),

    recordDebtTransaction: builder.mutation<
      { success: boolean; id: string },
      RecordDebtRequest
    >({
      queryFn: async ({
        contact_id,
        account_id,
        amount,
        debt_type,
        title,
        notes,
        date,
        due_date,
      }) => {
        try {
          const absAmount = Math.abs(Number(amount));
          const tDate = date || getLocalDateString();
          const cleanTitle = title?.trim() || null;
          const cleanNotes = notes?.trim() || null;
          const dueDate = due_date || null;

          if (!absAmount || absAmount <= 0) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                error: 'Amount must be greater than zero',
              },
            };
          }

          // 1. Try atomic database RPC function first
          const { data: rpcData, error: rpcError } = await supabase.rpc(
            'record_debt_transaction',
            {
              p_contact_id: contact_id,
              p_account_id: account_id,
              p_amount: absAmount,
              p_debt_type: debt_type,
              p_title: cleanTitle,
              p_notes: cleanNotes,
              p_date: tDate,
              p_due_date: dueDate,
            }
          );

          if (!rpcError && rpcData && rpcData.success) {
            return { data: rpcData as { success: boolean; id: string } };
          }

          // 2. Resilient Direct Fallback: Insert into expenses and sync account balance directly
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            return {
              error: { status: 'CUSTOM_ERROR', error: 'User not authenticated' },
            };
          }

          // Fetch contact for descriptive title if not provided
          let defaultTitle = 'Debt Transaction';
          const { data: contact } = await supabase
            .from('contacts')
            .select('name, phone')
            .eq('id', contact_id)
            .single();

          const contactIdentifier = contact?.name || contact?.phone || 'Contact';

          // Assign entry_type and accounting direction:
          // - receivable (I lend): debit (money out of account)
          // - payable (I borrow): credit (money into account)
          // - receivable_payment (they repay me): credit (money into account)
          // - payable_payment (I repay them): debit (money out of account)
          let entry_type: 'debit' | 'credit' = 'debit';
          let transaction_type: 'expense' | 'income' = 'expense';

          if (debt_type === 'receivable') {
            entry_type = 'debit';
            transaction_type = 'expense';
            defaultTitle = `Lent to ${contactIdentifier}`;
          } else if (debt_type === 'payable') {
            entry_type = 'credit';
            transaction_type = 'income';
            defaultTitle = `Borrowed from ${contactIdentifier}`;
          } else if (debt_type === 'receivable_payment') {
            entry_type = 'credit';
            transaction_type = 'income';
            defaultTitle = `Repayment from ${contactIdentifier}`;
          } else if (debt_type === 'payable_payment') {
            entry_type = 'debit';
            transaction_type = 'expense';
            defaultTitle = `Repayment to ${contactIdentifier}`;
          }

          const { data: insertedExpense, error: insertErr } = await supabase
            .from('expenses')
            .insert({
              user_id: user.id,
              contact_id,
              account_id,
              title: cleanTitle || defaultTitle,
              amount: absAmount,
              type: transaction_type,
              entry_type,
              debt_type,
              date: tDate,
              due_date: dueDate,
              notes: cleanNotes,
              currency: 'BDT',
            })
            .select('id')
            .single();

          if (insertErr) {
            return { error: { status: 'CUSTOM_ERROR', error: insertErr.message } };
          }

          // Recalculate account balance
          await supabase.rpc('recalculate_account_balance', {
            target_account_id: account_id,
          });

          return { data: { success: true, id: insertedExpense.id } };
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Failed to record debt transaction';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      invalidatesTags: [
        'Debt',
        { type: 'Contact', id: 'LIST' },
        { type: 'Account', id: 'LIST' },
        { type: 'Expense', id: 'LIST' },
        'Stats',
        'Cashbook',
      ],
    }),

    deleteDebtTransaction: builder.mutation<{ success: boolean; id: string }, string>({
      queryFn: async (id) => {
        try {
          // Fetch account_id first to recalculate balance after delete
          const { data: exp } = await supabase
            .from('expenses')
            .select('account_id')
            .eq('id', id)
            .single();

          const { error } = await supabase.from('expenses').delete().eq('id', id);

          if (error) {
            return { error: { status: 'CUSTOM_ERROR', error: error.message } };
          }

          if (exp?.account_id) {
            await supabase.rpc('recalculate_account_balance', {
              target_account_id: exp.account_id,
            });
          }

          return { data: { success: true, id } };
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Failed to delete transaction';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      invalidatesTags: [
        'Debt',
        { type: 'Contact', id: 'LIST' },
        { type: 'Account', id: 'LIST' },
        { type: 'Expense', id: 'LIST' },
        'Stats',
        'Cashbook',
      ],
    }),

    getDebtSummary: builder.query<DebtSummary, void>({
      queryFn: async () => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            return {
              data: {
                total_receivable: 0,
                total_payable: 0,
                net_balance: 0,
                contact_count: 0,
                active_debt_count: 0,
              },
            };
          }

          // Fetch all contacts count for the current user
          const { count: contactCount } = await supabase
            .from('contacts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id);

          // Fetch all debt transactions
          const { data: debtExpenses } = await fetchAllPages((from, to) =>
            supabase
              .from('expenses')
              .select('contact_id, debt_type, amount')
              .not('contact_id', 'is', null)
              .not('debt_type', 'is', null)
              .eq('user_id', user.id)
              .order('id')
              .range(from, to)
          );

          const contactMap: Record<
            string,
            { receivable: number; payable: number }
          > = {};

          (debtExpenses || []).forEach((item) => {
            if (!item.contact_id) return;
            if (!contactMap[item.contact_id]) {
              contactMap[item.contact_id] = { receivable: 0, payable: 0 };
            }
            const amt = Math.abs(Number(item.amount) || 0);
            if (item.debt_type === 'receivable') {
              contactMap[item.contact_id].receivable += amt;
            } else if (item.debt_type === 'receivable_payment') {
              contactMap[item.contact_id].receivable -= amt;
            } else if (item.debt_type === 'payable') {
              contactMap[item.contact_id].payable += amt;
            } else if (item.debt_type === 'payable_payment') {
              contactMap[item.contact_id].payable -= amt;
            }
          });

          let total_receivable = 0;
          let total_payable = 0;
          let active_debt_count = 0;

          Object.values(contactMap).forEach((val) => {
            // Net each contact first so a contact who both lends and borrows is
            // not double-counted in both receivable and payable totals.
            const netPosition = val.receivable - val.payable;
            if (netPosition > 0.01) {
              total_receivable += netPosition;
            } else if (netPosition < -0.01) {
              total_payable += Math.abs(netPosition);
            }
            if (Math.abs(netPosition) > 0.01) {
              active_debt_count += 1;
            }
          });

          return {
            data: {
              total_receivable,
              total_payable,
              net_balance: total_receivable - total_payable,
              contact_count: contactCount || 0,
              active_debt_count,
            },
          };
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Failed to fetch debt summary';
          return { error: { status: 'CUSTOM_ERROR', error: message } };
        }
      },
      providesTags: ['Debt', { type: 'Contact', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetContactsQuery,
  useGetContactQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,
  useGetDebtTransactionsQuery,
  useRecordDebtTransactionMutation,
  useDeleteDebtTransactionMutation,
  useGetDebtSummaryQuery,
} = debtsApi;
