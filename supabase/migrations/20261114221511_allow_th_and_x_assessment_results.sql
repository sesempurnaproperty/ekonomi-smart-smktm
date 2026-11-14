-- Allow TH (absent) and X result codes for PPT2026/PAT2026.
-- A result is either a numeric score or one status code, never both.
alter table public.student_assessment_marks
  alter column score drop not null;

alter table public.student_assessment_marks
  add column if not exists mark_status text;

alter table public.student_assessment_marks
  drop constraint if exists student_assessment_marks_score_or_status_check;

alter table public.student_assessment_marks
  add constraint student_assessment_marks_score_or_status_check
  check (
    (score is not null and mark_status is null)
    or
    (score is null and mark_status in ('TH', 'X'))
  );

alter table public.student_assessment_marks
  drop constraint if exists student_assessment_marks_score_check;

alter table public.student_assessment_marks
  add constraint student_assessment_marks_score_check
  check (score is null or (score >= 0 and score <= 1000));

revoke all on table public.student_assessment_marks from public, anon, authenticated;
grant all on table public.student_assessment_marks to service_role;

comment on column public.student_assessment_marks.mark_status is
  'Non-numeric assessment result: TH (absent, grade T) or X (grade x). Numeric score must be null when this field is populated.';
