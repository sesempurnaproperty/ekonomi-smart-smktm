-- Assign one active teacher reviewer to each Ekonomi class.
-- One teacher may handle multiple classes; each class has one lead reviewer.

create table if not exists public.class_teacher_assignments (
  class_id uuid primary key references public.academic_classes(id) on delete cascade,
  teacher_user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  assigned_by uuid references public.user_profiles(user_id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists class_teacher_assignments_teacher_idx
  on public.class_teacher_assignments (teacher_user_id);

alter table public.class_teacher_assignments enable row level security;
revoke all on table public.class_teacher_assignments from public, anon, authenticated;
grant all on table public.class_teacher_assignments to service_role;

insert into public.academic_classes (form_level, class_name, is_active)
select 4, v.class_name, true
from (values ('Damai'), ('Cekal')) as v(class_name)
where not exists (
  select 1 from public.academic_classes c
  where c.form_level = 4 and lower(c.class_name) = lower(v.class_name)
);

insert into public.class_teacher_assignments (class_id, teacher_user_id, assigned_by, assigned_at, updated_at)
select
  c.id,
  t.user_id,
  a.user_id,
  now(),
  now()
from public.academic_classes c
join public.user_profiles t
  on t.role = 'teacher'
 and t.is_active = true
 and (
   (lower(c.class_name) = 'damai' and t.username = 'cikguikmal')
   or
   (lower(c.class_name) = 'cekal' and t.username = 'cikguwana')
 )
cross join lateral (
  select user_id
  from public.user_profiles
  where role = 'admin' and is_active = true
  order by created_at
  limit 1
) a
where c.form_level in (4, 5)
  and lower(c.class_name) in ('damai', 'cekal')
  and c.is_active = true
on conflict (class_id) do update
set teacher_user_id = excluded.teacher_user_id,
    assigned_by = excluded.assigned_by,
    assigned_at = now(),
    updated_at = now();
