-- Enable pgcrypto for secure PIN hashing
create extension if not exists pgcrypto with schema extensions;

-- 1. PROFILES TABLE (User Module with PIN support)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  has_pin boolean default false not null,
  pin_hash text,
  pin_enabled boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Policies for profiles
create policy "Users can view their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- Backfill any existing users in auth.users that don't have a profile yet
insert into public.profiles (id, email, full_name)
select 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;


-- Function to handle new user registration automatically
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

-- Trigger to create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. SECURE 5-DIGIT PIN FUNCTIONS (RPC)

-- Function: Set or Update 5-Digit PIN
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

  -- Validate exactly 5 digits
  if pin_input !~ '^[0-9]{5}$' then
    return json_build_object('success', false, 'error', 'PIN must be exactly 5 digits');
  end if;

  -- Ensure profile exists and set PIN
  insert into public.profiles (id, email, full_name, has_pin, pin_enabled, pin_hash)
  values (
    user_id,
    (select email from auth.users where id = user_id),
    (select coalesce(raw_user_meta_data->>'full_name', split_part(coalesce(email, 'user'), '@', 1)) from auth.users where id = user_id),
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

-- Function: Verify 5-Digit PIN
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

-- Function: Disable/Remove 5-Digit PIN
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

-- Function: Ensure user profile exists for authenticated user
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
    insert into public.profiles (id, email, full_name, has_pin, pin_enabled)
    values (u_id, u_email, coalesce(u_name, split_part(coalesce(u_email, 'user'), '@', 1)), false, false)
    returning * into prof;
  end if;

  return row_to_json(prof);
end;
$$;

-- 3. EXPENSE TRACKING SCHEMA

-- Categories Table
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade, -- null means global default category
  name text not null,
  icon text default 'tag',
  color text default '#10b981',
  type text check (type in ('expense', 'income', 'both')) default 'expense',
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.categories enable row level security;

create policy "Users can view default categories and their own"
  on public.categories for select
  using (user_id is null or auth.uid() = user_id);

create policy "Users can insert their own categories"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own categories"
  on public.categories for update
  using (auth.uid() = user_id);

create policy "Users can delete their own categories"
  on public.categories for delete
  using (auth.uid() = user_id);

-- Expenses & Transactions Table
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  category_id uuid references public.categories on delete set null,
  title text not null,
  amount numeric(12, 2) not null,
  type text check (type in ('expense', 'income')) default 'expense' not null,
  currency text default 'USD' not null,
  date date default current_date not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.expenses enable row level security;

create policy "Users can manage their own expenses"
  on public.expenses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Budgets Table
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  category_id uuid references public.categories on delete cascade,
  amount numeric(12, 2) not null,
  month integer not null check (month between 1 and 12),
  year integer not null check (year >= 2020),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, category_id, month, year)
);

alter table public.budgets enable row level security;

create policy "Users can manage their own budgets"
  on public.budgets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. DEFAULT CATEGORIES SEED (Expense & Income)
insert into public.categories (name, icon, color, is_default, type)
values
  ('Groceries', 'shopping-cart', '#10b981', true, 'expense'),
  ('Food & Dining', 'utensils', '#f59e0b', true, 'expense'),
  ('Transport', 'car', '#3b82f6', true, 'expense'),
  ('Housing & Utilities', 'home', '#6366f1', true, 'expense'),
  ('Entertainment', 'film', '#ec4899', true, 'expense'),
  ('Health & Wellness', 'heart', '#ef4444', true, 'expense'),
  ('Shopping', 'shopping-bag', '#8b5cf6', true, 'expense'),
  ('General Expense', 'tag', '#64748b', true, 'expense'),
  ('Salary', 'briefcase', '#10b981', true, 'income'),
  ('Freelance / Contract', 'laptop', '#059669', true, 'income'),
  ('Investments & Dividends', 'trending-up', '#3b82f6', true, 'income'),
  ('Business & Sales', 'store', '#6366f1', true, 'income'),
  ('Gifts & Bonuses', 'gift', '#ec4899', true, 'income'),
  ('Rental Income', 'home', '#8b5cf6', true, 'income'),
  ('Other Income', 'plus-circle', '#14b8a6', true, 'income')
on conflict do nothing;

-- 5. GRANTS & PERMISSIONS FOR SUPABASE ROLES
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

grant all privileges on table public.profiles to authenticated, service_role;
grant select on table public.profiles to anon;

grant all privileges on table public.categories to authenticated, service_role;
grant select on table public.categories to anon;

grant all privileges on table public.expenses to authenticated, service_role;
grant select on table public.expenses to anon;

grant all privileges on table public.budgets to authenticated, service_role;
grant select on table public.budgets to anon;

grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;


