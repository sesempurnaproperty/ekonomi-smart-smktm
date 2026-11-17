alter table public.quiz_responses
  add column if not exists marking_annotations jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quiz_responses_marking_annotations_array_check'
      and conrelid = 'public.quiz_responses'::regclass
  ) then
    alter table public.quiz_responses
      add constraint quiz_responses_marking_annotations_array_check
      check (jsonb_typeof(marking_annotations) = 'array');
  end if;
end $$;

comment on column public.quiz_responses.marking_annotations is
  'Teacher inline marking annotations for structured answers: exact UTF-16 answer offsets and marker type (right, wrong, tr, repeat).';
