-- ==============================================================================
-- FIX PERMISSIONS FOR EXPENSE TRACKER (Run this in Supabase SQL Editor)
-- ==============================================================================

-- 1. Grant Schema Usage to all roles
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

-- 2. Grant Table Permissions to authenticated and anon
grant all privileges on table public.profiles to authenticated, service_role;
grant select on table public.profiles to anon;

grant all privileges on table public.categories to authenticated, service_role;
grant select on table public.categories to anon;

grant all privileges on table public.expenses to authenticated, service_role;
grant select on table public.expenses to anon;

grant all privileges on table public.budgets to authenticated, service_role;
grant select on table public.budgets to anon;

grant all privileges on table public.accounts to authenticated, service_role;
grant select on table public.accounts to anon;

-- 3. Grant Sequences & Functions Permissions
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

-- 4. Ensure Row Level Security (RLS) Policies on profiles
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

-- 5. Backfill existing user profile so id matches auth.users
insert into public.profiles (id, email, full_name, has_pin, pin_enabled)
select 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'full_name', split_part(coalesce(email, 'user'), '@', 1)),
  false,
  false
from auth.users
on conflict (id) do nothing;

-- 6. Ensure secure RPC for profile creation with SECURITY DEFINER
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

grant execute on function public.ensure_user_profile() to authenticated, service_role;
