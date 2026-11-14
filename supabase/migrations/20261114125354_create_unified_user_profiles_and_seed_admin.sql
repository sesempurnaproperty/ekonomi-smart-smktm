-- Unified role profiles for EKONOMI SMART SMKTM.
-- Keep legacy teacher_accounts intact; it is not dropped or modified.

create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  full_name text not null,
  role text not null default 'student',
  form_level smallint,
  class_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_role_check
    check (role in ('admin', 'teacher', 'student')),
  constraint user_profiles_username_format
    check (
      username = lower(username)
      and length(username) between 3 and 254
      and (
        username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
        or username ~ '^[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9][a-z0-9.-]{0,187}\.[a-z]{2,24}$'
      )
    ),
  constraint user_profiles_full_name_nonempty
    check (length(trim(full_name)) between 2 and 150),
  constraint user_profiles_form_level_check
    check (form_level is null or form_level in (4, 5)),
  constraint user_profiles_class_name_nonempty
    check (class_name is null or length(trim(class_name)) between 1 and 60)
);

create unique index user_profiles_username_unique
  on public.user_profiles (username);

alter table public.user_profiles enable row level security;

revoke all on table public.user_profiles from anon, authenticated;
grant select on table public.user_profiles to authenticated;

create policy "Users can read their own profile"
  on public.user_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.user_profiles is
  'Central role and profile registry for admins, teachers, and students. Passwords are held only by Supabase Auth.';

comment on column public.user_profiles.role is
  'Trusted system role: admin, teacher, or student. Users cannot self-assign or edit this role.';

insert into public.user_profiles (
  user_id, username, full_name, role, is_active
)
select
  user_id, lower(username), display_name, 'teacher', is_active
from public.teacher_accounts
on conflict do nothing;

insert into public.user_profiles (user_id, username, full_name, role, is_active)
select
  id,
  lower(email),
  'Pentadbir EKONOMI SMART',
  'admin',
  true
from auth.users
where lower(email) = lower('g-27546953@moe-dl.edu.my')
  and email_confirmed_at is not null
on conflict (user_id) do update
set username = excluded.username,
    full_name = excluded.full_name,
    role = 'admin',
    is_active = true,
    updated_at = now();
