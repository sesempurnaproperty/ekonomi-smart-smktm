-- Optional image attachment for quiz questions, stored in a private bucket.
alter table public.quiz_questions
  add column if not exists image_path text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='quiz_questions_image_path_prefix_check'
      and conrelid='public.quiz_questions'::regclass
  ) then
    alter table public.quiz_questions
      add constraint quiz_questions_image_path_prefix_check
      check (
        image_path is null
        or left(image_path, length(quiz_id::text) + 1) = quiz_id::text || '/'
      );
  end if;
end $$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'quiz-question-images',
  'quiz-question-images',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public=false,
    file_size_limit=5242880,
    allowed_mime_types=array['image/jpeg','image/png','image/webp']::text[];

drop policy if exists "Quiz question images upload by quiz owner" on storage.objects;
create policy "Quiz question images upload by quiz owner"
on storage.objects for insert to authenticated
with check (
  bucket_id='quiz-question-images'
  and exists (
    select 1
    from public.learning_quizzes q
    join public.user_profiles p on p.user_id=(select auth.uid())
    where q.id::text=(storage.foldername(name))[1]
      and p.is_active=true
      and (
        p.role='admin'
        or (p.role='teacher' and q.created_by=p.user_id)
      )
  )
);

drop policy if exists "Quiz question images view by eligible users" on storage.objects;
create policy "Quiz question images view by eligible users"
on storage.objects for select to authenticated
using (
  bucket_id='quiz-question-images'
  and exists (
    select 1
    from public.learning_quizzes q
    join public.user_profiles p on p.user_id=(select auth.uid())
    where q.id::text=(storage.foldername(name))[1]
      and p.is_active=true
      and (
        p.role='admin'
        or (
          p.role='teacher'
          and (
            q.created_by=p.user_id
            or q.created_by=p.user_id
          )
        )
        or (
          p.role='student'
          and (
            (
              q.status='published'
              and (q.available_from is null or q.available_from<=now())
              and (q.available_until is null or q.available_until>now())
              and (q.target_form_level is null or q.target_form_level=p.form_level)
            )
            or exists (
              select 1 from public.quiz_attempts qa
              where qa.quiz_id=q.id and qa.student_id=p.user_id
            )
          )
        )
      )
  )
);

drop policy if exists "Quiz question images delete by quiz owner" on storage.objects;
create policy "Quiz question images delete by quiz owner"
on storage.objects for delete to authenticated
using (
  bucket_id='quiz-question-images'
  and exists (
    select 1
    from public.learning_quizzes q
    join public.user_profiles p on p.user_id=(select auth.uid())
    where q.id::text=(storage.foldername(name))[1]
      and p.is_active=true
      and (
        p.role='admin'
        or (p.role='teacher' and q.created_by=p.user_id)
      )
  )
);

comment on column public.quiz_questions.image_path is
  'Optional private Supabase Storage path for an image-based question or figure.';
