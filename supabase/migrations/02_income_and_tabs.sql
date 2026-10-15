-- ==============================================================================
-- MIGRATION: 02_income_and_tabs.sql
-- Adds Income support, category types, and seeds for Expense Tracker
-- ==============================================================================

-- 1. Add `type` column to categories ('expense', 'income', 'both')
alter table public.categories 
add column if not exists type text check (type in ('expense', 'income', 'both')) default 'expense';

-- 2. Add `type` column to expenses ('expense', 'income')
alter table public.expenses 
add column if not exists type text check (type in ('expense', 'income')) default 'expense';

-- 3. Add `currency` column to profiles if missing
alter table public.profiles
add column if not exists currency text default 'USD';

-- 4. Seed Default Income Categories
insert into public.categories (name, icon, color, is_default, type)
values
  ('Salary', 'briefcase', '#10b981', true, 'income'),
  ('Freelance / Contract', 'laptop', '#059669', true, 'income'),
  ('Investments & Dividends', 'trending-up', '#3b82f6', true, 'income'),
  ('Business & Sales', 'store', '#6366f1', true, 'income'),
  ('Gifts & Bonuses', 'gift', '#ec4899', true, 'income'),
  ('Rental Income', 'home', '#8b5cf6', true, 'income'),
  ('Other Income', 'plus-circle', '#14b8a6', true, 'income')
on conflict do nothing;

-- 5. Update Existing Default Expense Categories type
update public.categories
set type = 'expense'
where type is null or type = 'expense';

-- 6. Ensure permissions are granted for updated tables
grant all privileges on table public.profiles to authenticated, service_role;
grant select on table public.profiles to anon;

grant all privileges on table public.categories to authenticated, service_role;
grant select on table public.categories to anon;

grant all privileges on table public.expenses to authenticated, service_role;
grant select on table public.expenses to anon;

grant all privileges on table public.budgets to authenticated, service_role;
grant select on table public.budgets to anon;
