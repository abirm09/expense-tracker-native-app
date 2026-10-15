-- ==============================================================================
-- RESET TRANSACTIONS / EXPENSES SCRIPT - FRESH START
-- ==============================================================================
-- Purpose:
-- Clears all transactions (expenses, incomes, inter-account transfers, and adjustments)
-- so you can start completely fresh from zero transactions, while PRESERVING:
--   ✓ User accounts (Cash, Bank, bKash, etc. remain created with their settings)
--   ✓ User profiles, authentication, and 5-digit PINs
--   ✓ Default and custom categories
--   ✓ Budgets
--
-- Account balances are restored to their opening_balance (or 0.00).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- OPTION 1: COMPLETE FRESH START (ALL USERS - DEFAULT)
-- Run this block in the Supabase SQL Editor as admin/postgres.
-- ------------------------------------------------------------------------------

-- 1. Disable the trigger temporarily to prevent unnecessary recalculation per row during batch delete
alter table public.expenses disable trigger trg_expenses_account_balance;

-- 2. Clear all transaction records (expenses, incomes, transfers, adjustments)
truncate table public.expenses restart identity cascade;

-- 3. Re-enable the real-time balance trigger
alter table public.expenses enable trigger trg_expenses_account_balance;

-- 4. Reset all account balances back to their opening balance
update public.accounts
set 
  current_balance = coalesce(opening_balance, 0.00),
  updated_at = now();

-- ------------------------------------------------------------------------------
-- OPTION 2: RESET TRANSACTIONS FOR A SPECIFIC USER ONLY
-- If you only want to reset one specific user's transactions instead of everyone,
-- comment out Option 1 above and uncomment the lines below:
-- ------------------------------------------------------------------------------
-- do $$
-- declare
--   target_user uuid := 'YOUR_USER_UUID_HERE'; -- Replace with the target user's UUID or auth.uid()
-- begin
--   -- Delete all transactions for this user
--   delete from public.expenses where user_id = target_user;
--
--   -- Reset account balances back to opening balances for this user
--   update public.accounts
--   set current_balance = coalesce(opening_balance, 0.00), updated_at = now()
--   where user_id = target_user;
-- end $$;

-- ------------------------------------------------------------------------------
-- VERIFICATION REPORT
-- Displays the updated state to confirm everything is clean and ready.
-- ------------------------------------------------------------------------------
select 
  (select count(*) from public.expenses) as remaining_transactions,
  (select count(*) from public.accounts) as total_accounts,
  (select coalesce(sum(current_balance), 0.00) from public.accounts) as total_combined_balance,
  (select count(*) from public.categories) as total_categories,
  (select count(*) from public.profiles) as total_profiles;
