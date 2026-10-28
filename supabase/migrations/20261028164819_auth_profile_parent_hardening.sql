-- Lexify School follow-up hardening migration.
-- Apply after the four ordered payment-free schema migrations. No users, secrets, or curriculum UUIDs
-- are provisioned here. Client writes to student_subjects are replaced by one
-- validated, atomic RPC; curriculum membership is resolved from natural metadata.

begin;

-- Normalization helper used only by the SECURITY DEFINER RPCs below.
create or replace function public.curriculum_key(value text)
returns text
language sql immutable strict
set search_path = pg_catalog
as $$
  select regexp_replace(lower(value), '[^a-z0-9]+', '', 'g')
$$;
revoke all on function public.curriculum_key(text) from public, anon, authenticated;

-- Parent status must never be inferred from a requested/pending relationship.
create or replace function public.is_parent_of(child_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.has_role('parent') and exists (
    select 1
    from public.parent_student_links l
    where l.parent_id = auth.uid()
      and l.student_id = child_id
      and l.confirmed_at is not null
  )
$$;

create or replace function public.is_student_profile(target_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target_id and p.role = 'student' and not p.is_suspended
  )
$$;
revoke all on function public.is_student_profile(uuid) from public, anon, authenticated;
grant execute on function public.is_student_profile(uuid) to authenticated;

-- Signup is the sole ordinary-client path which creates profiles and role details.
-- Roles are allowlisted from raw_user_meta_data; invalid values, including admin,
-- are normalized to guest. Deaf status is intentionally not accepted from metadata.
create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text;
  v_name text;
  v_phone text;
  v_whatsapp text;
  v_guardian_name text;
  v_guardian_phone text;
  v_guardian_whatsapp text;
  v_preferred_lesson_times text[];
  v_consent boolean := false;
  v_consent_at timestamptz;
  v_adult_consent boolean := false;
  v_system_id uuid;
  v_grade_id uuid;
  v_pathway_id uuid;
  v_track_id uuid;
  v_candidate uuid;
begin
  v_role := lower(btrim(coalesce(v_meta ->> 'role', '')));
  if v_role not in ('student', 'parent', 'teacher', 'guest') then
    v_role := 'guest';
  end if;

  v_name := coalesce(nullif(btrim(v_meta ->> 'full_name'), ''),
                     nullif(btrim(v_meta ->> 'name'), ''), '');
  v_phone := coalesce(nullif(btrim(v_meta ->> 'phone'), ''), new.phone);
  v_whatsapp := coalesce(nullif(btrim(v_meta ->> 'whatsapp'), ''),
                         nullif(btrim(v_meta ->> 'whatsapp_number'), ''));

  insert into public.profiles (id, role, full_name, email, phone, whatsapp)
  values (new.id, v_role, v_name, new.email, v_phone, v_whatsapp);

  if v_role = 'student' then
    v_consent := lower(coalesce(v_meta ->> 'consent_given', 'false')) in ('true','t','1','yes','on');
    begin
      if v_consent and nullif(btrim(v_meta ->> 'consent_at'), '') is not null then
        v_consent_at := (v_meta ->> 'consent_at')::timestamptz;
      end if;
    exception when others then
      v_consent_at := null;
    end;
    v_guardian_name := nullif(btrim(v_meta ->> 'guardian_name'), '');
    v_guardian_phone := nullif(btrim(v_meta ->> 'guardian_phone'), '');
    v_guardian_whatsapp := nullif(btrim(v_meta ->> 'guardian_whatsapp'), '');
    if jsonb_typeof(v_meta -> 'preferred_lesson_times') = 'array' then
      select array_agg(value) into v_preferred_lesson_times
      from jsonb_array_elements_text(v_meta -> 'preferred_lesson_times') as item(value);
    end if;

    -- Optional onboarding IDs are accepted only when valid and mutually consistent.
    begin v_candidate := nullif(v_meta ->> 'education_system_id', '')::uuid;
    exception when others then v_candidate := null;
    end;
    if exists (select 1 from public.education_systems s where s.id = v_candidate) then
      v_system_id := v_candidate;
    end if;
    begin v_candidate := nullif(v_meta ->> 'grade_id', '')::uuid;
    exception when others then v_candidate := null;
    end;
    if v_system_id is not null and exists (
      select 1 from public.grades g where g.id = v_candidate and g.system_id = v_system_id
    ) then
      v_grade_id := v_candidate;
    end if;
    begin v_candidate := nullif(v_meta ->> 'pathway_id', '')::uuid;
    exception when others then v_candidate := null;
    end;
    if v_system_id is not null and exists (
      select 1 from public.pathways p where p.id = v_candidate and p.system_id = v_system_id
    ) then
      v_pathway_id := v_candidate;
    end if;
    begin v_candidate := nullif(v_meta ->> 'track_id', '')::uuid;
    exception when others then v_candidate := null;
    end;
    if v_pathway_id is not null and exists (
      select 1 from public.pathway_tracks t where t.id = v_candidate and t.pathway_id = v_pathway_id
    ) then
      v_track_id := v_candidate;
    end if;

    insert into public.student_details
      (profile_id, education_system_id, grade_id, pathway_id, track_id, guardian_name, guardian_phone,
       guardian_whatsapp, preferred_lesson_times, consent_given, consent_at)
    values
      (new.id, v_system_id, v_grade_id, v_pathway_id, v_track_id, v_guardian_name, v_guardian_phone,
       v_guardian_whatsapp, v_preferred_lesson_times, v_consent, v_consent_at);
  elsif v_role = 'teacher' then
    insert into public.teacher_details (profile_id) values (new.id);
  elsif v_role = 'parent' then
    insert into public.parent_details (profile_id) values (new.id);
  else
    v_adult_consent := lower(coalesce(v_meta ->> 'adult_or_guardian_consent', 'false'))
                       in ('true','t','1','yes','on');
    insert into public.guest_details (profile_id, adult_or_guardian_consent)
    values (new.id, v_adult_consent);
  end if;
  return new;
end
$$;
revoke all on function public.handle_auth_user_profile() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_auth_user_profile();

-- A profile cannot be inserted through the public API, and changing one's own
-- role is blocked even if a client tries to exploit the old permissive UPDATE policy.
revoke insert on public.profiles from anon, authenticated;
drop policy if exists profiles_signup_insert on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Profile role changes require administrator authorization';
  end if;
  return new;
end
$$;
revoke all on function public.guard_profile_role_change() from public, anon, authenticated;
drop trigger if exists guard_profile_role_change on public.profiles;
create trigger guard_profile_role_change
before update of role on public.profiles
for each row execute function public.guard_profile_role_change();

-- The deaf-learner flag is an administrative/trusted-data attribute, not a
-- signup claim. It may not be self-edited because KSL eligibility depends on it.
create or replace function public.guard_student_deaf_status()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if new.is_deaf_learner is distinct from old.is_deaf_learner
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Deaf-learner status can only be changed by an administrator';
  end if;
  return new;
end
$$;
revoke all on function public.guard_student_deaf_status() from public, anon, authenticated;
drop trigger if exists guard_student_deaf_status on public.student_details;
create trigger guard_student_deaf_status
before update of is_deaf_learner on public.student_details
for each row execute function public.guard_student_deaf_status();

-- Pending requests are visible to their two participants, but only confirmed
-- links make any of the child-data policies using is_parent_of() true.
drop policy if exists links_parent_add on public.parent_student_links;
drop policy if exists links_parent_update on public.parent_student_links;
drop policy if exists links_student_confirm on public.parent_student_links;
create policy links_parent_add on public.parent_student_links
  for insert to authenticated
  with check (
    parent_id = auth.uid()
    and public.has_role('parent')
    and confirmed_at is null
    and public.is_student_profile(student_id)
  );

create or replace function public.confirm_parent_link(link_id uuid)
returns void
language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.has_role('student') then
    raise exception 'Only an authenticated student can confirm a parent link';
  end if;

  update public.parent_student_links l
     set confirmed_at = statement_timestamp()
   where l.id = link_id
     and l.student_id = v_actor
     and l.confirmed_at is null
     and public.has_role('parent')
     and public.is_student_profile(l.student_id);

  if not found then
    raise exception 'No pending parent-link request was found for this student';
  end if;
end
$$;
revoke all on function public.confirm_parent_link(uuid) from public, anon;
grant execute on function public.confirm_parent_link(uuid) to authenticated;

commit;
