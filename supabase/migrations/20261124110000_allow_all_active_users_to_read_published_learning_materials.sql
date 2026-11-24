-- Allow every active authenticated portal account to read published learning materials.
-- Admins and teachers retain access to drafts and inactive chapter content for management.
-- The learning-materials bucket remains private; PDF access is granted through signed URLs.

drop policy if exists "Active portal users read relevant learning chapters" on public.learning_chapters;
create policy "All active portal users read active learning chapters"
on public.learning_chapters
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles p
    where p.user_id = (select auth.uid())
      and p.is_active = true
      and (
        p.role in ('admin', 'teacher')
        or learning_chapters.is_active = true
      )
  )
);

drop policy if exists "Active students read all published learning materials" on public.learning_materials;
create policy "All active portal users read published learning materials"
on public.learning_materials
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles p
    where p.user_id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin', 'teacher')
  )
  or (
    is_published = true
    and exists (
      select 1
      from public.learning_chapters c
      join public.user_profiles p on p.user_id = (select auth.uid())
      where c.id = learning_materials.chapter_id
        and c.is_active = true
        and p.is_active = true
    )
  )
);

drop policy if exists "Learning managers and all active students read published learning PDFs" on storage.objects;
create policy "All active portal users read published learning PDFs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'learning-materials'
  and (
    exists (
      select 1
      from public.user_profiles p
      where p.user_id = (select auth.uid())
        and p.is_active = true
        and p.role in ('admin', 'teacher')
    )
    or exists (
      select 1
      from public.learning_materials m
      join public.learning_chapters c on c.id = m.chapter_id
      join public.user_profiles p on p.user_id = (select auth.uid())
      where m.storage_path = storage.objects.name
        and m.material_type = 'pdf'
        and m.is_published = true
        and c.is_active = true
        and p.is_active = true
    )
  )
);
