-- Canonical Ekonomi SMKTM syllabus taxonomy (6 chapters, 16 subchapters).
create table if not exists public.syllabus_chapters (
  id uuid primary key default gen_random_uuid(),
  chapter_number smallint not null unique check (chapter_number between 1 and 6),
  title text not null unique check (length(trim(title)) between 2 and 160),
  display_order smallint not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.syllabus_topics (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.syllabus_chapters(id) on delete restrict,
  topic_code text not null unique check (topic_code ~ '^[1-6]\.[1-9][0-9]*$'),
  title text not null check (length(trim(title)) between 2 and 200),
  display_order smallint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chapter_id, display_order),
  unique (chapter_id, title)
);

create index if not exists syllabus_topics_chapter_order_idx
  on public.syllabus_topics(chapter_id, display_order);

alter table public.syllabus_chapters enable row level security;
alter table public.syllabus_topics enable row level security;
revoke all on table public.syllabus_chapters from public, anon, authenticated;
revoke all on table public.syllabus_topics from public, anon, authenticated;
grant select on table public.syllabus_chapters to authenticated;
grant select on table public.syllabus_topics to authenticated;
grant all on table public.syllabus_chapters to service_role;
grant all on table public.syllabus_topics to service_role;

drop policy if exists "Authenticated users can read syllabus chapters" on public.syllabus_chapters;
create policy "Authenticated users can read syllabus chapters"
  on public.syllabus_chapters for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can read syllabus topics" on public.syllabus_topics;
create policy "Authenticated users can read syllabus topics"
  on public.syllabus_topics for select to authenticated
  using ((select auth.uid()) is not null);

insert into public.syllabus_chapters(chapter_number,title,display_order,is_active) values
  (1,'PENGENALAN KEPADA EKONOMI',1,true),
  (2,'PASARAN',2,true),
  (3,'PENDAPATAN INDIVIDU',3,true),
  (4,'PENGELUARAN',4,true),
  (5,'EKONOMI DAN KERAJAAN',5,true),
  (6,'MALAYSIA DAN EKONOMI GLOBAL',6,true)
on conflict (chapter_number) do update
set title=excluded.title,display_order=excluded.display_order,is_active=true,updated_at=now();

insert into public.syllabus_topics(chapter_id,topic_code,title,display_order,is_active)
select c.id,v.topic_code,v.title,v.display_order,true
from (values
  ('1','1.1','Konsep kekurangan, pilihan dan kos lepas',1),
  ('1','1.2','Sistem ekonomi dan penyelesaian masalah asas ekonomi',2),
  ('2','2.1','Keseimbangan Pasaran',1),
  ('2','2.2','Keanjalan harga',2),
  ('3','3.1','Wang dan Bank',1),
  ('3','3.2','Pendapatan Individu',2),
  ('3','3.3','Penggunaan pendapatan individu',3),
  ('4','4.1','Konsep pengeluaran, kos dan hasil',1),
  ('4','4.2','Produktiviti dan Eksternaliti',2),
  ('5','5.1','Peranan Kerajaan',1),
  ('5','5.2','Penunjuk Ekonomi',2),
  ('5','5.3','Alat Dasar Ekonomi',3),
  ('6','6.1','Globalisasi',1),
  ('6','6.2','Perdagangan Antarabangsa',2),
  ('6','6.3','Imbangan Pembayaran',3),
  ('6','6.4','Kadar Pertukaran Asing',4)
) as v(chapter_number,topic_code,title,display_order)
join public.syllabus_chapters c on c.chapter_number=v.chapter_number::smallint
on conflict (topic_code) do update
set chapter_id=excluded.chapter_id,title=excluded.title,display_order=excluded.display_order,is_active=true,updated_at=now();

alter table public.quiz_questions
  add column if not exists syllabus_topic_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='quiz_questions_syllabus_topic_id_fkey'
      and conrelid='public.quiz_questions'::regclass
  ) then
    alter table public.quiz_questions
      add constraint quiz_questions_syllabus_topic_id_fkey
      foreign key (syllabus_topic_id) references public.syllabus_topics(id) on delete restrict;
  end if;
end $$;

-- There are currently no question records to backfill. Enforce tagging on all questions from now on.
alter table public.quiz_questions
  alter column syllabus_topic_id set not null;

create index if not exists quiz_questions_syllabus_topic_idx
  on public.quiz_questions(syllabus_topic_id);


-- Every quiz is anchored to one canonical syllabus chapter.
alter table public.learning_quizzes
  add column if not exists syllabus_chapter_id uuid
  references public.syllabus_chapters(id) on delete restrict;

-- Backfill legacy quizzes from their existing form-specific chapter association.
update public.learning_quizzes q
set syllabus_chapter_id=sc.id,updated_at=now()
from public.learning_chapters old_chapter
join public.syllabus_chapters sc on sc.chapter_number=old_chapter.chapter_number
where q.chapter_id=old_chapter.id
  and q.syllabus_chapter_id is null;

do $$
begin
  if exists (
    select 1 from public.learning_quizzes
    where syllabus_chapter_id is null
  ) then
    raise exception 'Pautkan semua kuiz kepada bab silibus sebelum menguatkuasakan bab wajib.';
  end if;
end $$;

alter table public.learning_quizzes
  alter column syllabus_chapter_id set not null;

create index if not exists learning_quizzes_syllabus_chapter_idx
  on public.learning_quizzes(syllabus_chapter_id);

-- Enforce that each question's subchapter belongs to the quiz's selected chapter.
create or replace function public.enforce_quiz_question_syllabus_topic()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_quiz_chapter uuid;
  v_topic_chapter uuid;
begin
  select syllabus_chapter_id into v_quiz_chapter
  from public.learning_quizzes
  where id=new.quiz_id;

  select chapter_id into v_topic_chapter
  from public.syllabus_topics
  where id=new.syllabus_topic_id
    and is_active=true;

  if v_quiz_chapter is null or v_topic_chapter is null then
    raise exception 'Bab kuiz dan subbab soalan mesti dipilih daripada katalog silibus aktif.';
  end if;

  if v_quiz_chapter <> v_topic_chapter then
    raise exception 'Subbab soalan mesti berada di bawah bab silibus yang dipilih untuk kuiz ini.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_quiz_question_syllabus_topic on public.quiz_questions;
create trigger trg_enforce_quiz_question_syllabus_topic
before insert or update of quiz_id,syllabus_topic_id
on public.quiz_questions
for each row execute function public.enforce_quiz_question_syllabus_topic();

create or replace function public.prevent_quiz_syllabus_chapter_mismatch()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.syllabus_chapter_id is distinct from old.syllabus_chapter_id
    and exists (
      select 1
      from public.quiz_questions q
      join public.syllabus_topics t on t.id=q.syllabus_topic_id
      where q.quiz_id=new.id and t.chapter_id<>new.syllabus_chapter_id
    )
  then
    raise exception 'Bab kuiz tidak boleh diubah selagi soalan berdaftar menggunakan subbab daripada bab lain.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_quiz_syllabus_chapter_mismatch on public.learning_quizzes;
create trigger trg_prevent_quiz_syllabus_chapter_mismatch
before update of syllabus_chapter_id
on public.learning_quizzes
for each row execute function public.prevent_quiz_syllabus_chapter_mismatch();
