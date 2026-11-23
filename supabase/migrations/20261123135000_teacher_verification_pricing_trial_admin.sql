begin;

alter table public.teacher_verification_requests
  add column if not exists fee_snapshot numeric(12,2),
  add column if not exists fee_currency text;

alter table public.teacher_verification_requests
  add constraint teacher_verification_fee_snapshot_nonnegative
  check (fee_snapshot is null or fee_snapshot > 0) not valid;

create or replace function public.get_admin_teacher_verification_fee()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_value jsonb;
begin
  if v_admin_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_admin_id and p.role = 'admin' and p.is_suspended = false
  ) or not public.is_active_profile() or not public.is_admin() then
    raise exception 'An active administrator account is required';
  end if;

  select s.value into v_value from public.settings s
  where s.key = 'teacher_verification_fee';
  if v_value is null then
    return jsonb_build_object('configured', false, 'amount', null, 'currency', 'KES');
  end if;
  return jsonb_build_object(
    'configured', true,
    'amount', nullif(v_value->>'amount', '')::numeric,
    'currency', coalesce(nullif(v_value->>'currency', ''), 'KES')
  );
end
$$;

create or replace function public.set_admin_teacher_verification_fee(
  amount numeric,
  currency text default 'KES'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  if v_admin_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_admin_id and p.role = 'admin' and p.is_suspended = false
  ) or not public.is_active_profile() or not public.is_admin() then
    raise exception 'An active administrator account is required';
  end if;
  if amount is not null and (amount <= 0 or amount > 999999999.99 or amount <> round(amount, 2)) then
    raise exception 'Fee must be a positive amount with at most two decimal places';
  end if;
  if currency is distinct from 'KES' then
    raise exception 'Only the configured KES fee is supported';
  end if;

  if amount is null then
    delete from public.settings where key = 'teacher_verification_fee';
    return jsonb_build_object('configured', false, 'amount', null, 'currency', 'KES');
  end if;

  insert into public.settings(key, value, description, is_public, updated_by, updated_at)
  values (
    'teacher_verification_fee',
    jsonb_build_object('amount', amount, 'currency', 'KES'),
    'Administrator-configured teacher verification fee; outside-platform arrangement only.',
    false,
    v_admin_id,
    now()
  )
  on conflict (key) do update
    set value = excluded.value,
        description = excluded.description,
        is_public = false,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  return jsonb_build_object('configured', true, 'amount', amount, 'currency', 'KES');
end
$$;

create or replace function public.get_teacher_verification_offer()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_value jsonb;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_teacher_id and p.role = 'teacher' and p.is_suspended = false
  ) or not public.is_active_profile() or not public.has_role('teacher') then
    raise exception 'An active teacher account is required';
  end if;
  select s.value into v_value from public.settings s
  where s.key = 'teacher_verification_fee';
  if v_value is null then
    return jsonb_build_object('configured', false, 'amount', null, 'currency', 'KES');
  end if;
  return jsonb_build_object(
    'configured', true,
    'amount', nullif(v_value->>'amount', '')::numeric,
    'currency', coalesce(nullif(v_value->>'currency', ''), 'KES')
  );
end
$$;

create or replace function public.get_active_teacher_verification_teacher_ids(target_teacher_ids uuid[])
returns table(teacher_id uuid)
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select td.profile_id
  from public.teacher_details td
  join public.profiles p on p.id = td.profile_id
  where td.profile_id = any(coalesce(target_teacher_ids, array[]::uuid[]))
    and td.is_accepting_students = true
    and td.verification_status = 'verified'
    and p.role = 'teacher'
    and p.is_suspended = false
    and exists (
      select 1 from public.badge_awards ba
      where ba.teacher_id = td.profile_id
        and ba.revoked_at is null
        and (ba.expires_at is null or ba.expires_at > now())
    )
$$;

create or replace function public.submit_teacher_verification_request(note text default null)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_note text := nullif(btrim(note), '');
  v_verification_status text;
  v_fee numeric(12,2);
  v_request_id uuid;
begin
  if v_teacher_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_teacher_id and p.role = 'teacher' and p.is_suspended = false
  ) or not public.is_active_profile() or not public.has_role('teacher') then
    raise exception 'An active, unsuspended teacher account is required';
  end if;
  perform 1 from public.profiles p where p.id = v_teacher_id for update;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'The claim note must be 2000 characters or fewer';
  end if;
  select td.verification_status into v_verification_status
  from public.teacher_details td where td.profile_id = v_teacher_id for update;
  if not found then raise exception 'Complete your teacher profile before requesting verification'; end if;

  if exists (
    select 1 from public.badge_awards ba
    where ba.teacher_id = v_teacher_id and ba.revoked_at is null
      and (ba.expires_at is null or ba.expires_at > now())
  ) then
    raise exception 'This teacher profile already has an active verified badge';
  end if;
  if v_verification_status = 'verified' then
    update public.teacher_details set verification_status = 'unverified', updated_at = now()
    where profile_id = v_teacher_id;
  end if;
  if v_verification_status = 'pending' or exists (
    select 1 from public.teacher_verification_requests r
    where r.teacher_id = v_teacher_id and r.status = 'pending'
  ) then
    raise exception 'A verification request is already under review';
  end if;

  select nullif(s.value->>'amount', '')::numeric into v_fee
  from public.settings s where s.key = 'teacher_verification_fee';
  if v_fee is null or v_fee <= 0 then
    raise exception 'Teacher verification pricing has not been configured by an administrator';
  end if;

  insert into public.teacher_verification_requests
    (teacher_id, claim_note, fee_snapshot, fee_currency)
  values (v_teacher_id, v_note, v_fee, 'KES')
  returning id into v_request_id;
  return v_request_id;
end
$$;

create or replace function public.review_teacher_verification_request(
  request_id uuid,
  decision text,
  note text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_reviewer_id uuid := auth.uid();
  v_teacher_id uuid;
  v_note text := nullif(btrim(note), '');
  v_current_status text;
  v_fee numeric(12,2);
begin
  if v_reviewer_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_reviewer_id and p.role = 'admin' and p.is_suspended = false
  ) or not public.is_active_profile() or not public.is_admin() then
    raise exception 'An active, unsuspended administrator account is required';
  end if;
  if decision is null or decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'The review note must be 2000 characters or fewer';
  end if;
  select r.teacher_id, r.status, r.fee_snapshot
    into v_teacher_id, v_current_status, v_fee
  from public.teacher_verification_requests r
  where r.id = request_id for update;
  if not found then raise exception 'Verification request not found'; end if;
  if v_current_status <> 'pending' then raise exception 'Only pending verification requests can be reviewed'; end if;

  if decision = 'approved' then
    if v_fee is null then
      raise exception 'This request has no fee snapshot; ask the teacher to submit after pricing is configured';
    end if;
    if not exists (
      select 1 from public.profiles p
      join public.teacher_details td on td.profile_id = p.id
      where p.id = v_teacher_id and p.role = 'teacher' and p.is_suspended = false
    ) then
      raise exception 'The teacher must have an active profile before approval';
    end if;
    if exists (
      select 1 from public.badge_awards ba
      where ba.teacher_id = v_teacher_id and ba.revoked_at is null
        and (ba.expires_at is null or ba.expires_at > now())
    ) then
      raise exception 'This teacher already has an active badge';
    end if;
  end if;

  update public.teacher_verification_requests
  set status = decision, reviewed_at = now(), reviewer_id = v_reviewer_id, review_note = v_note
  where id = request_id;

  if decision = 'approved' then
    update public.teacher_details set verification_status = 'verified', updated_at = now()
    where profile_id = v_teacher_id;
    if not found then raise exception 'Teacher profile not found'; end if;
    insert into public.badge_awards(teacher_id, awarded_at, expires_at, issued_by)
    values (v_teacher_id, now(), now() + interval '14 days', v_reviewer_id);
  else
    update public.teacher_details set verification_status = 'unverified', updated_at = now()
    where profile_id = v_teacher_id;
  end if;
  return request_id;
end
$$;

create or replace function public.continue_teacher_verification_badge(badge_award_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_teacher_id uuid;
  v_awarded_at timestamptz;
begin
  if v_admin_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_admin_id and p.role = 'admin' and p.is_suspended = false
  ) or not public.is_active_profile() or not public.is_admin() then
    raise exception 'An active administrator account is required';
  end if;
  select ba.teacher_id, ba.awarded_at into v_teacher_id, v_awarded_at
  from public.badge_awards ba where ba.id = badge_award_id and ba.revoked_at is null for update;
  if not found then raise exception 'An unrevoked badge award is required to continue verification'; end if;
  update public.badge_awards set expires_at = null,
    awarded_at = case when expires_at is not null and expires_at <= now() then now() else awarded_at end
  where id = badge_award_id;
  update public.teacher_details set verification_status = 'verified', updated_at = now()
  where profile_id = v_teacher_id;
  if not found then raise exception 'Teacher profile not found'; end if;
  return coalesce((select ba.awarded_at from public.badge_awards ba where ba.id = badge_award_id), v_awarded_at);
end
$$;

create or replace function public.revoke_teacher_verification_badge(badge_award_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_teacher_id uuid;
  v_revoked_at timestamptz;
begin
  if v_admin_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_admin_id and p.role = 'admin' and p.is_suspended = false
  ) or not public.is_active_profile() or not public.is_admin() then
    raise exception 'An active administrator account is required';
  end if;
  update public.badge_awards set revoked_at = now()
  where id = badge_award_id and revoked_at is null
  returning teacher_id, revoked_at into v_teacher_id, v_revoked_at;
  if not found then raise exception 'An active badge award is required to revoke verification'; end if;
  if not exists (
    select 1 from public.badge_awards ba where ba.teacher_id = v_teacher_id
      and ba.revoked_at is null and (ba.expires_at is null or ba.expires_at > now())
  ) then
    update public.teacher_details set verification_status = 'unverified', updated_at = now()
    where profile_id = v_teacher_id;
  end if;
  return v_revoked_at;
end
$$;

revoke all on function public.get_admin_teacher_verification_fee() from public, anon, authenticated;
revoke all on function public.set_admin_teacher_verification_fee(numeric, text) from public, anon, authenticated;
revoke all on function public.get_teacher_verification_offer() from public, anon, authenticated;
revoke all on function public.get_active_teacher_verification_teacher_ids(uuid[]) from public, anon, authenticated;
revoke all on function public.submit_teacher_verification_request(text) from public, anon, authenticated;
revoke all on function public.review_teacher_verification_request(uuid, text, text) from public, anon, authenticated;
revoke all on function public.continue_teacher_verification_badge(uuid) from public, anon, authenticated;
revoke all on function public.revoke_teacher_verification_badge(uuid) from public, anon, authenticated;
grant execute on function public.get_admin_teacher_verification_fee() to authenticated;
grant execute on function public.set_admin_teacher_verification_fee(numeric, text) to authenticated;
grant execute on function public.get_teacher_verification_offer() to authenticated;
grant execute on function public.get_active_teacher_verification_teacher_ids(uuid[]) to anon, authenticated;
grant execute on function public.submit_teacher_verification_request(text) to authenticated;
grant execute on function public.review_teacher_verification_request(uuid, text, text) to authenticated;
grant execute on function public.continue_teacher_verification_badge(uuid) to authenticated;
grant execute on function public.revoke_teacher_verification_badge(uuid) to authenticated;

comment on column public.teacher_verification_requests.fee_snapshot is
  'Fee configured when the teacher submitted; informational only, with no payment status or collection.';
comment on function public.continue_teacher_verification_badge(uuid) is
  'An administrator manually continues an unrevoked trial award without recording or checking payment.';
comment on function public.get_active_teacher_verification_teacher_ids(uuid[]) is
  'Returns only supplied public teacher IDs with a currently unrevoked and unexpired badge award.';

commit;
