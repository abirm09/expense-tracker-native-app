-- ==============================================================================
-- MIGRATION: 05_complete_accounting_accounts_and_transfers.sql
-- Implements:
-- 1. Accounts Table (cash, bank, mobile_wallet, other) with BDT balances
-- 2. Transaction Linking: expenses linked to accounts (account_id)
-- 3. Transfers: transfer_between_accounts atomic RPC with transfer_group_id
-- 4. Balance Adjustments: adjust_account_balance RPC for reconciliation
-- 5. Real-Time Account Balance Sync Trigger (credits add, debits subtract)
-- 6. Automatic Default Accounts Seeding (Cash, Bank, bKash) for each user
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ACCOUNTS TABLE
-- ------------------------------------------------------------------------------

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'mobile_wallet', 'other')),
  account_number text,
  opening_balance numeric(12, 2) not null default 0.00,
  current_balance numeric(12, 2) not null default 0.00,
  is_default boolean not null default false,
  notes text,
  color text default '#10b981',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for speedy queries by user
create index if not exists idx_accounts_user_id on public.accounts(user_id);

-- Enable RLS
alter table public.accounts enable row level security;

drop policy if exists "Users can manage their own accounts" on public.accounts;
create policy "Users can manage their own accounts"
  on public.accounts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 2. LINK TRANSACTIONS (expenses) TO ACCOUNTS & EXPAND TRANSACTION TYPES
-- ------------------------------------------------------------------------------

alter table public.expenses 
add column if not exists account_id uuid references public.accounts(id) on delete set null;

alter table public.expenses 
add column if not exists to_account_id uuid references public.accounts(id) on delete set null;

alter table public.expenses 
add column if not exists transfer_group_id uuid;

create index if not exists idx_expenses_account_id on public.expenses(account_id);
create index if not exists idx_expenses_transfer_group_id on public.expenses(transfer_group_id);

-- Expand entry_type check constraint to include transfers and adjustments
alter table public.expenses drop constraint if exists expenses_entry_type_check;
alter table public.expenses 
add constraint expenses_entry_type_check check (
  entry_type in ('debit', 'credit', 'transfer_out', 'transfer_in', 'adjustment')
);

-- Expand type check constraint to include transfer
alter table public.expenses drop constraint if exists expenses_type_check;
alter table public.expenses 
add constraint expenses_type_check check (
  type in ('expense', 'income', 'transfer')
);

-- Update synchronization trigger between `type` and `entry_type`
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
    if new.entry_type is null then
      new.entry_type := 'transfer_out';
    end if;
  else
    new.entry_type := 'debit';
    new.type := 'expense';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. AUTOMATIC ACCOUNT BALANCE RECALCULATION & TRIGGER
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

  select coalesce(opening_balance, 0.00) into init_balance
  from public.accounts
  where id = target_account_id;

  if init_balance is null then
    return;
  end if;

  -- Credits and transfer_in increase balance
  -- Debits and transfer_out decrease balance
  -- Adjustments: amount is signed (positive or negative)
  select init_balance + coalesce(sum(
    case 
      when entry_type = 'credit' or entry_type = 'transfer_in' then abs(amount)
      when entry_type = 'debit' or entry_type = 'transfer_out' then -abs(amount)
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
-- 4. TRANSFER BETWEEN ACCOUNTS RPC (Atomic Double-Entry)
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
    raise exception 'Unauthorized';
  end if;

  if from_account_id = to_account_id then
    raise exception 'Source and destination accounts must be different';
  end if;

  if abs_amount <= 0 then
    raise exception 'Transfer amount must be greater than zero';
  end if;

  -- Validate both accounts belong to the user
  select name into from_name from public.accounts where id = from_account_id and user_id = curr_user_id;
  if from_name is null then
    raise exception 'Source account not found or access denied';
  end if;

  select name into to_name from public.accounts where id = to_account_id and user_id = curr_user_id;
  if to_name is null then
    raise exception 'Destination account not found or access denied';
  end if;

  -- 1. Insert Transfer Out (Outflow from Source Account)
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

  -- 2. Insert Transfer In (Inflow to Destination Account)
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

  return json_build_object(
    'success', true,
    'transfer_group_id', group_id,
    'transfer_out_id', out_id,
    'transfer_in_id', in_id
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. BALANCE ADJUSTMENT RPC (Reconciliation)
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
    raise exception 'Unauthorized';
  end if;

  select name into acc_name from public.accounts where id = target_account_id and user_id = curr_user_id;
  if acc_name is null then
    raise exception 'Account not found';
  end if;

  if direction not in ('in', 'out') then
    raise exception 'Direction must be in or out';
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

  return json_build_object(
    'success', true,
    'id', rec_id
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. DEFAULT ACCOUNTS SEEDING FUNCTION & TRIGGER
-- ------------------------------------------------------------------------------

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

  -- Check if user already has accounts
  if not exists (select 1 from public.accounts where user_id = target_user_id) then
    insert into public.accounts (user_id, name, type, opening_balance, current_balance, is_default, color, notes)
    values
      (target_user_id, 'Cash in Hand', 'cash', 0.00, 0.00, true, '#10b981', 'Physical cash wallet'),
      (target_user_id, 'Bank Account', 'bank', 0.00, 0.00, false, '#3b82f6', 'Primary bank account'),
      (target_user_id, 'bKash Wallet', 'mobile_wallet', 0.00, 0.00, false, '#ec4899', 'Mobile financial service');
  end if;
end;
$$;

-- Seed default accounts for all existing users who have profiles
do $$
declare
  u record;
begin
  for u in select id from auth.users loop
    perform public.seed_default_accounts_for_user(u.id);
  end loop;
end $$;

-- Trigger to seed default accounts on new profile creation
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
-- 7. GRANTS & PERMISSIONS
-- ------------------------------------------------------------------------------

grant all privileges on table public.accounts to authenticated, service_role;
grant select on table public.accounts to anon;

grant execute on function public.transfer_between_accounts(uuid, uuid, numeric, text, date) to authenticated, service_role;
grant execute on function public.adjust_account_balance(uuid, numeric, text, text, text, date) to authenticated, service_role;
grant execute on function public.recalculate_account_balance(uuid) to authenticated, service_role;
grant execute on function public.seed_default_accounts_for_user(uuid) to authenticated, service_role;
