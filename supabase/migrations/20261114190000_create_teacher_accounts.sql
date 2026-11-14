-- EKONOMI SMART SMKTM: teacher username-to-Auth mapping.
-- Passwords remain exclusively in Supabase Auth and are never stored here.

create table public.teacher_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_accounts_username_format
    check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  constraint teacher_accounts_display_name_nonempty
    check (length(trim(display_name)) between 2 and 100)
);

create unique index teacher_accounts_username_unique
  on public.teacher_accounts (username);

alter table public.teacher_accounts enable row level security;

revoke all on table public.teacher_accounts from anon, authenticated;
grant select on table public.teacher_accounts to authenticated;

create policy "Teachers can read their own account"
  on public.teacher_accounts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.teacher_accounts is
  'Private teacher login mapping. Supabase Auth stores passwords; this table stores usernames and teacher profile metadata only.';

comment on column public.teacher_accounts.user_id is
  'References the internal Supabase Auth user id.';

comment on column public.teacher_accounts.username is
  'Unique lowercase teacher username used by the login gateway.';
