-- Rebuild course-content policies after the active-profile security guard was
-- introduced. Authenticated reads, inserts, and cleanup must reject suspended users.
drop policy if exists course_content_admin_insert on storage.objects;
create policy course_content_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'course-content'
  and (select public.is_active_profile())
  and public.is_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists course_content_authorized_read on storage.objects;
create policy course_content_authorized_read
on storage.objects for select to authenticated
using (
  bucket_id = 'course-content'
  and (select public.is_active_profile())
  and (
    public.is_admin()
    or exists (
      select 1
      from public.lesson_resources r
      join public.course_lessons l on l.id = r.lesson_id
      join public.course_modules m on m.id = l.module_id
      where r.file_path = storage.objects.name
        and r.is_downloadable
        and l.is_published
        and (l.release_at is null or l.release_at <= now())
        and (m.release_at is null or m.release_at <= now())
        and exists (
          select 1
          from public.courses c
          where c.id = m.course_id and c.status = 'published'
        )
        and (
          l.is_free_preview
          or public.has_course_access(m.course_id)
          or exists (
            select 1
            from public.parent_student_links psl
            join public.course_enrolments e on e.student_id = psl.student_id
            where psl.parent_id = auth.uid()
              and psl.confirmed_at is not null
              and e.course_id = m.course_id
              and e.status in ('active', 'completed')
              and (e.expires_at is null or e.expires_at > now())
          )
        )
    )
  )
);

drop policy if exists course_content_admin_delete on storage.objects;
create policy course_content_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'course-content'
  and (select public.is_active_profile())
  and public.is_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists lesson_resources_enrolled_access on public.lesson_resources;
create policy lesson_resources_enrolled_access
on public.lesson_resources for select to authenticated
using (
  (select public.is_active_profile())
  and exists (
    select 1
    from public.course_lessons l
    join public.course_modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    where l.id = lesson_resources.lesson_id
      and l.is_published
      and (l.release_at is null or l.release_at <= now())
      and (m.release_at is null or m.release_at <= now())
      and c.status = 'published'
      and (
        public.is_admin()
        or l.is_free_preview
        or public.has_course_access(m.course_id)
        or exists (
          select 1
          from public.parent_student_links psl
          join public.course_enrolments e on e.student_id = psl.student_id
          where psl.parent_id = auth.uid()
            and psl.confirmed_at is not null
            and e.course_id = m.course_id
            and e.status in ('active', 'completed')
            and (e.expires_at is null or e.expires_at > now())
        )
      )
  )
);
