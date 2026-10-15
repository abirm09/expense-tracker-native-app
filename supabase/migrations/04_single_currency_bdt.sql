-- ==============================================================================
-- MIGRATION: 04_single_currency_bdt.sql
-- Enforces single currency (BDT - Bangladeshi Taka) across all tables
-- ==============================================================================

-- 1. Alter expenses table currency default to BDT
alter table public.expenses
alter column currency set default 'BDT';

-- 2. Update existing expenses to BDT
update public.expenses
set currency = 'BDT'
where currency is null or currency != 'BDT';

-- 3. Alter profiles table currency default to BDT if column exists
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'currency'
  ) then
    alter table public.profiles alter column currency set default 'BDT';
    update public.profiles set currency = 'BDT' where currency is null or currency != 'BDT';
  end if;
end $$;
