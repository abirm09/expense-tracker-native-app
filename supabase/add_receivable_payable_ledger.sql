-- ==============================================================================
-- RECEIVABLE & PAYABLE LEDGER MIGRATION
-- Run this in Supabase SQL Editor if you already applied the master schema.sql
-- ==============================================================================

-- 1. Create Contacts / Counterparty Users Table
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

-- 2. Add Debt Columns to Expenses Table
alter table public.expenses add column if not exists contact_id uuid references public.contacts(id) on delete cascade;
alter table public.expenses add column if not exists debt_type text;
alter table public.expenses add column if not exists due_date date;

alter table public.expenses drop constraint if exists expenses_debt_type_check;
alter table public.expenses add constraint expenses_debt_type_check check (
  debt_type is null or debt_type in ('receivable', 'payable', 'receivable_payment', 'payable_payment')
);

create index if not exists idx_expenses_contact_id on public.expenses(contact_id);
create index if not exists idx_expenses_debt_type on public.expenses(debt_type);

-- 3. Atomic Debt Transaction RPC Function
create or replace function public.record_debt_transaction(
  p_contact_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_debt_type text, -- 'receivable', 'payable', 'receivable_payment', 'payable_payment'
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

-- 4. Permissions & Grants
grant all privileges on table public.contacts to authenticated, service_role;
grant select on table public.contacts to anon;
grant execute on function public.record_debt_transaction(uuid, uuid, numeric, text, text, text, date, date) to authenticated, service_role;
