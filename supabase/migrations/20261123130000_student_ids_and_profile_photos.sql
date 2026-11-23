begin;

-- A human-shareable, high-entropy identifier for parent link requests. The Auth
-- UUID remains the internal primary key and is never shown as the student ID.
alter table public.student_details
  add column if not exists student_code text;

update public.student_details
   set student_code = 'LEX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
 where student_code is null or btrim(student_code) = '';

alter table public.student_details
  alter column student_code set default ('LEX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)));
alter table public.student_details
  alter column student_code set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.student_details'::regclass
      and conname = 'student_details_student_code_format'
  ) then
    alter table public.student_details
      add constraint student_details_student_code_format
      check (student_code ~ '^LEX-[A-F0-9]{16}$');
  end if;
end
$$;

create unique index if not exists student_details_student_code_key
  on public.student_details (student_code);

-- Parents may request a link by sharing a student code. This only creates a
-- pending link; the existing student-only confirm_parent_link RPC remains the
-- only path that grants parent access to child records.
create or replace function public.request_parent_student_link_by_code(p_student_code text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_parent_id uuid := auth.uid();
  v_student_id uuid;
  v_link_id uuid;
  v_code text := upper(btrim(coalesce(p_student_code, '')));
begin
  if v_parent_id is null or not public.is_active_profile() or not public.has_role('parent') then
    raise exception 'Sign in with an active parent account to request a link';
  end if;
  if v_code !~ '^LEX-[A-F0-9]{16}$' then
    raise exception 'Enter a valid student ID and try again';
  end if;

  select sd.profile_id
    into v_student_id
    from public.student_details sd
    join public.profiles p on p.id = sd.profile_id
   where sd.student_code = v_code
     and p.role = 'student'
     and not p.is_suspended;

  if v_student_id is null then
    raise exception 'That student ID could not be linked. Check it and try again';
  end if;

  insert into public.parent_student_links (parent_id, student_id, relationship)
  values (v_parent_id, v_student_id, 'parent/guardian')
  on conflict (parent_id, student_id) do nothing
  returning id into v_link_id;

  if v_link_id is null then
    select id into v_link_id
      from public.parent_student_links
     where parent_id = v_parent_id and student_id = v_student_id;
  end if;

  return v_link_id;
end
$$;
revoke all on function public.request_parent_student_link_by_code(text) from public, anon;
grant execute on function public.request_parent_student_link_by_code(text) to authenticated;

-- A private account-photo bucket; public teacher listing images continue to use
-- the separate teacher_details.public_avatar_url field.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set name = excluded.name,
      public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy profile_photos_owner_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select public.is_active_profile())
  );
create policy profile_photos_owner_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select public.is_active_profile())
  );
create policy profile_photos_owner_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select public.is_active_profile())
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select public.is_active_profile())
  );
create policy profile_photos_owner_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select public.is_active_profile())
  );

-- Keep the profile's private avatar reference within the current user's bucket
-- prefix. The upload endpoint still validates image bytes and builds the path.
create or replace function public.guard_profile_avatar_path()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if new.avatar_url is distinct from old.avatar_url
     and auth.uid() is not null
     and not public.is_admin() then
    if auth.uid() <> new.id then
      raise exception 'A profile photo can only be changed by its owner';
    end if;
    if new.avatar_url is not null and (
      left(new.avatar_url, length(auth.uid()::text) + 1) <> auth.uid()::text || '/'
      or position('..' in new.avatar_url) > 0
      or array_length(string_to_array(new.avatar_url, '/'), 1) <> 2
    ) then
      raise exception 'A profile photo must use the owner''s private storage path';
    end if;
  end if;
  return new;
end
$$;
revoke all on function public.guard_profile_avatar_path() from public, anon, authenticated;
drop trigger if exists guard_profile_avatar_path on public.profiles;
create trigger guard_profile_avatar_path
  before update of avatar_url on public.profiles
  for each row execute function public.guard_profile_avatar_path();

comment on column public.student_details.student_code is
  'High-entropy, shareable student identifier for a pending parent-link request; not the internal Auth UUID.';
comment on function public.request_parent_student_link_by_code(text) is
  'Creates or returns a pending parent-student link by student code; the student must separately confirm before child data becomes accessible.';

commit;
