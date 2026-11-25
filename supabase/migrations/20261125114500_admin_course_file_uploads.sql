-- Admin-uploaded course files remain private. Access is granted only through
-- published lesson resource records and the existing course enrolment model.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'course-content',
  'course-content',
  false,
  104857600,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists course_content_admin_insert on storage.objects;
create policy course_content_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'course-content'
  and public.is_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists course_content_authorized_read on storage.objects;
create policy course_content_authorized_read
on storage.objects for select to authenticated
using (
  bucket_id = 'course-content'
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

drop policy if exists lesson_resources_enrolled_access on public.lesson_resources;
create policy lesson_resources_enrolled_access
on public.lesson_resources for select to authenticated
using (
  exists (
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
