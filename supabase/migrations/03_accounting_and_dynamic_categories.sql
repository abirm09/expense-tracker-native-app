-- ==============================================================================
-- MIGRATION: 03_accounting_and_dynamic_categories.sql
-- Implements:
-- 1. Dynamic Categories with Monthly Limit for Expense Categories
-- 2. Accounting System with Debit/Credit transactions (Debit=Expense, Credit=Income)
-- 3. Stored Procedure (RPC) for Category Monthly Usage & Percentage Calculation
-- 4. Stored Procedure (RPC) for Accounting Ledger Summary (Debits, Credits, Balance)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DYNAMIC CATEGORIES: Add monthly_limit and update constraints
-- ------------------------------------------------------------------------------

-- Add monthly_limit to categories (used for expense budget limits)
alter table public.categories 
add column if not exists monthly_limit numeric(12, 2) default 0.00;

-- Ensure type allows 'expense' and 'income'
alter table public.categories 
drop constraint if exists categories_type_check;

alter table public.categories 
add constraint categories_type_check check (type in ('expense', 'income', 'both'));

-- Ensure RLS allows users to manage their own dynamic categories
alter table public.categories enable row level security;

drop policy if exists "Users can manage their own categories" on public.categories;
create policy "Users can manage their own categories"
  on public.categories
  for all
  using (user_id is null or auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 2. ACCOUNTING SYSTEM: Add entry_type ('debit' / 'credit') to transactions (expenses)
-- ------------------------------------------------------------------------------

-- In accounting (DEALER rule):
-- Debit = Expense / Money Spent
-- Credit = Income / Money Received

alter table public.expenses 
add column if not exists entry_type text check (entry_type in ('debit', 'credit'));

-- Backfill entry_type for existing records
update public.expenses
set entry_type = case 
  when type = 'income' then 'credit'
  else 'debit'
end
where entry_type is null;

-- Trigger to keep `type` and `entry_type` synchronized
create or replace function public.sync_transaction_accounting_type()
returns trigger
language plpgsql
as $$
begin
  -- If entry_type is set, keep type in sync
  if new.entry_type is not null then
    new.type := case when new.entry_type = 'credit' then 'income' else 'expense' end;
  -- If type is set, keep entry_type in sync
  elsif new.type is not null then
    new.entry_type := case when new.type = 'income' then 'credit' else 'debit' end;
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
-- 3. CRITICAL CALCULATION RPC: Monthly Category Usage & Percentage
-- Computes spent sum, limit, percentage usage, and budget status inside Postgres
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
-- 4. ACCOUNTING SUMMARY RPC: Total Debits, Credits & Net Balance
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
    coalesce(sum(case when entry_type = 'debit' or type = 'expense' then amount else 0 end), 0.00),
    coalesce(sum(case when entry_type = 'credit' or type = 'income' then amount else 0 end), 0.00),
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
-- 5. GRANTS & PERMISSIONS
-- ------------------------------------------------------------------------------

grant execute on function public.get_category_monthly_usage(integer, integer) to authenticated, service_role;
grant execute on function public.get_accounting_summary(date, date) to authenticated, service_role;
