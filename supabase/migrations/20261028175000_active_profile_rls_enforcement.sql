-- Prevent suspended authenticated accounts from bypassing application guards
-- through direct PostgREST, RPC helper, or Storage requests.
begin;

create or replace function public.is_active_profile()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_suspended = false
  )
$$;
revoke all on function public.is_active_profile() from public, anon, authenticated;
-- Anonymous access is needed to evaluate mixed public/anonymous read policies;
-- auth.uid() is null for anonymous requests and the function returns false.
grant execute on function public.is_active_profile() to anon, authenticated;
comment on function public.is_active_profile() is
  'Returns true only when the current JWT subject has an explicitly unsuspended profile.';

create or replace function public.is_parent_of(child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.is_active_profile()
    and public.has_role('parent')
    and exists (
      select 1
      from public.parent_student_links l
      where l.parent_id = auth.uid()
        and l.student_id = child_id
        and l.confirmed_at is not null
    )
$$;

create or replace function public.is_class_member(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.is_active_profile()
    and exists (
      select 1
      from public.enrolments e
      where e.class_id = target_class
        and e.student_id = auth.uid()
        and e.status = 'active'
    )
$$;

create or replace function public.teaches_class(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.is_active_profile()
    and exists (
      select 1
      from public.classes c
      where c.id = target_class
        and c.teacher_id = auth.uid()
    )
$$;

create or replace function public.can_read_class(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.is_active_profile()
    and (
      public.is_admin()
      or public.teaches_class(target_class)
      or public.is_class_member(target_class)
      or exists (
        select 1
        from public.enrolments e
        where e.class_id = target_class
          and public.is_parent_of(e.student_id)
          and e.status = 'active'
      )
    )
$$;

create or replace function public.is_chat_member(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.is_active_profile()
    and exists (
      select 1
      from public.chat_group_members m
      where m.group_id = target_group
        and m.profile_id = auth.uid()
    )
$$;

create or replace function public.can_manage_chat_group(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.is_active_profile()
    and exists (
      select 1
      from public.chat_groups g
      where g.id = target_group
        and (
          g.created_by = auth.uid()
          or (g.class_id is not null and public.teaches_class(g.class_id))
        )
    )
$$;

create or replace function public.can_read_material(target_material uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.is_active_profile()
    and exists (
      select 1
      from public.materials m
      join public.material_shares s on s.material_id = m.id
      where m.id = target_material
        and (
          m.teacher_id = auth.uid()
          or s.student_id = auth.uid()
          or public.is_parent_of(s.student_id)
          or public.is_class_member(s.class_id)
          or public.teaches_class(s.class_id)
        )
    )
$$;

create or replace function public.owns_material(target_material uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.is_active_profile()
    and exists (
      select 1
      from public.materials m
      where m.id = target_material
        and m.teacher_id = auth.uid()
    )
$$;

create or replace function public.has_course_access(target_course uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.is_active_profile()
    and exists (
      select 1
      from public.course_enrolments e
      where e.course_id = target_course
        and e.student_id = auth.uid()
        and e.status in ('active', 'completed')
        and (e.expires_at is null or e.expires_at > now())
    )
$$;

create or replace function public.has_product_access(target_product uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.is_active_profile()
    and exists (
      select 1
      from public.entitlements e
      where e.profile_id = auth.uid()
        and e.product_id = target_product
        and e.status = 'active'
        and e.starts_at <= now()
        and (e.ends_at is null or e.ends_at > now())
    )
$$;

create or replace function public.is_student_profile(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.is_active_profile()
    and exists (
      select 1
      from public.profiles p
      where p.id = target_id
        and p.role = 'student'
        and p.is_suspended = false
    )
$$;

create or replace function public.parent_allows_community(child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.is_active_profile()
    and (child_id = auth.uid() or public.is_admin())
    and (child_id = auth.uid() and public.has_role('student') or public.is_admin())
    and exists (
      select 1
      from public.parent_student_links l
      join public.parent_details pd on pd.profile_id = l.parent_id
      where l.student_id = child_id
        and l.confirmed_at is not null
        and pd.community_access_control
    )
$$;

-- Add an active-profile condition to every policy that applies to authenticated
-- users in the public and Storage schemas. Preserve anonymous access for mixed
-- public policies. Keep profiles_self_select unwrapped so a user can read only
-- their own suspension status and receive the account-suspended notice; the
-- is_parent_of() helper still blocks suspended parents from reading child rows.
do $enforce_active_profile$
declare
  v_policy record;
  v_guard text;
  v_using text;
  v_check text;
  v_sql text;
begin
  for v_policy in
    select schemaname, tablename, policyname, roles, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (
        roles @> array['authenticated'::name]
        or roles @> array['public'::name]
      )
      and not (
        schemaname = 'public'
        and tablename = 'profiles'
        and policyname = 'profiles_self_select'
      )
  loop
    if v_policy.roles @> array['anon'::name]
       or v_policy.roles @> array['public'::name] then
      v_guard := '(auth.uid() is null or (select public.is_active_profile()))';
    else
      v_guard := '(select public.is_active_profile())';
    end if;

    v_using := null;
    if v_policy.qual is not null then
      if position('is_active_profile' in v_policy.qual) > 0 then
        v_using := v_policy.qual;
      else
        v_using := v_guard || ' and (' || v_policy.qual || ')';
      end if;
    end if;

    v_check := null;
    if v_policy.with_check is not null then
      if position('is_active_profile' in v_policy.with_check) > 0 then
        v_check := v_policy.with_check;
      else
        v_check := v_guard || ' and (' || v_policy.with_check || ')';
      end if;
    end if;

    v_sql := format(
      'alter policy %I on %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
    if v_using is not null then
      v_sql := v_sql || format(' using (%s)', v_using);
    end if;
    if v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;
    execute v_sql;
  end loop;
end
$enforce_active_profile$;

commit;
