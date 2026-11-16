-- Quiz assessment engine: authoring, student attempts and secure grading.
create table public.learning_quizzes (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 2 and 200),
 description text,
 target_form_level smallint check (target_form_level is null or target_form_level in (4,5)),
 chapter_id uuid references public.learning_chapters(id) on delete set null,
 duration_minutes smallint check (duration_minutes is null or duration_minutes between 5 and 240),
 attempt_limit smallint not null default 1 check (attempt_limit between 1 and 5),
 available_from timestamptz,
 available_until timestamptz,
 status text not null default 'draft' check (status in ('draft','published','archived')),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (available_from is null or available_until is null or available_until > available_from)
);
create index learning_quizzes_status_form_idx on public.learning_quizzes(status,target_form_level,created_at desc);
create index learning_quizzes_chapter_idx on public.learning_quizzes(chapter_id);

create table public.quiz_questions (
 id uuid primary key default gen_random_uuid(),
 quiz_id uuid not null references public.learning_quizzes(id) on delete cascade,
 question_order integer not null check (question_order > 0),
 question_type text not null check (question_type in ('objective','structured')),
 prompt text not null check (length(trim(prompt)) >= 2),
 marks numeric(7,2) not null default 1 check (marks > 0 and marks <= 1000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (quiz_id,question_order)
);
create index quiz_questions_quiz_order_idx on public.quiz_questions(quiz_id,question_order);

create table public.quiz_options (
 id uuid primary key default gen_random_uuid(),
 question_id uuid not null references public.quiz_questions(id) on delete cascade,
 option_code text not null check (option_code in ('A','B','C','D','E','F')),
 option_text text not null check (length(trim(option_text)) >= 1),
 option_order smallint not null check (option_order between 1 and 6),
 unique (question_id,option_code),
 unique (question_id,option_order),
 unique (id,question_id)
);
create index quiz_options_question_order_idx on public.quiz_options(question_id,option_order);

create table public.quiz_answer_keys (
 question_id uuid primary key references public.quiz_questions(id) on delete cascade,
 correct_option_id uuid,
 marking_guide text,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 foreign key (correct_option_id,question_id) references public.quiz_options(id,question_id) on delete cascade
);

create table public.quiz_attempts (
 id uuid primary key default gen_random_uuid(),
 quiz_id uuid not null references public.learning_quizzes(id) on delete restrict,
 student_id uuid not null references public.user_profiles(user_id) on delete cascade,
 attempt_number smallint not null check (attempt_number between 1 and 5),
 status text not null default 'in_progress' check (status in ('in_progress','pending_review','graded')),
 started_at timestamptz not null default now(),
 submitted_at timestamptz,
 objective_score numeric(8,2) not null default 0 check (objective_score >= 0),
 teacher_score numeric(8,2),
 total_score numeric(8,2) not null default 0 check (total_score >= 0),
 max_score numeric(8,2) not null check (max_score > 0),
 graded_at timestamptz,
 unique (quiz_id,student_id,attempt_number)
);
create index quiz_attempts_student_quiz_idx on public.quiz_attempts(student_id,quiz_id,attempt_number desc);
create index quiz_attempts_quiz_status_idx on public.quiz_attempts(quiz_id,status,submitted_at desc);

create table public.quiz_responses (
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
 question_id uuid not null references public.quiz_questions(id) on delete restrict,
 selected_option_id uuid references public.quiz_options(id) on delete set null,
 response_text text,
 auto_score numeric(8,2),
 teacher_score numeric(8,2),
 feedback text,
 updated_at timestamptz not null default now(),
 unique (attempt_id,question_id)
);
create index quiz_responses_attempt_idx on public.quiz_responses(attempt_id);
create index quiz_responses_question_idx on public.quiz_responses(question_id);

alter table public.learning_quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_responses enable row level security;

revoke all on table public.learning_quizzes,public.quiz_questions,public.quiz_options,public.quiz_answer_keys,public.quiz_attempts,public.quiz_responses from public,anon,authenticated;
grant select,insert,update,delete on public.learning_quizzes to authenticated;
grant select,insert,update,delete on public.quiz_questions to authenticated;
grant select,insert,update,delete on public.quiz_options to authenticated;
grant select on public.quiz_attempts,public.quiz_responses to authenticated;
grant all on public.learning_quizzes,public.quiz_questions,public.quiz_options,public.quiz_answer_keys,public.quiz_attempts,public.quiz_responses to service_role;

create policy "Staff manage learning quizzes" on public.learning_quizzes for all to authenticated
using (exists(select 1 from public.user_profiles p where p.user_id=(select auth.uid()) and p.is_active=true and p.role in ('admin','teacher')))
with check (exists(select 1 from public.user_profiles p where p.user_id=(select auth.uid()) and p.is_active=true and p.role in ('admin','teacher')));
create policy "Students read published eligible quizzes" on public.learning_quizzes for select to authenticated using (
 status='published' and (available_from is null or available_from<=now()) and (available_until is null or available_until>now())
 and exists(select 1 from public.user_profiles p where p.user_id=(select auth.uid()) and p.is_active=true and p.role='student' and p.form_level in (4,5)
 and (learning_quizzes.target_form_level is null or learning_quizzes.target_form_level=p.form_level))
);

create policy "Staff manage quiz questions" on public.quiz_questions for all to authenticated
using (exists(select 1 from public.learning_quizzes q join public.user_profiles p on p.user_id=(select auth.uid()) where q.id=quiz_questions.quiz_id and p.is_active=true and p.role in ('admin','teacher')))
with check (exists(select 1 from public.learning_quizzes q join public.user_profiles p on p.user_id=(select auth.uid()) where q.id=quiz_questions.quiz_id and p.is_active=true and p.role in ('admin','teacher')));
create policy "Students read questions from eligible published quizzes" on public.quiz_questions for select to authenticated using (
 exists(select 1 from public.learning_quizzes q join public.user_profiles p on p.user_id=(select auth.uid())
 where q.id=quiz_questions.quiz_id and q.status='published' and (q.available_from is null or q.available_from<=now()) and (q.available_until is null or q.available_until>now())
 and p.is_active=true and p.role='student' and p.form_level in (4,5) and (q.target_form_level is null or q.target_form_level=p.form_level))
);

create policy "Staff manage quiz options" on public.quiz_options for all to authenticated
using (exists(select 1 from public.quiz_questions qq join public.learning_quizzes q on q.id=qq.quiz_id join public.user_profiles p on p.user_id=(select auth.uid())
 where qq.id=quiz_options.question_id and p.is_active=true and p.role in ('admin','teacher')))
with check (exists(select 1 from public.quiz_questions qq join public.learning_quizzes q on q.id=qq.quiz_id join public.user_profiles p on p.user_id=(select auth.uid())
 where qq.id=quiz_options.question_id and p.is_active=true and p.role in ('admin','teacher')));
create policy "Students read options from eligible published quizzes" on public.quiz_options for select to authenticated using (
 exists(select 1 from public.quiz_questions qq join public.learning_quizzes q on q.id=qq.quiz_id join public.user_profiles p on p.user_id=(select auth.uid())
 where qq.id=quiz_options.question_id and q.status='published' and (q.available_from is null or q.available_from<=now()) and (q.available_until is null or q.available_until>now())
 and p.is_active=true and p.role='student' and p.form_level in (4,5) and (q.target_form_level is null or q.target_form_level=p.form_level))
);

-- Answer keys: no authenticated grant or policy. The Edge Function accesses them server-side only.
create policy "Students and staff read permitted quiz attempts" on public.quiz_attempts for select to authenticated using (
 exists(select 1 from public.user_profiles p where p.user_id=(select auth.uid()) and p.is_active=true
 and (p.role in ('admin','teacher') or (p.role='student' and p.user_id=quiz_attempts.student_id))));
create policy "Students and staff read permitted quiz responses" on public.quiz_responses for select to authenticated using (
 exists(select 1 from public.quiz_attempts a join public.user_profiles p on p.user_id=(select auth.uid())
 where a.id=quiz_responses.attempt_id and p.is_active=true and (p.role in ('admin','teacher') or (p.role='student' and p.user_id=a.student_id))));

create or replace function public.set_quiz_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=pg_catalog.now(); return new; end;
$$;
create trigger set_learning_quizzes_updated_at before update on public.learning_quizzes for each row execute function public.set_quiz_updated_at();
create trigger set_quiz_questions_updated_at before update on public.quiz_questions for each row execute function public.set_quiz_updated_at();
create trigger set_quiz_responses_updated_at before update on public.quiz_responses for each row execute function public.set_quiz_updated_at();
revoke all on function public.set_quiz_updated_at() from public,anon,authenticated;

comment on table public.quiz_answer_keys is 'Private answer keys and structured marking guides; never exposed to students.';
comment on table public.quiz_attempts is 'Student quiz attempts and automatic/manual grading summaries.';
comment on table public.quiz_responses is 'Per-question student responses with automatic and teacher-assigned marks.';
