-- ==============================================================================
-- ALL-IN-ONE SUPABASE DATABASE SETUP & SCHEMA - EXPENSE TRACKER
-- ==============================================================================
-- SINGLE MASTER SQL FILE: Run this entire file in the Supabase SQL Editor.
-- It sets up everything from scratch or updates an existing database safely.
--
-- INCLUDES:
--  1. Extensions (pgcrypto, uuid-ossp)
--  2. Profiles Table (with 5-Digit PIN authentication & BDT currency)
--  3. Categories Table (Dynamic categories, expense/income types & monthly limits)
--  4. Accounts Table (Cash, Bank, Mobile Banking/bKash with BDT balances)
--  5. Expenses & Transactions Table (Expenses, Incomes, Double-Entry Transfers)
--  6. Budgets Table
--  7. Row Level Security (RLS) & Policies for all tables
--  8. Security & PIN RPC Functions
--  9. Real-Time Account Balance Recalculation & Accounting Triggers
-- 10. Atomic Double-Entry Transfer & Balance Adjustment RPCs
-- 11. Accounting Summary & Category Monthly Usage RPCs
-- 12. Transaction Reset Functions (Fresh Start anytime with a single command)
-- 13. Default Seed Data (Expense/Income Categories & Default User Accounts)
-- 14. Full Role Permissions & Grants (anon, authenticated, service_role)
--
-- MULTI-USER: after running this file, also run
-- `supabase/multiuser_migration.sql`. It converts shared default categories
-- into per-user copies, hardens RLS and makes every account fully isolated.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 2. PROFILES TABLE (User Profile & PIN Security)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  currency text not null default 'BDT',
  has_pin boolean not null default false,
  pin_hash text,
  pin_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure currency column exists and defaults to BDT
alter table public.profiles add column if not exists currency text not null default 'BDT';
alter table public.profiles alter column currency set default 'BDT';

-- Enable RLS
alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Trigger to create profile automatically on auth.users signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, currency)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'BDT'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ensure profile exists RPC for authenticated user
create or replace function public.ensure_user_profile()
returns json
language plpgsql
security definer set search_path = public, auth
as $$
declare
  u_id uuid := auth.uid();
  u_email text;
  u_name text;
  prof record;
begin
  if u_id is null then
    return json_build_object('success', false, 'error', 'Unauthorized');
  end if;

  select * into prof from public.profiles where id = u_id;
  if not found then
    select email, raw_user_meta_data->>'full_name' into u_email, u_name from auth.users where id = u_id;
    insert into public.profiles (id, email, full_name, currency, has_pin, pin_enabled)
    values (u_id, u_email, coalesce(u_name, split_part(coalesce(u_email, 'user'), '@', 1)), 'BDT', false, false)
    returning * into prof;
  end if;

  return row_to_json(prof);
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. 5-DIGIT PIN SECURITY FUNCTIONS (RPC)
-- ------------------------------------------------------------------------------

-- Set or Update 5-Digit PIN
create or replace function public.set_user_pin(pin_input text)
returns json
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  user_id uuid := auth.uid();
begin
  if user_id is null then
    return json_build_object('success', false, 'error', 'Unauthorized');
  end if;

  if pin_input !~ '^[0-9]{5}$' then
    return json_build_object('success', false, 'error', 'PIN must be exactly 5 digits');
  end if;

  insert into public.profiles (id, email, full_name, currency, has_pin, pin_enabled, pin_hash)
  values (
    user_id,
    (select email from auth.users where id = user_id),
    (select coalesce(raw_user_meta_data->>'full_name', split_part(coalesce(email, 'user'), '@', 1)) from auth.users where id = user_id),
    'BDT',
    true,
    true,
    extensions.crypt(pin_input, extensions.gen_salt('bf', 10))
  )
  on conflict (id) do update
  set
    pin_hash = extensions.crypt(pin_input, extensions.gen_salt('bf', 10)),
    has_pin = true,
    pin_enabled = true,
    updated_at = timezone('utc'::text, now());

  return json_build_object('success', true);
end;
$$;

-- Verify 5-Digit PIN
create or replace function public.verify_user_pin(pin_input text)
returns json
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  user_id uuid := auth.uid();
  stored_hash text;
  is_valid boolean := false;
begin
  if user_id is null then
    return json_build_object('success', false, 'error', 'Unauthorized');
  end if;

  select pin_hash into stored_hash
  from public.profiles
  where id = user_id and pin_enabled = true;

  if stored_hash is null then
    return json_build_object('success', false, 'error', 'No active PIN set for this account');
  end if;

  is_valid := (stored_hash = extensions.crypt(pin_input, stored_hash));

  return json_build_object('success', is_valid);
end;
$$;

-- Disable/Remove 5-Digit PIN
create or replace function public.disable_user_pin(current_pin text)
returns json
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  user_id uuid := auth.uid();
  stored_hash text;
begin
  if user_id is null then
    return json_build_object('success', false, 'error', 'Unauthorized');
  end if;

  select pin_hash into stored_hash
  from public.profiles
  where id = user_id;

  if stored_hash is null or (stored_hash != extensions.crypt(current_pin, stored_hash)) then
    return json_build_object('success', false, 'error', 'Invalid current PIN');
  end if;

  update public.profiles
  set
    pin_hash = null,
    has_pin = false,
    pin_enabled = false,
    updated_at = timezone('utc'::text, now())
  where id = user_id;

  return json_build_object('success', true);
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. CATEGORIES TABLE (Expense & Income Categories with Dynamic Monthly Limits)
-- ------------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade, -- null means global default
  name text not null,
  icon text default 'tag',
  color text default '#10b981',
  type text check (type in ('expense', 'income', 'both')) default 'expense',
  monthly_limit numeric(12, 2) default 0.00,
  is_default boolean default false,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure columns exist
alter table public.categories add column if not exists type text check (type in ('expense', 'income', 'both')) default 'expense';
alter table public.categories add column if not exists monthly_limit numeric(12, 2) default 0.00;

alter table public.categories enable row level security;

drop policy if exists "Users can view default categories and their own" on public.categories;
create policy "Users can view default categories and their own"
  on public.categories for select
  using (user_id is null or auth.uid() = user_id);

drop policy if exists "Users can insert their own categories" on public.categories;
create policy "Users can insert their own categories"
  on public.categories for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own categories" on public.categories;
create policy "Users can update their own categories"
  on public.categories for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own categories" on public.categories;
create policy "Users can delete their own categories"
  on public.categories for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 5. ACCOUNTS TABLE (Cash, Bank, Mobile Wallets with BDT balances)
-- ------------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'bank' check (type in ('bank', 'mobile_banking', 'cash', 'credit_card', 'savings', 'investment', 'mobile_wallet', 'other')),
  opening_balance numeric(12, 2) not null default 0.00,
  current_balance numeric(12, 2) not null default 0.00,
  currency text not null default 'BDT',
  account_number text,
  institution_name text,
  color text default '#10b981',
  icon text default 'wallet',
  is_default boolean not null default false,
  is_archived boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_accounts_user_id on public.accounts(user_id);

alter table public.accounts enable row level security;

drop policy if exists "Users can view own accounts" on public.accounts;
create policy "Users can view own accounts" 
  on public.accounts for select 
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own accounts" on public.accounts;
create policy "Users can insert own accounts" 
  on public.accounts for insert 
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own accounts" on public.accounts;
create policy "Users can update own accounts" 
  on public.accounts for update 
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own accounts" on public.accounts;
create policy "Users can delete own accounts" 
  on public.accounts for delete 
  using (auth.uid() = user_id);

-- Helper to seed default accounts for a user
create or replace function public.seed_default_accounts_for_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if target_user_id is null then
    return;
  end if;

  if not exists (select 1 from public.accounts where user_id = target_user_id) then
    insert into public.accounts (user_id, name, type, opening_balance, current_balance, currency, is_default, color, notes)
    values
      (target_user_id, 'Cash in Hand', 'cash', 0.00, 0.00, 'BDT', true, '#10b981', 'Physical cash wallet'),
      (target_user_id, 'Bank Account', 'bank', 0.00, 0.00, 'BDT', false, '#3b82f6', 'Primary bank account'),
      (target_user_id, 'bKash Wallet', 'mobile_wallet', 0.00, 0.00, 'BDT', false, '#ec4899', 'Mobile financial service');
  end if;
end;
$$;

-- Trigger to seed default accounts whenever a user profile is created
create or replace function public.trg_seed_accounts_on_profile_create()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.seed_default_accounts_for_user(new.id);
  return new;
end;
$$;

drop trigger if exists trg_profile_seed_accounts on public.profiles;
create trigger trg_profile_seed_accounts
  after insert on public.profiles
  for each row execute function public.trg_seed_accounts_on_profile_create();

-- ------------------------------------------------------------------------------
-- 6. EXPENSES & TRANSACTIONS TABLE (Double-Entry Accounting & Transfers)
-- ------------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  account_id uuid references public.accounts(id) on delete set null,
  to_account_id uuid references public.accounts(id) on delete set null,
  transfer_group_id uuid,
  category_id uuid references public.categories on delete set null,
  title text not null,
  amount numeric(12, 2) not null,
  type text check (type in ('expense', 'income', 'transfer')) default 'expense' not null,
  entry_type text check (entry_type in ('debit', 'credit', 'transfer_out', 'transfer_in', 'adjustment')),
  currency text default 'BDT' not null,
  date date default current_date not null,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure all columns and constraints exist
alter table public.expenses add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.expenses add column if not exists to_account_id uuid references public.accounts(id) on delete set null;
alter table public.expenses add column if not exists transfer_group_id uuid;
alter table public.expenses add column if not exists entry_type text;
alter table public.expenses add column if not exists currency text default 'BDT';

alter table public.expenses drop constraint if exists expenses_type_check;
alter table public.expenses add constraint expenses_type_check check (type in ('expense', 'income', 'transfer'));

alter table public.expenses drop constraint if exists expenses_entry_type_check;
alter table public.expenses add constraint expenses_entry_type_check check (
  entry_type in ('debit', 'credit', 'transfer_out', 'transfer_in', 'adjustment')
);

create index if not exists idx_expenses_user_id on public.expenses(user_id);
create index if not exists idx_expenses_account_id on public.expenses(account_id);
create index if not exists idx_expenses_to_account_id on public.expenses(to_account_id);
create index if not exists idx_expenses_transfer_group_id on public.expenses(transfer_group_id);
create index if not exists idx_expenses_category_id on public.expenses(category_id);
create index if not exists idx_expenses_date on public.expenses(date);

alter table public.expenses enable row level security;

drop policy if exists "Users can manage their own expenses" on public.expenses;
create policy "Users can manage their own expenses"
  on public.expenses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Synchronization Trigger between type and entry_type
create or replace function public.sync_transaction_accounting_type()
returns trigger
language plpgsql
as $$
begin
  if new.entry_type in ('transfer_out', 'transfer_in') then
    new.type := 'transfer';
  elsif new.entry_type = 'adjustment' then
    if new.type is null then
      new.type := case when coalesce(new.amount, 0) >= 0 then 'income' else 'expense' end;
    end if;
  elsif new.entry_type = 'credit' then
    new.type := 'income';
  elsif new.entry_type = 'debit' then
    new.type := 'expense';
  elsif new.type = 'income' then
    new.entry_type := 'credit';
  elsif new.type = 'expense' then
    new.entry_type := 'debit';
  elsif new.type = 'transfer' then
    if new.entry_type is null or new.entry_type not in ('transfer_out', 'transfer_in') then
      new.entry_type := 'transfer_out';
    end if;
  else
    new.entry_type := 'debit';
    new.type := 'expense';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_transaction_accounting_type on public.expenses;
create trigger trg_sync_transaction_accounting_type
  before insert or update on public.expenses
  for each row execute function public.sync_transaction_accounting_type();

-- ------------------------------------------------------------------------------
-- 7. AUTOMATIC ACCOUNT BALANCE RECALCULATION & REAL-TIME TRIGGER
-- ------------------------------------------------------------------------------
create or replace function public.recalculate_account_balance(target_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  calc_balance numeric(12, 2);
  init_balance numeric(12, 2);
begin
  if target_account_id is null then
    return;
  end if;

  -- Guard direct RPC calls: an authenticated user may only recalculate their
  -- own accounts. Internal trigger calls run with the row owner's session.
  if auth.uid() is not null and not exists (
    select 1 from public.accounts
    where id = target_account_id and user_id = auth.uid()
  ) then
    return;
  end if;

  select coalesce(opening_balance, 0.00) into init_balance
  from public.accounts
  where id = target_account_id;

  if init_balance is null then
    return;
  end if;

  -- Credits and transfer_in increase account balance
  -- Debits and transfer_out decrease account balance
  -- Adjustments: amount is signed (positive adds, negative subtracts)
  select init_balance + coalesce(sum(
    case 
      when entry_type in ('credit', 'transfer_in') then abs(amount)
      when entry_type in ('debit', 'transfer_out') then -abs(amount)
      when entry_type = 'adjustment' then amount
      when type = 'income' then abs(amount)
      else -abs(amount)
    end
  ), 0.00)
  into calc_balance
  from public.expenses
  where account_id = target_account_id;

  update public.accounts
  set current_balance = coalesce(calc_balance, init_balance),
      updated_at = now()
  where id = target_account_id;
end;
$$;

create or replace function public.trg_sync_account_balance()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if (TG_OP = 'DELETE') then
    if old.account_id is not null then
      perform public.recalculate_account_balance(old.account_id);
    end if;
    return old;
  elsif (TG_OP = 'UPDATE') then
    if old.account_id is not null and old.account_id != new.account_id then
      perform public.recalculate_account_balance(old.account_id);
    end if;
    if new.account_id is not null then
      perform public.recalculate_account_balance(new.account_id);
    end if;
    return new;
  elsif (TG_OP = 'INSERT') then
    if new.account_id is not null then
      perform public.recalculate_account_balance(new.account_id);
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_expenses_account_balance on public.expenses;
create trigger trg_expenses_account_balance
  after insert or update or delete on public.expenses
  for each row execute function public.trg_sync_account_balance();

-- ------------------------------------------------------------------------------
-- 8. ATOMIC DOUBLE-ENTRY TRANSFER RPC
-- ------------------------------------------------------------------------------
create or replace function public.transfer_between_accounts(
  from_account_id uuid,
  to_account_id uuid,
  amount numeric,
  notes text default null,
  transfer_date date default current_date
)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  curr_user_id uuid := auth.uid();
  group_id uuid := gen_random_uuid();
  from_name text;
  to_name text;
  out_id uuid;
  in_id uuid;
  abs_amount numeric := abs(amount);
begin
  if curr_user_id is null then
    return json_build_object('success', false, 'error', 'Unauthorized');
  end if;

  if from_account_id = to_account_id then
    return json_build_object('success', false, 'error', 'Source and destination accounts must be different');
  end if;

  if abs_amount <= 0 then
    return json_build_object('success', false, 'error', 'Transfer amount must be greater than zero');
  end if;

  -- Validate ownership
  select name into from_name from public.accounts where id = from_account_id and user_id = curr_user_id;
  if from_name is null then
    return json_build_object('success', false, 'error', 'Source account not found or access denied');
  end if;

  select name into to_name from public.accounts where id = to_account_id and user_id = curr_user_id;
  if to_name is null then
    return json_build_object('success', false, 'error', 'Destination account not found or access denied');
  end if;

  -- 1. Insert Transfer Out (Outflow debit from Source Account)
  insert into public.expenses (
    user_id,
    account_id,
    to_account_id,
    transfer_group_id,
    title,
    amount,
    type,
    entry_type,
    date,
    notes,
    currency
  ) values (
    curr_user_id,
    from_account_id,
    to_account_id,
    group_id,
    'Transfer to ' || to_name,
    abs_amount,
    'transfer',
    'transfer_out',
    transfer_date,
    notes,
    'BDT'
  ) returning id into out_id;

  -- 2. Insert Transfer In (Inflow credit to Destination Account)
  insert into public.expenses (
    user_id,
    account_id,
    to_account_id,
    transfer_group_id,
    title,
    amount,
    type,
    entry_type,
    date,
    notes,
    currency
  ) values (
    curr_user_id,
    to_account_id,
    from_account_id,
    group_id,
    'Transfer from ' || from_name,
    abs_amount,
    'transfer',
    'transfer_in',
    transfer_date,
    notes,
    'BDT'
  ) returning id into in_id;

  -- Explicit recalculate for guaranteed immediate balance reflection
  perform public.recalculate_account_balance(from_account_id);
  perform public.recalculate_account_balance(to_account_id);

  return json_build_object(
    'success', true,
    'transfer_group_id', group_id,
    'transfer_out_id', out_id,
    'transfer_in_id', in_id
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 9. ACCOUNT BALANCE ADJUSTMENT RPC (Reconciliation)
-- ------------------------------------------------------------------------------
create or replace function public.adjust_account_balance(
  target_account_id uuid,
  amount numeric,
  direction text, -- 'in' or 'out'
  title text default 'Balance Adjustment',
  notes text default null,
  adjustment_date date default current_date
)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  curr_user_id uuid := auth.uid();
  acc_name text;
  adj_amount numeric;
  rec_id uuid;
begin
  if curr_user_id is null then
    return json_build_object('success', false, 'error', 'Unauthorized');
  end if;

  select name into acc_name from public.accounts where id = target_account_id and user_id = curr_user_id;
  if acc_name is null then
    return json_build_object('success', false, 'error', 'Account not found');
  end if;

  if direction not in ('in', 'out') then
    return json_build_object('success', false, 'error', 'Direction must be in or out');
  end if;

  adj_amount := case when direction = 'out' then -abs(amount) else abs(amount) end;

  insert into public.expenses (
    user_id,
    account_id,
    title,
    amount,
    type,
    entry_type,
    date,
    notes,
    currency
  ) values (
    curr_user_id,
    target_account_id,
    coalesce(title, 'Balance Adjustment'),
    adj_amount,
    case when direction = 'in' then 'income' else 'expense' end,
    'adjustment',
    adjustment_date,
    notes,
    'BDT'
  ) returning id into rec_id;

  perform public.recalculate_account_balance(target_account_id);

  return json_build_object(
    'success', true,
    'id', rec_id
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 10. ACCOUNTING SUMMARY RPC (Debits, Credits, Net Balance)
-- ------------------------------------------------------------------------------
create or replace function public.get_accounting_summary(
  start_date date default null,
  end_date date default null
)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  total_debits numeric(12, 2) := 0.00;
  total_credits numeric(12, 2) := 0.00;
  net_balance numeric(12, 2) := 0.00;
  trans_count integer := 0;
begin
  if current_user_id is null then
    return json_build_object('error', 'Unauthorized');
  end if;

  select 
    coalesce(sum(case 
      when entry_type in ('debit', 'transfer_out') then abs(amount)
      when entry_type = 'adjustment' and amount < 0 then abs(amount)
      when entry_type is null and type = 'expense' then abs(amount)
      else 0 
    end), 0.00),
    coalesce(sum(case 
      when entry_type in ('credit', 'transfer_in') then abs(amount)
      when entry_type = 'adjustment' and amount >= 0 then amount
      when entry_type is null and type = 'income' then abs(amount)
      else 0 
    end), 0.00),
    count(*)
  into total_debits, total_credits, trans_count
  from public.expenses
  where user_id = current_user_id
    and (start_date is null or date >= start_date)
    and (end_date is null or date <= end_date);

  net_balance := total_credits - total_debits;

  return json_build_object(
    'total_debits', total_debits,
    'total_credits', total_credits,
    'net_balance', net_balance,
    'transaction_count', trans_count,
    'status', case when net_balance >= 0 then 'surplus' else 'deficit' end
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 11. MONTHLY CATEGORY USAGE RPC (Spending vs Limit Calculation)
-- ------------------------------------------------------------------------------
create or replace function public.get_category_monthly_usage(
  target_month integer default extract(month from current_date)::integer,
  target_year integer default extract(year from current_date)::integer
)
returns table (
  category_id uuid,
  category_name text,
  category_type text,
  icon text,
  color text,
  monthly_limit numeric,
  total_spent numeric,
  usage_percentage numeric,
  remaining_limit numeric,
  is_over_budget boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return;
  end if;

  return query
  with category_spending as (
    select 
      e.category_id,
      coalesce(sum(e.amount), 0.00) as spent
    from public.expenses e
    where e.user_id = current_user_id
      and (e.type = 'expense' or e.entry_type = 'debit')
      and coalesce(e.entry_type, '') <> 'adjustment'
      and extract(month from e.date) = target_month
      and extract(year from e.date) = target_year
    group by e.category_id
  )
  select 
    c.id as category_id,
    c.name as category_name,
    c.type as category_type,
    c.icon,
    c.color,
    coalesce(c.monthly_limit, 0.00) as monthly_limit,
    coalesce(cs.spent, 0.00) as total_spent,
    case 
      when coalesce(c.monthly_limit, 0.00) > 0 then
        round((coalesce(cs.spent, 0.00) / c.monthly_limit * 100.0), 2)
      else 0.00
    end as usage_percentage,
    case 
      when coalesce(c.monthly_limit, 0.00) > 0 then
        (c.monthly_limit - coalesce(cs.spent, 0.00))
      else 0.00
    end as remaining_limit,
    case 
      when coalesce(c.monthly_limit, 0.00) > 0 and coalesce(cs.spent, 0.00) > c.monthly_limit then true
      else false
    end as is_over_budget
  from public.categories c
  left join category_spending cs on cs.category_id = c.id
  where (c.user_id is null or c.user_id = current_user_id)
    and (c.type = 'expense' or c.type = 'both')
  order by 
    case when coalesce(c.monthly_limit, 0.00) > 0 then 0 else 1 end,
    usage_percentage desc,
    c.name asc;
end;
$$;

-- ------------------------------------------------------------------------------
-- 12. BUDGETS TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  category_id uuid references public.categories on delete cascade,
  amount numeric(12, 2) not null,
  month integer not null check (month between 1 and 12),
  year integer not null check (year >= 2020),
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, category_id, month, year)
);

alter table public.budgets enable row level security;

drop policy if exists "Users can manage their own budgets" on public.budgets;
create policy "Users can manage their own budgets"
  on public.budgets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 13. TRANSACTION RESET FUNCTIONS (Start Fresh with 1 command anytime)
-- ------------------------------------------------------------------------------

-- Reset all transactions across database and restore account balances
create or replace function public.reset_all_transactions()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Temporarily disable balance trigger during truncate
  alter table public.expenses disable trigger trg_expenses_account_balance;

  -- Clear all transactions
  truncate table public.expenses restart identity cascade;

  -- Re-enable balance trigger
  alter table public.expenses enable trigger trg_expenses_account_balance;

  -- Reset all accounts back to their opening balance
  update public.accounts
  set 
    current_balance = coalesce(opening_balance, 0.00),
    updated_at = now();

  return json_build_object(
    'success', true,
    'message', 'All transactions have been deleted and accounts restored to opening balances.'
  );
end;
$$;

-- Reset transactions for authenticated user only
create or replace function public.reset_user_transactions()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  curr_user_id uuid := auth.uid();
begin
  if curr_user_id is null then
    return json_build_object('success', false, 'error', 'Unauthorized');
  end if;

  delete from public.expenses where user_id = curr_user_id;

  update public.accounts
  set 
    current_balance = coalesce(opening_balance, 0.00),
    updated_at = now()
  where user_id = curr_user_id;

  return json_build_object(
    'success', true,
    'message', 'Your transactions have been deleted and account balances restored.'
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 14. SEED DEFAULT CATEGORIES (Expense & Income)
-- ------------------------------------------------------------------------------
-- Only seed the legacy shared defaults on a completely fresh database. After
-- `multiuser_migration.sql` each user owns a private copy, so re-running this
-- file must not resurrect shared rows.
insert into public.categories (name, icon, color, is_default, type)
select d.name, d.icon, d.color, true, d.type
from (values
  ('Groceries', 'shopping-cart', '#10b981', 'expense'),
  ('Food & Dining', 'utensils', '#f59e0b', 'expense'),
  ('Transport', 'car', '#3b82f6', 'expense'),
  ('Housing & Utilities', 'home', '#6366f1', 'expense'),
  ('Entertainment', 'film', '#ec4899', 'expense'),
  ('Health & Wellness', 'heart', '#ef4444', 'expense'),
  ('Shopping', 'shopping-bag', '#8b5cf6', 'expense'),
  ('General Expense', 'tag', '#64748b', 'expense'),
  ('Salary', 'briefcase', '#10b981', 'income'),
  ('Freelance / Contract', 'laptop', '#059669', 'income'),
  ('Investments & Dividends', 'trending-up', '#3b82f6', 'income'),
  ('Business & Sales', 'store', '#6366f1', 'income'),
  ('Gifts & Bonuses', 'gift', '#ec4899', 'income'),
  ('Rental Income', 'home', '#8b5cf6', 'income'),
  ('Other Income', 'plus-circle', '#14b8a6', 'income')
) as d(name, icon, color, type)
where not exists (select 1 from public.categories);

-- ------------------------------------------------------------------------------
-- 15. SEED EXISTING USERS (Profiles & Default Accounts)
-- ------------------------------------------------------------------------------
insert into public.profiles (id, email, full_name, currency, has_pin, pin_enabled)
select 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'full_name', split_part(coalesce(email, 'user'), '@', 1)),
  'BDT',
  false,
  false
from auth.users
on conflict (id) do nothing;

do $$
declare
  u record;
begin
  for u in select id from auth.users loop
    perform public.seed_default_accounts_for_user(u.id);
  end loop;
end $$;

-- ------------------------------------------------------------------------------
-- 16. GRANTS & ROLE PERMISSIONS (Supabase anon, authenticated, service_role)
-- ------------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

grant all privileges on table public.profiles to authenticated, service_role;
grant select on table public.profiles to anon;

grant all privileges on table public.categories to authenticated, service_role;
grant select on table public.categories to anon;

grant all privileges on table public.accounts to authenticated, service_role;
grant select on table public.accounts to anon;

grant all privileges on table public.expenses to authenticated, service_role;
grant select on table public.expenses to anon;

grant all privileges on table public.budgets to authenticated, service_role;
grant select on table public.budgets to anon;

grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

grant execute on function public.ensure_user_profile() to authenticated, service_role;
grant execute on function public.set_user_pin(text) to authenticated, service_role;
grant execute on function public.verify_user_pin(text) to authenticated, service_role;
grant execute on function public.disable_user_pin(text) to authenticated, service_role;
grant execute on function public.transfer_between_accounts(uuid, uuid, numeric, text, date) to authenticated, service_role;
grant execute on function public.adjust_account_balance(uuid, numeric, text, text, text, date) to authenticated, service_role;
grant execute on function public.recalculate_account_balance(uuid) to authenticated, service_role;
grant execute on function public.seed_default_accounts_for_user(uuid) to authenticated, service_role;
grant execute on function public.get_accounting_summary(date, date) to authenticated, service_role;
grant execute on function public.get_category_monthly_usage(integer, integer) to authenticated, service_role;
-- Destructive: wipes EVERY user's ledger. Service role only.
grant execute on function public.reset_all_transactions() to service_role;
revoke execute on function public.reset_all_transactions() from anon, authenticated;
grant execute on function public.reset_user_transactions() to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 17. CONTACTS & RECEIVABLE / PAYABLE LEDGER
-- ------------------------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  phone text not null,
  email text,
  whatsapp text,
  notes text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_contacts_user_id on public.contacts(user_id);
create index if not exists idx_contacts_phone on public.contacts(phone);

alter table public.contacts enable row level security;

drop policy if exists "Users can view own contacts" on public.contacts;
create policy "Users can view own contacts"
  on public.contacts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own contacts" on public.contacts;
create policy "Users can insert own contacts"
  on public.contacts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own contacts" on public.contacts;
create policy "Users can update own contacts"
  on public.contacts for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own contacts" on public.contacts;
create policy "Users can delete own contacts"
  on public.contacts for delete
  using (auth.uid() = user_id);

-- Add debt-specific columns to expenses table
alter table public.expenses add column if not exists contact_id uuid references public.contacts(id) on delete cascade;
alter table public.expenses add column if not exists debt_type text;
alter table public.expenses add column if not exists due_date date;

alter table public.expenses drop constraint if exists expenses_debt_type_check;
alter table public.expenses add constraint expenses_debt_type_check check (
  debt_type is null or debt_type in ('receivable', 'payable', 'receivable_payment', 'payable_payment')
);

create index if not exists idx_expenses_contact_id on public.expenses(contact_id);
create index if not exists idx_expenses_debt_type on public.expenses(debt_type);

-- Atomic Debt Transaction RPC Function
create or replace function public.record_debt_transaction(
  p_contact_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_debt_type text,
  p_title text default null,
  p_notes text default null,
  p_date date default current_date,
  p_due_date date default null
)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  curr_user_id uuid := auth.uid();
  v_contact_name text;
  v_contact_phone text;
  v_account_name text;
  v_entry_type text;
  v_type text;
  v_default_title text;
  v_rec_id uuid;
  abs_amount numeric := abs(p_amount);
begin
  if curr_user_id is null then
    return json_build_object('success', false, 'error', 'Unauthorized');
  end if;

  if abs_amount <= 0 then
    return json_build_object('success', false, 'error', 'Amount must be greater than zero');
  end if;

  if p_debt_type not in ('receivable', 'payable', 'receivable_payment', 'payable_payment') then
    return json_build_object('success', false, 'error', 'Invalid debt type');
  end if;

  -- Verify contact ownership
  select name, phone into v_contact_name, v_contact_phone
  from public.contacts
  where id = p_contact_id and user_id = curr_user_id;

  if v_contact_phone is null then
    return json_build_object('success', false, 'error', 'Contact not found or access denied');
  end if;

  -- Verify account ownership
  select name into v_account_name
  from public.accounts
  where id = p_account_id and user_id = curr_user_id;

  if v_account_name is null then
    return json_build_object('success', false, 'error', 'Account not found or access denied');
  end if;

  -- 1. receivable (I lend money to contact): Money OUT of my account (debit/expense)
  -- 2. payable (I borrow money from contact): Money IN to my account (credit/income)
  -- 3. receivable_payment (Contact pays me back): Money IN to my account (credit/income)
  -- 4. payable_payment (I pay contact back): Money OUT of my account (debit/expense)
  if p_debt_type = 'receivable' then
    v_entry_type := 'debit';
    v_type := 'expense';
    v_default_title := 'Lent to ' || coalesce(nullif(v_contact_name, ''), v_contact_phone);
  elsif p_debt_type = 'payable' then
    v_entry_type := 'credit';
    v_type := 'income';
    v_default_title := 'Borrowed from ' || coalesce(nullif(v_contact_name, ''), v_contact_phone);
  elsif p_debt_type = 'receivable_payment' then
    v_entry_type := 'credit';
    v_type := 'income';
    v_default_title := 'Repayment from ' || coalesce(nullif(v_contact_name, ''), v_contact_phone);
  elsif p_debt_type = 'payable_payment' then
    v_entry_type := 'debit';
    v_type := 'expense';
    v_default_title := 'Repayment to ' || coalesce(nullif(v_contact_name, ''), v_contact_phone);
  end if;

  insert into public.expenses (
    user_id,
    contact_id,
    account_id,
    title,
    amount,
    type,
    entry_type,
    debt_type,
    date,
    due_date,
    notes,
    currency
  ) values (
    curr_user_id,
    p_contact_id,
    p_account_id,
    coalesce(nullif(p_title, ''), v_default_title),
    abs_amount,
    v_type,
    v_entry_type,
    p_debt_type,
    p_date,
    p_due_date,
    p_notes,
    'BDT'
  ) returning id into v_rec_id;

  -- Recalculate account balance immediately
  perform public.recalculate_account_balance(p_account_id);

  return json_build_object(
    'success', true,
    'id', v_rec_id
  );
end;
$$;

grant all privileges on table public.contacts to authenticated, service_role;
grant select on table public.contacts to anon;
grant execute on function public.record_debt_transaction(uuid, uuid, numeric, text, text, text, date, date) to authenticated, service_role;
