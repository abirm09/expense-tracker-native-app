-- ==============================================================================
-- MIGRATION: 06_fix_transfers_accounting_and_credits.sql
-- Fixes:
-- 1. Drops and expands check constraints on public.expenses (type and entry_type)
-- 2. Ensures accounts and transfer columns exist on public.expenses
-- 3. Defines recalculate_account_balance to credit transfer_in and debit transfer_out
-- 4. Corrects sync_transaction_accounting_type so transfers retain type='transfer'
-- 5. Backfills historical transfers that were coerced to 'debit' or 'expense'
-- 6. Updates transfer_between_accounts RPC to guarantee double-entry transfers
-- 7. Updates get_accounting_summary RPC to count credits and debits correctly
-- 8. Grants permissions and safely recalculates balances for all user accounts
-- ==============================================================================

-- 1. Ensure public.accounts table exists with required schema
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null default 'bank' check (type in ('bank', 'mobile_banking', 'cash', 'credit_card', 'savings', 'investment')),
  opening_balance numeric(12, 2) not null default 0.00,
  current_balance numeric(12, 2) not null default 0.00,
  currency text not null default 'BDT',
  account_number text,
  institution_name text,
  color text default '#10b981',
  icon text default 'wallet',
  is_default boolean default false,
  is_archived boolean default false,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.accounts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'Users can view own accounts') then
    create policy "Users can view own accounts" on public.accounts for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'Users can insert own accounts') then
    create policy "Users can insert own accounts" on public.accounts for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'Users can update own accounts') then
    create policy "Users can update own accounts" on public.accounts for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'Users can delete own accounts') then
    create policy "Users can delete own accounts" on public.accounts for delete using (auth.uid() = user_id);
  end if;
end $$;

-- 2. Ensure columns exist on public.expenses
alter table public.expenses 
add column if not exists account_id uuid references public.accounts(id) on delete set null;

alter table public.expenses 
add column if not exists to_account_id uuid references public.accounts(id) on delete set null;

alter table public.expenses 
add column if not exists transfer_group_id uuid;

-- 3. Drop and expand check constraints on public.expenses safely
alter table public.expenses drop constraint if exists expenses_type_check;
alter table public.expenses 
add constraint expenses_type_check check (
  type in ('expense', 'income', 'transfer')
);

alter table public.expenses drop constraint if exists expenses_entry_type_check;
alter table public.expenses 
add constraint expenses_entry_type_check check (
  entry_type in ('debit', 'credit', 'transfer_out', 'transfer_in', 'adjustment')
);

-- 4. Automatic Account Balance Recalculation Function
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

-- 5. Trigger to automatically keep account balances synced on expenses insert/update/delete
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

-- 6. Correct Synchronization Trigger between type and entry_type
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

-- 7. Backfill historical and existing transfer entries
-- Restores transfer_in as credits and transfer_out as debits
update public.expenses
set 
  type = 'transfer',
  entry_type = case 
    when title ilike 'Transfer from %' or entry_type = 'transfer_in' then 'transfer_in'
    else 'transfer_out'
  end
where transfer_group_id is not null 
   or title ilike 'Transfer to %' 
   or title ilike 'Transfer from %'
   or entry_type in ('transfer_out', 'transfer_in');

-- 8. Atomic Double-Entry Transfer RPC
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

  -- Validate both accounts belong to the user
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

  -- 3. Recalculate both account balances
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

-- 9. Accounting Summary RPC
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
      when entry_type in ('debit', 'transfer_out') or (entry_type is null and type = 'expense') then abs(amount) 
      else 0 
    end), 0.00),
    coalesce(sum(case 
      when entry_type in ('credit', 'transfer_in') or (entry_type is null and type = 'income') then abs(amount) 
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

-- 10. Grants and Permissions
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on table public.accounts to authenticated, service_role;
grant select on table public.accounts to anon;
grant all privileges on table public.expenses to authenticated, service_role;
grant select on table public.expenses to anon;

grant execute on function public.recalculate_account_balance(uuid) to authenticated, service_role;
grant execute on function public.trg_sync_account_balance() to authenticated, service_role;
grant execute on function public.sync_transaction_accounting_type() to authenticated, service_role;
grant execute on function public.transfer_between_accounts(uuid, uuid, numeric, text, date) to authenticated, service_role;
grant execute on function public.get_accounting_summary(date, date) to authenticated, service_role;

-- 11. Safely Recalculate all account balances
do $$
declare
  acc record;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'accounts') then
    for acc in select id from public.accounts loop
      perform public.recalculate_account_balance(acc.id);
    end loop;
  end if;
end;
$$;
