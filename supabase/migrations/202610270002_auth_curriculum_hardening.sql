-- Lexify School follow-up hardening migration.
-- Apply after 202610270001_lexifyschool.sql. No users, secrets, or curriculum UUIDs
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

-- No direct INSERT/UPDATE/DELETE is allowed for student_subjects. The SECURITY
-- DEFINER RPC below validates the complete replacement before deleting anything.
drop policy if exists student_subjects_self_write on public.student_subjects;
drop policy if exists student_subjects_self_update on public.student_subjects;
drop policy if exists student_subjects_self_delete on public.student_subjects;
revoke insert, update, delete on public.student_subjects from anon, authenticated;

create or replace function public.save_student_subjects(
  grade_id uuid,
  selected_area_ids uuid[],
  pathway_id uuid default null,
  track_id uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
#variable_conflict use_variable
declare
  v_actor uuid := auth.uid();
  v_details public.student_details%rowtype;
  v_grade public.grades%rowtype;
  v_system public.education_systems%rowtype;
  v_pathway public.pathways%rowtype;
  v_track public.pathway_tracks%rowtype;
  v_grade_key text;
  v_system_key text;
  v_is_junior boolean := false;
  v_is_senior boolean := false;
  v_is_844 boolean := false;
  v_core_count integer := 0;
  v_elective_count integer := 0;
  v_language_count integer := 0;
  v_ksl_count integer := 0;
  v_math_count integer := 0;
  v_correct_math_count integer := 0;
  v_csl_count integer := 0;
  v_re_count integer := 0;
  v_group_ii_count integer := 0;
  v_group_iii_count integer := 0;
  v_group_iv_v_count integer := 0;
  v_english_count integer := 0;
  v_kiswahili_count integer := 0;
  v_kcse_math_count integer := 0;
  v_foreign_electives integer := 0;
  v_own_electives integer := 0;
  v_allow_stem_exception boolean := false;
  v_is_pure_sciences boolean := false;
  v_has_unapproved_combination boolean := false;
  v_pair jsonb;
  v_pair_left text;
  v_pair_right text;
  v_rule_key text;
  v_rule_pairs jsonb;
  v_rule record;
begin
  if v_actor is null or not public.has_role('student') then
    raise exception 'Only an active student can save subject selections';
  end if;
  if selected_area_ids is null or cardinality(selected_area_ids) = 0 then
    raise exception 'Select the required learning areas before saving';
  end if;
  if exists (select 1 from unnest(selected_area_ids) x where x is null) then
    raise exception 'Subject selection contains an empty learning-area ID';
  end if;
  if cardinality(selected_area_ids) <> (select count(distinct x) from unnest(selected_area_ids) x) then
    raise exception 'A learning area may only be selected once';
  end if;

  select * into v_details
  from public.student_details sd
  where sd.profile_id = v_actor
  for update;
  if not found then raise exception 'Student details are missing'; end if;

  select * into v_grade from public.grades g where g.id = grade_id and g.is_active;
  if not found then raise exception 'The selected grade does not exist or is inactive'; end if;
  if v_details.education_system_id is null or v_details.education_system_id <> v_grade.system_id then
    raise exception 'Selected grade must belong to the education system chosen on your student profile';
  end if;
  select * into v_system from public.education_systems s
  where s.id = v_grade.system_id and s.is_active;
  if not found then raise exception 'The selected education system is inactive'; end if;

  v_grade_key := public.curriculum_key(coalesce(v_grade.code,'') || ' ' || coalesce(v_grade.name,''));
  v_system_key := public.curriculum_key(coalesce(v_system.code,'') || ' ' || coalesce(v_system.name,''));
  v_is_junior := v_system_key like '%junior%' or v_grade_key ~ '(^|grade|g)(7|8|9)$' or v_grade_key ~ 'grade(7|8|9)';
  v_is_senior := v_system_key like '%senior%' or v_grade_key ~ '(^|grade|g)(10|11|12)$' or v_grade_key ~ 'grade(10|11|12)';
  v_is_844 := v_system_key like '%844%' or v_system_key like '%secondary%' and v_grade_key like '%form%' or v_grade_key ~ 'form(3|4)';
  if (case when v_is_junior then 1 else 0 end
      + case when v_is_senior then 1 else 0 end
      + case when v_is_844 then 1 else 0 end) <> 1 then
    raise exception 'The selected grade is not identifiable as Junior CBE, Senior CBE, or 8-4-4';
  end if;

  -- Every submitted area must be listed for this grade; junior extras are retained
  -- only as tutoring_only and never inflate the nine-area curriculum count.
  if exists (
    select 1
    from unnest(selected_area_ids) x
    left join public.grade_learning_areas gla on gla.grade_id = grade_id and gla.learning_area_id = x
    where gla.id is null
  ) then
    raise exception 'One or more selected learning areas are not offered for this grade';
  end if;

  if v_is_junior then
    if pathway_id is not null or track_id is not null then
      raise exception 'Junior School subject choices do not use a pathway or track';
    end if;
    select count(*) filter (where gla.role = 'core' and not la.is_optional_activity),
           count(*) filter (where gla.role = 'sub_area' and
             (public.curriculum_key(la.code) in ('juncre','junire','junhre') or exists (
               select 1 from public.learning_areas parent
               where parent.id = la.parent_area_id
                 and public.curriculum_key(parent.code) = 'junreligiouseducation'))),
           count(*) filter (where la.restriction_code = 'DEAF_LEARNER_ONLY'
             or public.curriculum_key(la.code) in ('junkenyasignlanguage','senksl','sensignlanguage','kcseksl')
             or public.curriculum_key(la.title) in ('kenyasignlanguage','signlanguage')),
           count(*) filter (where gla.role in ('optional','elective','sub_area') or la.is_optional_activity)
      into v_core_count, v_re_count, v_ksl_count, v_elective_count
    from unnest(selected_area_ids) x
    join public.grade_learning_areas gla on gla.grade_id = grade_id and gla.learning_area_id = x
    join public.learning_areas la on la.id = x;

    select count(*) into v_language_count
    from unnest(selected_area_ids) x
    join public.learning_areas la on la.id = x
    where public.curriculum_key(la.code) = 'junkiswahili';
    if v_ksl_count > 0 then v_language_count := v_ksl_count; end if;

    if v_core_count + case when v_ksl_count > 0 and v_language_count = v_ksl_count
                           and not exists (
                             select 1 from unnest(selected_area_ids) x
                             join public.learning_areas la on la.id = x
                             where public.curriculum_key(la.code) = 'junkiswahili'
                           ) then 1 else 0 end <> 9 then
      raise exception 'Junior School requires exactly 9 core learning areas; tutoring extras are separate';
    end if;
    if v_re_count <> 1 then
      raise exception 'Choose exactly one Religious Education subtype (CRE, IRE, or HRE)';
    end if;
    if v_language_count <> 1 then
      raise exception 'Choose exactly one Kiswahili or Kenya Sign Language area';
    end if;
    if exists (
      select 1 from unnest(selected_area_ids) x
      join public.grade_learning_areas gla on gla.grade_id = grade_id and gla.learning_area_id = x
      join public.learning_areas la on la.id = x
      where (la.restriction_code = 'DEAF_LEARNER_ONLY'
             or public.curriculum_key(la.code) in ('junkenyasignlanguage','senksl','sensignlanguage','kcseksl')
             or public.curriculum_key(la.title) in ('kenyasignlanguage','signlanguage'))
        and not v_details.is_deaf_learner
    ) then
      raise exception 'Kenya Sign Language is available only to a learner marked as deaf by an administrator';
    end if;
    if exists (
      select 1 from public.grade_learning_areas req
      join public.learning_areas la on la.id = req.learning_area_id
      where req.grade_id = grade_id and req.role = 'core' and req.is_required
        and not la.is_optional_activity
        and public.curriculum_key(la.title || ' ' || la.code) not like '%religiouseducation%'
        and public.curriculum_key(la.title || ' ' || la.code) not like '%religion%'
        and public.curriculum_key(la.title || ' ' || la.code) not like '%kiswahili%'
        and public.curriculum_key(la.title || ' ' || la.code) not like '%signlanguage%'
        and not (public.curriculum_key(la.code) in ('cre','ire','hre','ksl'))
        and not (v_ksl_count > 0 and public.curriculum_key(la.code) = 'junkiswahili')
        and not (req.learning_area_id = any(selected_area_ids))
    ) then
      raise exception 'A required Junior School core learning area is missing';
    end if;
    if exists (
      select 1 from unnest(selected_area_ids) x
      join public.grade_learning_areas gla on gla.grade_id = grade_id and gla.learning_area_id = x
      join public.learning_areas la on la.id = x
      where not (gla.role = 'core' and not la.is_optional_activity)
        and not (gla.role in ('optional','elective','sub_area') or la.is_optional_activity)
    ) then
      raise exception 'Junior extras must be offered optional/sub-areas and are saved as tutoring-only';
    end if;
  elsif v_is_senior then
    if pathway_id is null or track_id is null then
      raise exception 'Senior School requires one pathway and one track';
    end if;
    select * into v_pathway from public.pathways p
    where p.id = pathway_id and p.system_id = v_grade.system_id and p.is_active;
    if not found then raise exception 'Choose an active pathway in the selected education system'; end if;
    select * into v_track from public.pathway_tracks t
    where t.id = track_id and t.pathway_id = pathway_id and t.is_active;
    if not found then raise exception 'Choose an active track belonging to the selected pathway'; end if;

    v_is_pure_sciences := public.curriculum_key(v_track.code || ' ' || v_track.name) like '%puresciences%';
    v_allow_stem_exception := public.curriculum_key(v_pathway.code || ' ' || v_pathway.name) like '%stem%'
      and exists (
        select 1 from public.combination_rules cr
        where cr.system_id = v_grade.system_id and cr.is_enabled and not cr.is_warning_only
          and (coalesce(cr.rule_json ->> 'allow_cross_pathway_stem', 'false') = 'true'
               or coalesce(cr.rule_json ->> 'allow_limited_exception', 'false') = 'true')
      );

    select count(*) filter (where gla.role = 'core' and not la.is_optional_activity),
           count(*) filter (where gla.role = 'elective' and not la.is_optional_activity),
           count(*) filter (where gla.role = 'core' and not la.is_optional_activity and
             (public.curriculum_key(la.code || ' ' || la.title) like '%kiswahili%' or
              la.restriction_code = 'DEAF_LEARNER_ONLY' or
              public.curriculum_key(la.code) in ('senksl','sensignlanguage') or
              public.curriculum_key(la.title) in ('kenyasignlanguage','signlanguage'))),
           count(*) filter (where gla.role = 'core' and not la.is_optional_activity and
             public.curriculum_key(la.code || ' ' || la.title) like '%english%'),
           count(*) filter (where gla.role = 'core' and not la.is_optional_activity and
             (public.curriculum_key(la.code || ' ' || la.title) like '%mathematics%' or
              public.curriculum_key(la.code || ' ' || la.title) like '%maths%')),
           count(*) filter (where gla.role = 'core' and not la.is_optional_activity and
             (public.curriculum_key(la.code || ' ' || la.title) like '%communityservicelearning%' or
              public.curriculum_key(la.code) = 'csl')),
           count(*) filter (where public.curriculum_key(la.code || ' ' || la.title) in ('cre','ire','hre') or
             public.curriculum_key(la.title) like '%religiouseducation%' or public.curriculum_key(la.title) like '%religion%'),
           count(*) filter (where gla.role = 'core' and not la.is_optional_activity and
             (case when v_is_pure_sciences then public.curriculum_key(la.code || ' ' || la.title) like '%coremathematics%'
                   else public.curriculum_key(la.code || ' ' || la.title) like '%essentialmathematics%' end))
      into v_core_count, v_elective_count, v_language_count, v_english_count, v_math_count,
           v_csl_count, v_re_count, v_correct_math_count
    from unnest(selected_area_ids) x
    join public.grade_learning_areas gla on gla.grade_id = grade_id and gla.learning_area_id = x
    join public.learning_areas la on la.id = x;

    if v_core_count <> 4 or v_elective_count <> 3 or cardinality(selected_area_ids) <> 7 then
      raise exception 'Senior School requires exactly 4 core subjects and 3 electives (7 total)';
    end if;
    if v_language_count <> 1 then
      raise exception 'Senior core must include exactly one Kiswahili or Kenya Sign Language alternative';
    end if;
    if v_english_count <> 1 then
      raise exception 'English is required exactly once in the Senior core';
    end if;
    if v_math_count <> 1 then
      raise exception 'Senior core must include exactly one Mathematics alternative';
    end if;
    if v_csl_count <> 1 then
      raise exception 'Community Service Learning is required in the Senior core';
    end if;
    if v_correct_math_count <> 1 then
      if v_is_pure_sciences then
        raise exception 'The Pure Sciences track requires Core Mathematics';
      else
        raise exception 'This pathway/track requires Essential Mathematics';
      end if;
    end if;
    if v_re_count > 1 then raise exception 'Choose at most one Religious Education elective'; end if;
    if exists (
      select 1 from unnest(selected_area_ids) x
      join public.learning_areas la on la.id = x
      where (la.restriction_code = 'DEAF_LEARNER_ONLY'
             or public.curriculum_key(la.code) in ('junkenyasignlanguage','senksl','sensignlanguage','kcseksl')
             or public.curriculum_key(la.title) in ('kenyasignlanguage','signlanguage'))
        and not v_details.is_deaf_learner
      ) then
      raise exception 'Kenya Sign Language is available only to a learner marked as deaf by an administrator';
    end if;

    select count(*) filter (where la.pathway_id = pathway_id),
           count(*) filter (where la.pathway_id is distinct from pathway_id)
      into v_own_electives, v_foreign_electives
    from unnest(selected_area_ids) x
    join public.grade_learning_areas gla on gla.grade_id = grade_id and gla.learning_area_id = x
    join public.learning_areas la on la.id = x
    where gla.role = 'elective' and not la.is_optional_activity;
    if v_own_electives + v_foreign_electives <> 3 then
      raise exception 'All three Senior electives must have pathway metadata';
    end if;
    if v_allow_stem_exception then
      if v_own_electives < 1 or v_foreign_electives > 2 then
        raise exception 'The enabled STEM exception allows at least 1 selected-pathway elective and at most 2 cross-pathway electives';
      end if;
    elsif v_foreign_electives <> 0 then
      raise exception 'Senior electives must come from the selected pathway; cross-pathway STEM choices are disabled';
    end if;
    if exists (
      select 1 from unnest(selected_area_ids) x
      join public.grade_learning_areas gla on gla.grade_id = grade_id and gla.learning_area_id = x
      join public.learning_areas la on la.id = x
      where gla.role = 'elective' and la.pathway_id = pathway_id
        and la.track_id is not null and la.track_id <> track_id
    ) then
      raise exception 'An elective does not belong to the selected track';
    end if;
    if exists (
      select 1 from unnest(selected_area_ids) x
      join public.grade_learning_areas gla on gla.grade_id = grade_id and gla.learning_area_id = x
      join public.learning_areas la on la.id = x
      where gla.role not in ('core','elective') or la.is_optional_activity
    ) then
      raise exception 'Senior selections must use the grade-listed core and elective subjects only';
    end if;
  else
    -- 8-4-4 has no CBE pathway or track.
    if pathway_id is not null or track_id is not null then
      raise exception '8-4-4 subject choices do not use a pathway or track';
    end if;
    if cardinality(selected_area_ids) < 7 or cardinality(selected_area_ids) > 9 then
      raise exception 'KCSE requires 7 to 9 subjects';
    end if;

    select count(*) filter (where (public.curriculum_key(coalesce(sg.code,'') || ' ' || coalesce(sg.name,'')) in ('i','1','groupi','group1','groupi1')
                                  or public.curriculum_key(coalesce(sg.code,'') || ' ' || coalesce(sg.name,'')) like '%groupi%')
                                   and (public.curriculum_key(la.title || ' ' || la.code) like '%english%'
                                        or public.curriculum_key(la.title || ' ' || la.code) like '%kiswahili%'
                                        or public.curriculum_key(la.kcse_code) in ('121','122'))),
           count(*) filter (where public.curriculum_key(la.title || ' ' || la.code) like '%english%'),
           count(*) filter (where public.curriculum_key(la.title || ' ' || la.code) like '%kiswahili%'),
           count(*) filter (where public.curriculum_key(la.kcse_code) in ('121','122')),
           count(*) filter (where public.curriculum_key(coalesce(sg.code,'') || ' ' || coalesce(sg.name,'')) in ('ii','2','groupii','group2')
                                  or public.curriculum_key(coalesce(sg.code,'') || ' ' || coalesce(sg.name,'')) like '%groupii%'
                                  or public.curriculum_key(coalesce(sg.code,'') || ' ' || coalesce(sg.name,'')) like '%group2%'),
           count(*) filter (where public.curriculum_key(coalesce(sg.code,'') || ' ' || coalesce(sg.name,'')) in ('iii','3','groupiii','group3')
                                  or public.curriculum_key(coalesce(sg.code,'') || ' ' || coalesce(sg.name,'')) like '%groupiii%'
                                  or public.curriculum_key(coalesce(sg.code,'') || ' ' || coalesce(sg.name,'')) like '%group3%'),
           count(*) filter (where public.curriculum_key(coalesce(sg.code,'') || ' ' || coalesce(sg.name,'')) in ('iv','v','4','5','groupiv','groupv','group4','group5')
                                  or public.curriculum_key(coalesce(sg.code,'') || ' ' || coalesce(sg.name,'')) like '%groupiv%'
                                  or public.curriculum_key(coalesce(sg.code,'') || ' ' || coalesce(sg.name,'')) like '%groupv%'
                                  or public.curriculum_key(coalesce(sg.code,'') || ' ' || coalesce(sg.name,'')) like '%group4%'
                                  or public.curriculum_key(coalesce(sg.code,'') || ' ' || coalesce(sg.name,'')) like '%group5%'),
           count(*) filter (where public.curriculum_key(la.code || ' ' || la.title) in ('cre','ire','hre')
                                  or public.curriculum_key(la.title) like '%religiouseducation%'
                                  or public.curriculum_key(la.title) like '%religion%')
      into v_core_count, v_english_count, v_kiswahili_count, v_kcse_math_count,
           v_group_ii_count, v_group_iii_count, v_group_iv_v_count, v_re_count
    from unnest(selected_area_ids) x
    join public.grade_learning_areas gla on gla.grade_id = grade_id and gla.learning_area_id = x
    join public.learning_areas la on la.id = x
    left join public.subject_groups sg on sg.id = la.group_id;

    if v_english_count <> 1 or v_kiswahili_count <> 1 or v_kcse_math_count <> 1 or v_core_count <> 3 then
      raise exception 'KCSE Group I requires English, Kiswahili, and exactly one Mathematics (KCSE 121 or 122)';
    end if;
    if v_group_ii_count < 2 then raise exception 'Choose at least 2 Group II science subjects'; end if;
    if v_group_iii_count < 1 then raise exception 'Choose at least 1 Group III humanities subject'; end if;
    if v_group_iv_v_count < 1 then raise exception 'Choose at least 1 Group IV or Group V subject'; end if;
    if v_re_count > 1 then raise exception 'Choose at most one Religious Education subject'; end if;
    if exists (
      select 1 from unnest(selected_area_ids) x join public.learning_areas la on la.id = x
      where (la.restriction_code = 'DEAF_LEARNER_ONLY'
             or public.curriculum_key(la.code) in ('junkenyasignlanguage','senksl','sensignlanguage','kcseksl')
             or public.curriculum_key(la.title) in ('kenyasignlanguage','signlanguage'))
        and not v_details.is_deaf_learner
      ) then
      raise exception 'Kenya Sign Language is available only to a learner marked as deaf by an administrator';
    end if;
  end if;

  -- Enabled blocking rules may express incompatible natural identifiers as arrays
  -- under overlap_pairs or exclusions (the seed format): [["SEN_GENERAL_SCIENCE",
  -- "SEN_BIOLOGY"], ...]. Warning-only rules never block.
  for v_rule in
    select cr.rule_json
    from public.combination_rules cr
    where cr.system_id = v_grade.system_id and cr.is_enabled and not cr.is_warning_only
      and (cr.applies_from_grade_id is null or exists (
        select 1 from public.grades ag
        where ag.id = cr.applies_from_grade_id and ag.system_id = v_grade.system_id
          and v_grade.level_order >= ag.level_order
      ))
  loop
    foreach v_rule_key in array array['overlap_pairs','exclusions','blocked_pairs','incompatible_pairs'] loop
      v_rule_pairs := v_rule.rule_json -> v_rule_key;
      if jsonb_typeof(v_rule_pairs) = 'array' then
        for v_pair in
          select item.value from jsonb_array_elements(v_rule_pairs) as item(value)
          where jsonb_typeof(item.value) = 'array' and jsonb_array_length(item.value) >= 2
        loop
          v_pair_left := public.curriculum_key(v_pair ->> 0);
          v_pair_right := public.curriculum_key(v_pair ->> 1);
          if exists (
            select 1
            from unnest(selected_area_ids) x1
            join public.learning_areas a1 on a1.id = x1
            cross join unnest(selected_area_ids) x2
            join public.learning_areas a2 on a2.id = x2
            where x1 <> x2
              and (public.curriculum_key(a1.code) = v_pair_left or public.curriculum_key(a1.title) = v_pair_left or public.curriculum_key(a1.kcse_code) = v_pair_left)
              and (public.curriculum_key(a2.code) = v_pair_right or public.curriculum_key(a2.title) = v_pair_right or public.curriculum_key(a2.kcse_code) = v_pair_right)
          ) then
            raise exception 'This subject combination is not allowed by an enabled curriculum rule (% with %)', v_pair ->> 0, v_pair ->> 1;
          end if;
        end loop;
      end if;
    end loop;
  end loop;

  -- Approved-combination absence is intentionally informational, never a block.
  select not exists (
    select 1 from public.subject_combinations sc
    where sc.system_id = v_grade.system_id and sc.is_approved
      and (select count(*) from public.subject_combination_areas ca where ca.combination_id = sc.id)
          = (select count(*) from unnest(selected_area_ids) x
             join public.grade_learning_areas gla on gla.grade_id = grade_id and gla.learning_area_id = x
             where not (v_is_junior and (gla.role in ('optional','elective','sub_area'))))
      and not exists (
        select 1 from unnest(selected_area_ids) x
        join public.grade_learning_areas gla on gla.grade_id = grade_id and gla.learning_area_id = x
        where not (v_is_junior and (gla.role in ('optional','elective','sub_area')))
          and not exists (select 1 from public.subject_combination_areas ca
                          where ca.combination_id = sc.id and ca.learning_area_id = x)
      )
      and not exists (
        select 1 from public.subject_combination_areas ca
        where ca.combination_id = sc.id
          and not (ca.learning_area_id = any(selected_area_ids))
      )
  ) into v_has_unapproved_combination;

  -- Validation is complete: one transaction replaces all of this student's choices.
  delete from public.student_subjects ss where ss.student_id = v_actor;
  insert into public.student_subjects (student_id, grade_id, learning_area_id, selection_type)
  select v_actor, grade_id, x,
         case
           when v_is_junior and gla.role = 'sub_area' and
                (public.curriculum_key(la.code) in ('juncre','junire','junhre','junkenyasignlanguage')
                 or la.restriction_code = 'DEAF_LEARNER_ONLY') then 'core'
           when v_is_junior and (gla.role <> 'core' or la.is_optional_activity) then 'tutoring_only'
           when gla.role in ('core','elective','optional') then gla.role
           else 'tutoring_only'
         end
  from unnest(selected_area_ids) x
  join public.grade_learning_areas gla on gla.grade_id = grade_id and gla.learning_area_id = x
  join public.learning_areas la on la.id = x;

  update public.student_details sd
     set grade_id = grade_id,
         pathway_id = case when v_is_senior then pathway_id else null end,
         track_id = case when v_is_senior then track_id else null end,
         updated_at = statement_timestamp()
   where sd.profile_id = v_actor;

  if v_has_unapproved_combination then
    return jsonb_build_object('saved', true,
      'warnings', jsonb_build_array('No exact approved subject combination was found; your valid selection was saved for review.'));
  end if;
  return jsonb_build_object('saved', true, 'warnings', '[]'::jsonb);
end
$$;
revoke all on function public.save_student_subjects(uuid, uuid[], uuid, uuid) from public, anon;
grant execute on function public.save_student_subjects(uuid, uuid[], uuid, uuid) to authenticated;

commit;
