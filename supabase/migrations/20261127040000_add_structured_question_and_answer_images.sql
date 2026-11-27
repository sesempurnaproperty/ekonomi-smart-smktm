-- Structured question image support: prompt images, private marking-guide images,
-- and student answer images. Paths are stored separately from private answer keys.
alter table public.quiz_questions
  add column if not exists image_paths text[] not null default '{}';

alter table public.quiz_answer_keys
  add column if not exists marking_guide_image_paths text[] not null default '{}';

alter table public.quiz_responses
  add column if not exists answer_image_paths text[] not null default '{}';

-- Keep the legacy single-image path readable during migration.
update public.quiz_questions
set image_paths = array[image_path]
where image_path is not null
  and coalesce(cardinality(image_paths), 0) = 0;

comment on column public.quiz_questions.image_paths is
  'Storage paths for up to four images attached to a question prompt.';
comment on column public.quiz_answer_keys.marking_guide_image_paths is
  'Private Storage paths for up to four marking-guide images; never exposed to students.';
comment on column public.quiz_responses.answer_image_paths is
  'Storage paths for up to four images submitted by a student as a structured answer.';
