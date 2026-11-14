-- Assessment catalogue for PPT2026 and PAT2026.
create table public.assessment_catalog (
  code text primary key,
  title text not null,
  max_score numeric(7,2) not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_catalog_code_check
    check (code in ('PPT2026','PAT2026')),
  constraint assessment_catalog_max_score_check
    check (max_score > 0 and max_score <= 1000)
);

create table public.student_assessment_marks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.user_profiles(user_id) on delete cascade,
  assessment_code text not null references public.assessment_catalog(code) on update cascade on delete restrict,
  score numeric(7,2) not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_assessment_marks_score_check
    check (score >= 0 and score <= 1000),
  constraint student_assessment_marks_student_assessment_unique
    unique (student_id, assessment_code)
);

create index student_assessment_marks_assessment_idx
  on public.student_assessment_marks (assessment_code);
create index student_assessment_marks_student_idx
  on public.student_assessment_marks (student_id);

alter table public.assessment_catalog enable row level security;
alter table public.student_assessment_marks enable row level security;

revoke all on table public.assessment_catalog from anon, authenticated;
revoke all on table public.student_assessment_marks from anon, authenticated;
grant all on table public.assessment_catalog to service_role;
grant all on table public.student_assessment_marks to service_role;

insert into public.assessment_catalog (code, title, max_score, is_active)
values
  ('PPT2026', 'Pentaksiran Pertengahan Tahun 2026', 100, true),
  ('PAT2026', 'Pentaksiran Akhir Tahun 2026', 100, true)
on conflict (code) do nothing;

comment on table public.assessment_catalog is
  'Assessment definitions and maximum score settings for EKONOMI SMART SMKTM.';
comment on table public.student_assessment_marks is
  'Student marks for each assessment. Passwords and authentication data are never stored here.';
