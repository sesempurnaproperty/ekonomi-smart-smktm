-- EKONOMI SMART SMKTM: shared learning library for Form 4 and Form 5.
-- Managers (active admin/teacher) manage chapters and materials.
-- Students read published materials for their own form only.

create table public.learning_chapters (
  id uuid primary key default gen_random_uuid(),
  form_level smallint not null check (form_level in (4, 5)),
  chapter_number smallint not null check (chapter_number > 0),
  title text not null check (length(trim(title)) between 2 and 160),
  description text check (description is null or length(description) <= 600),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_chapters_form_number_unique unique (form_level, chapter_number)
);
create index learning_chapters_form_active_order_idx
  on public.learning_chapters (form_level, is_active, chapter_number);

create table public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.learning_chapters(id) on delete restrict,
  title text not null check (length(trim(title)) between 2 and 200),
  description text check (description is null or length(description) <= 800),
  material_type text not null check (material_type in ('note', 'pdf', 'video', 'link')),
  content text,
  resource_url text,
  storage_path text,
  display_order integer not null default 0,
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_materials_source_check check (
    (material_type = 'note' and nullif(trim(content), '') is not null and resource_url is null and storage_path is null)
    or (material_type = 'pdf' and content is null and resource_url is null and storage_path is not null)
    or (material_type in ('video', 'link') and content is null and resource_url ~ '^https?://' and storage_path is null)
  )
);
create index learning_materials_chapter_order_idx on public.learning_materials (chapter_id, display_order, created_at desc);
create index learning_materials_published_idx on public.learning_materials (is_published, chapter_id);
create unique index learning_materials_storage_path_unique on public.learning_materials (storage_path) where storage_path is not null;

alter table public.learning_chapters enable row level security;
alter table public.learning_materials enable row level security;
revoke all on table public.learning_chapters from public, anon, authenticated;
revoke all on table public.learning_materials from public, anon, authenticated;
grant select, insert, update, delete on table public.learning_chapters to authenticated;
grant select, insert, update, delete on table public.learning_materials to authenticated;
grant all on table public.learning_chapters to service_role;
grant all on table public.learning_materials to service_role;

create policy "Active portal users read relevant learning chapters" on public.learning_chapters
for select to authenticated using (
  exists (select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true
      and (p.role in ('admin', 'teacher')
        or (p.role = 'student' and p.form_level = learning_chapters.form_level and learning_chapters.is_active = true)))
);
create policy "Learning managers insert chapters" on public.learning_chapters
for insert to authenticated with check (
  exists (select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true and p.role in ('admin', 'teacher'))
);
create policy "Learning managers update chapters" on public.learning_chapters
for update to authenticated using (
  exists (select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true and p.role in ('admin', 'teacher'))
) with check (
  exists (select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true and p.role in ('admin', 'teacher'))
);
create policy "Learning managers delete chapters" on public.learning_chapters
for delete to authenticated using (
  exists (select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true and p.role in ('admin', 'teacher'))
);

create policy "Users read published materials for their form" on public.learning_materials
for select to authenticated using (
  exists (select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true and p.role in ('admin', 'teacher'))
  or (is_published = true and exists (
    select 1 from public.user_profiles p
    join public.learning_chapters c on c.form_level = p.form_level
    where p.user_id = (select auth.uid()) and p.is_active = true and p.role = 'student'
      and c.id = learning_materials.chapter_id and c.is_active = true
  ))
);
create policy "Learning managers insert materials" on public.learning_materials
for insert to authenticated with check (
  created_by = (select auth.uid())
  and exists (select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true and p.role in ('admin', 'teacher'))
);
create policy "Learning managers update materials" on public.learning_materials
for update to authenticated using (
  exists (select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true and p.role in ('admin', 'teacher'))
) with check (
  exists (select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true and p.role in ('admin', 'teacher'))
);
create policy "Learning managers delete materials" on public.learning_materials
for delete to authenticated using (
  exists (select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true and p.role in ('admin', 'teacher'))
);

create or replace function public.set_learning_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;
create trigger set_learning_chapters_updated_at before update on public.learning_chapters
for each row execute function public.set_learning_updated_at();
create trigger set_learning_materials_updated_at before update on public.learning_materials
for each row execute function public.set_learning_updated_at();
revoke all on function public.set_learning_updated_at() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('learning-materials', 'learning-materials', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Learning managers upload learning PDFs" on storage.objects
for insert to authenticated with check (
  bucket_id = 'learning-materials'
  and exists (select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true and p.role in ('admin', 'teacher'))
);
create policy "Learning managers and entitled students read learning PDFs" on storage.objects
for select to authenticated using (
  bucket_id = 'learning-materials'
  and (
    exists (select 1 from public.user_profiles p
      where p.user_id = (select auth.uid()) and p.is_active = true and p.role in ('admin', 'teacher'))
    or exists (
      select 1 from public.learning_materials m
      join public.learning_chapters c on c.id = m.chapter_id
      join public.user_profiles p on p.form_level = c.form_level
      where m.storage_path = storage.objects.name and m.material_type = 'pdf'
        and m.is_published = true and c.is_active = true
        and p.user_id = (select auth.uid()) and p.is_active = true and p.role = 'student'
    )
  )
);
create policy "Learning managers update learning PDFs" on storage.objects
for update to authenticated using (
  bucket_id = 'learning-materials'
  and exists (select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true and p.role in ('admin', 'teacher'))
) with check (
  bucket_id = 'learning-materials'
  and exists (select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true and p.role in ('admin', 'teacher'))
);
create policy "Learning managers delete learning PDFs" on storage.objects
for delete to authenticated using (
  bucket_id = 'learning-materials'
  and exists (select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true and p.role in ('admin', 'teacher'))
);

comment on table public.learning_chapters is 'Shared chapter catalogue for Ekonomi Form 4 and Form 5.';
comment on table public.learning_materials is 'Notes, PDFs, video links and learning links; student visibility requires publication and matching form level.';
