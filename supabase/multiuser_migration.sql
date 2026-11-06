-- ==============================================================================
-- MULTI-USER ACCOUNT MIGRATION - EXPENSE TRACKER
-- ==============================================================================
-- Run this ONCE in the Supabase SQL Editor AFTER the master `schema.sql` has
-- already been applied.
--
-- What this migration does:
--   1. Ensures every user has an isolated profile.
--   2. Gives every user their OWN default categories (previously the defaults
--      were shared global rows owned by nobody).
--   3. Gives every user their OWN default accounts.
--   4. Re-points existing transactions/budgets from shared global categories to
--      the matching category owned by that transaction's user.
--   5. Re-asserts Row Level Security (RLS) on every user-data table so one user
--      can never read or write another user's data.
--   6. Seeds profiles/accounts/categories for existing users and wires the same
--      behaviour into the signup trigger for future users.
--   7. Hardens the destructive `reset_all_transactions()` RPC so a normal
--      authenticated user cannot wipe every other user's ledger.
--   8. Removes anonymous (unauthenticated) access to personal data tables.
--
-- Safe to run multiple times: every statement is idempotent.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROFILE COLUMNS, RLS & SIGNUP TRIGGER
-- ------------------------------------------------------------------------------
alter table public.profiles add column if not exists currency text not null default 'BDT';
alter table public.profiles alter column currency set default 'BDT';

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Automatically create a profile for every new auth user.
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
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
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

-- ------------------------------------------------------------------------------
-- 2. PER-USER DEFAULT CATEGORIES
-- ------------------------------------------------------------------------------
-- Previously the default categories were global (user_id IS NULL) and shared by
-- every account, so edits/deletes either failed RLS or affected everybody.
-- Every user now receives their own private copy of the default category set.
create or replace function public.seed_default_categories_for_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if target_user_id is null then
    return;
  end if;

  insert into public.categories (user_id, name, icon, color, type, monthly_limit, is_default)
  select
    target_user_id,
    d.name,
    d.icon,
    d.color,
    d.type,
    0.00,
    true
  from (values
    ('Groceries',              'shopping-cart', '#10b981', 'expense'),
    ('Food & Dining',          'utensils',      '#f59e0b', 'expense'),
    ('Transport',              'car',           '#3b82f6', 'expense'),
    ('Housing & Utilities',    'home',          '#6366f1', 'expense'),
    ('Entertainment',          'film',          '#ec4899', 'expense'),
    ('Health & Wellness',      'heart',         '#ef4444', 'expense'),
    ('Shopping',               'shopping-bag',  '#8b5cf6', 'expense'),
    ('General Expense',        'tag',           '#64748b', 'expense'),
    ('Salary',                 'briefcase',     '#10b981', 'income'),
    ('Freelance / Contract',   'laptop',        '#059669', 'income'),
    ('Investments & Dividends','trending-up',   '#3b82f6', 'income'),
    ('Business & Sales',       'store',         '#6366f1', 'income'),
    ('Gifts & Bonuses',        'gift',          '#ec4899', 'income'),
    ('Rental Income',          'home',          '#8b5cf6', 'income'),
    ('Other Income',           'plus-circle',   '#14b8a6', 'income')
  ) as d(name, icon, color, type)
  where not exists (
    select 1
    from public.categories c
    where c.user_id = target_user_id
      and lower(c.name) = lower(d.name)
      and c.type = d.type
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. SEED ACCOUNTS + CATEGORIES WHENEVER A PROFILE IS CREATED
-- ------------------------------------------------------------------------------
-- `ensure_user_profile`, `set_user_pin` and the signup trigger all insert a
-- profile, so this single trigger guarantees every new account starts with its
-- own isolated accounts and categories.
create or replace function public.trg_seed_user_defaults_on_profile_create()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.seed_default_accounts_for_user(new.id);
  perform public.seed_default_categories_for_user(new.id);
  return new;
end;
$$;

drop trigger if exists trg_profile_seed_accounts on public.profiles;
drop trigger if exists trg_profile_seed_user_defaults on public.profiles;
create trigger trg_profile_seed_user_defaults
  after insert on public.profiles
  for each row execute function public.trg_seed_user_defaults_on_profile_create();

-- Keep the RPC used by the app working and make it seed defaults too.
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
    select email, raw_user_meta_data->>'full_name' into u_email, u_name
    from auth.users where id = u_id;

    insert into public.profiles (id, email, full_name, currency, has_pin, pin_enabled)
    values (
      u_id,
      u_email,
      coalesce(u_name, split_part(coalesce(u_email, 'user'), '@', 1)),
      'BDT',
      false,
      false
    )
    returning * into prof;
  end if;

  -- Defensive: make sure accounts/categories exist even for older profiles that
  -- were created before this migration.
  perform public.seed_default_accounts_for_user(u_id);
  perform public.seed_default_categories_for_user(u_id);

  return row_to_json(prof);
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. BACKFILL EXISTING USERS
-- ------------------------------------------------------------------------------
-- 4a. Ensure a profile exists for every auth user.
insert into public.profiles (id, email, full_name, currency, has_pin, pin_enabled)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    split_part(coalesce(u.email, 'user'), '@', 1)
  ),
  'BDT',
  false,
  false
from auth.users u
on conflict (id) do nothing;

-- 4b. Create each user's own defaults.
do $$
declare
  u record;
begin
  for u in select id from auth.users loop
    perform public.seed_default_accounts_for_user(u.id);
    perform public.seed_default_categories_for_user(u.id);
  end loop;
end $$;

-- 4c. Re-point existing transactions from shared global categories to the
--     matching category owned by the user who owns the transaction.
update public.expenses e
set category_id = (
  select cu.id
  from public.categories cu
  join public.categories cg
    on lower(cu.name) = lower(cg.name)
   and cu.type = cg.type
  where cu.user_id = e.user_id
    and cg.id = e.category_id
    and cg.user_id is null
  limit 1
)
where e.category_id in (
  select id from public.categories where user_id is null
);

-- 4d. Re-point budgets in the same way.
update public.budgets b
set category_id = (
  select cu.id
  from public.categories cu
  join public.categories cg
    on lower(cu.name) = lower(cg.name)
   and cu.type = cg.type
  where cu.user_id = b.user_id
    and cg.id = b.category_id
    and cg.user_id is null
  limit 1
)
where b.category_id in (
  select id from public.categories where user_id is null
);

-- 4e. Remove the old global default categories once nothing references them.
delete from public.categories c
where c.user_id is null
  and c.is_default = true
  and not exists (select 1 from public.expenses e where e.category_id = c.id)
  and not exists (select 1 from public.budgets b where b.category_id = c.id);

-- ------------------------------------------------------------------------------
-- 5. RE-ASSERT ROW LEVEL SECURITY & OWNERSHIP POLICIES
-- ------------------------------------------------------------------------------

-- Categories: each user sees and manages only their own rows. The global
-- fallback is kept so apps that still have a shared default row keep working.
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
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own categories" on public.categories;
create policy "Users can delete their own categories"
  on public.categories for delete
  using (auth.uid() = user_id);

-- Accounts
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
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own accounts" on public.accounts;
create policy "Users can delete own accounts"
  on public.accounts for delete
  using (auth.uid() = user_id);

-- Expenses / transactions
alter table public.expenses enable row level security;

drop policy if exists "Users can manage their own expenses" on public.expenses;
create policy "Users can manage their own expenses"
  on public.expenses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Budgets
alter table public.budgets enable row level security;

drop policy if exists "Users can manage their own budgets" on public.budgets;
create policy "Users can manage their own budgets"
  on public.budgets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Contacts / receivable-payable ledger
-- (created here defensively for databases that applied an older schema before
-- the contacts feature existed)
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
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own contacts" on public.contacts;
create policy "Users can delete own contacts"
  on public.contacts for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 6. INDEXES FOR PER-USER QUERIES
-- ------------------------------------------------------------------------------
create index if not exists idx_categories_user_id on public.categories(user_id);
create index if not exists idx_categories_user_type on public.categories(user_id, type);
create index if not exists idx_accounts_user_id on public.accounts(user_id);
create index if not exists idx_expenses_user_id on public.expenses(user_id);
create index if not exists idx_expenses_user_date on public.expenses(user_id, date desc);
create index if not exists idx_expenses_user_category on public.expenses(user_id, category_id);
create index if not exists idx_budgets_user_id on public.budgets(user_id);
create index if not exists idx_budgets_user_period on public.budgets(user_id, year, month);
create index if not exists idx_contacts_user_id on public.contacts(user_id);

-- ------------------------------------------------------------------------------
-- 7. HARDEN THE DESTRUCTIVE "RESET ALL" FUNCTION
-- ------------------------------------------------------------------------------
-- `reset_all_transactions()` truncates the whole expenses table. It must never
-- be callable by a normal authenticated user in a multi-user database.
revoke execute on function public.reset_all_transactions() from public;
revoke execute on function public.reset_all_transactions() from anon;
revoke execute on function public.reset_all_transactions() from authenticated;
grant execute on function public.reset_all_transactions() to service_role;

-- Per-user reset remains available to authenticated users and only touches the
-- caller's own rows.
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
    'message', 'Your transactions have been deleted and your account balances restored.'
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 8. GRANTS / ROLE PERMISSIONS
-- ------------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- Personal data is for authenticated users only. Anonymous visitors must not be
-- able to query profiles/accounts/transactions/budgets/contacts at all.
revoke all on table public.profiles   from anon;
revoke all on table public.accounts   from anon;
revoke all on table public.expenses   from anon;
revoke all on table public.budgets    from anon;
revoke all on table public.contacts   from anon;

grant all privileges on table public.profiles  to authenticated, service_role;
grant all privileges on table public.categories to authenticated, service_role;
grant all privileges on table public.accounts  to authenticated, service_role;
grant all privileges on table public.expenses  to authenticated, service_role;
grant all privileges on table public.budgets   to authenticated, service_role;
grant all privileges on table public.contacts  to authenticated, service_role;

grant select on table public.categories to anon;

grant all on all sequences in schema public to authenticated, service_role;

grant execute on function public.ensure_user_profile() to authenticated, service_role;
grant execute on function public.set_user_pin(text) to authenticated, service_role;
grant execute on function public.verify_user_pin(text) to authenticated, service_role;
grant execute on function public.disable_user_pin(text) to authenticated, service_role;
grant execute on function public.seed_default_accounts_for_user(uuid) to authenticated, service_role;
grant execute on function public.seed_default_categories_for_user(uuid) to authenticated, service_role;
grant execute on function public.transfer_between_accounts(uuid, uuid, numeric, text, date) to authenticated, service_role;
grant execute on function public.adjust_account_balance(uuid, numeric, text, text, text, date) to authenticated, service_role;
grant execute on function public.recalculate_account_balance(uuid) to authenticated, service_role;
grant execute on function public.get_accounting_summary(date, date) to authenticated, service_role;
grant execute on function public.get_category_monthly_usage(integer, integer) to authenticated, service_role;
grant execute on function public.reset_user_transactions() to authenticated, service_role;
grant execute on function public.record_debt_transaction(uuid, uuid, numeric, text, text, text, date, date) to authenticated, service_role;

-- ==============================================================================
-- 9. CALCULATION LOGIC FIXES (idempotent)
-- ==============================================================================

-- Only the owning user may recalculate an account balance directly.
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

-- Accounting summary counts signed adjustments consistently with the client.
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

-- Budget usage ignores balance adjustments; otherwise negative adjustments
-- would reduce reported spending and positive ones would inflate it.
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

-- Persist the optional due date when recording a debt through the RPC.
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

  select name, phone into v_contact_name, v_contact_phone
  from public.contacts
  where id = p_contact_id and user_id = curr_user_id;

  if v_contact_phone is null then
    return json_build_object('success', false, 'error', 'Contact not found or access denied');
  end if;

  select name into v_account_name
  from public.accounts
  where id = p_account_id and user_id = curr_user_id;

  if v_account_name is null then
    return json_build_object('success', false, 'error', 'Account not found or access denied');
  end if;

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

  perform public.recalculate_account_balance(p_account_id);

  return json_build_object(
    'success', true,
    'id', v_rec_id
  );
end;
$$;

-- ==============================================================================
-- DONE. Every account now owns an isolated profile, accounts, categories,
-- transactions, budgets and contacts. New signups are seeded automatically.
-- ==============================================================================
