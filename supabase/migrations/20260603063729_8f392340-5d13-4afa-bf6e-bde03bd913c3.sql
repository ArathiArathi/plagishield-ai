
-- Roles enum
create type public.app_role as enum ('student', 'faculty', 'institution_admin', 'super_admin');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  institution text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Profiles updatable by owner"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

create policy "Profiles insertable by owner"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

-- Security definer role checker
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Users can view their own roles"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

create policy "Super admins can view all roles"
  on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

create policy "Super admins can manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- Auto-create profile + default student role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _role public.app_role;
begin
  insert into public.profiles (id, first_name, last_name, institution)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'institution'
  );

  begin
    _role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'student');
  exception when others then
    _role := 'student';
  end;

  -- Prevent self-assignment of elevated roles at signup
  if _role not in ('student', 'faculty', 'institution_admin') then
    _role := 'student';
  end if;

  insert into public.user_roles (user_id, role) values (new.id, _role);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();
