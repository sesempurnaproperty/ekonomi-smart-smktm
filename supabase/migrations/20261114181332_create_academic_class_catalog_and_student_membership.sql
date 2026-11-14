-- EKONOMI SMART SMKTM: canonical class catalogue and student membership.
-- Existing user_profiles rows and Auth accounts are preserved.
create table public.academic_classes (
  id uuid primary key default gen_random_uuid(),
  form_level smallint not null check (form_level in (4,5)),
  class_name text not null check (length(trim(class_name)) between 1 and 60),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index academic_classes_level_name_unique
  on public.academic_classes (form_level, lower(trim(class_name)));

alter table public.academic_classes enable row level security;
revoke all on table public.academic_classes from anon, authenticated;
grant all on table public.academic_classes to service_role;

alter table public.user_profiles
  add column if not exists academic_class_id uuid
  references public.academic_classes(id) on delete restrict;

insert into public.academic_classes (form_level, class_name)
select distinct form_level, trim(class_name)
from public.user_profiles
where role = 'student'
  and form_level in (4,5)
  and nullif(trim(class_name), '') is not null
on conflict do nothing;

update public.user_profiles p
set academic_class_id = c.id
from public.academic_classes c
where p.role = 'student'
  and p.form_level = c.form_level
  and lower(trim(p.class_name)) = lower(trim(c.class_name))
  and p.academic_class_id is null;

create or replace function public.admin_rename_academic_class(
  p_class_id uuid,
  p_new_class_name text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_level smallint;
begin
  if p_new_class_name is null
     or length(trim(p_new_class_name)) < 1
     or length(trim(p_new_class_name)) > 60 then
    raise exception 'Nama kelas mesti antara 1 hingga 60 aksara.';
  end if;

  select form_level into v_level
  from public.academic_classes
  where id = p_class_id
  for update;

  if not found then
    return false;
  end if;

  if exists (
    select 1
    from public.academic_classes
    where form_level = v_level
      and lower(trim(class_name)) = lower(trim(p_new_class_name))
      and id <> p_class_id
  ) then
    raise exception 'Nama kelas tersebut sudah digunakan untuk tingkatan ini.';
  end if;

  update public.academic_classes
  set class_name = trim(p_new_class_name),
      updated_at = now()
  where id = p_class_id;

  update public.user_profiles
  set class_name = trim(p_new_class_name),
      updated_at = now()
  where academic_class_id = p_class_id;

  return true;
end;
$$;

revoke all on function public.admin_rename_academic_class(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_rename_academic_class(uuid, text) to service_role;
