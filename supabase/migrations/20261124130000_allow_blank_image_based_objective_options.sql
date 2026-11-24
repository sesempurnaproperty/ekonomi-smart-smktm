-- Permit blank objective option text when the A-D choices are already part of the question image.
-- Option rows are retained so the quiz engine can still map each A-D code to an answer key and auto-grade.
alter table public.quiz_options
  drop constraint if exists quiz_options_option_text_check;

alter table public.quiz_options
  add constraint quiz_options_option_text_check
  check (option_text = '' or length(trim(option_text)) >= 1);

comment on column public.quiz_options.option_text is
  'Optional visible option text. Empty string is allowed when the A-D choices are already embedded in the question image.';
