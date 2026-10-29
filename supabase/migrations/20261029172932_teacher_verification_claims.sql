begin;

create table public.teacher_verification_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  claim_note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_note text,
  constraint teacher_verification_review_timestamp check (
    (status = 'pending' and reviewed_at is null)
    or (status in ('approved', 'rejected') and reviewed_at is not null)
  ),
  constraint teacher_verification_claim_note_length check (claim_note is null or char_length(claim_note) <= 2000),
  constraint teacher_verification_review_note_length check (review_note is null or char_length(review_note) <= 2000)
);

create unique index teacher_verification_one_pending_per_teacher
  on public.teacher_verification_requests (teacher_id)
  where status = 'pending';
create index teacher_verification_requests_recent
  on public.teacher_verification_requests (submitted_at desc);

create table public.badge_awards (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  issued_by uuid references public.profiles(id) on delete set null
);
create index badge_awards_teacher_recent
  on public.badge_awards (teacher_id, awarded_at desc);

alter table public.teacher_verification_requests enable row level security;
alter table public.badge_awards enable row level security;

revoke all on table public.teacher_verification_requests from public, anon, authenticated;
revoke all on table public.badge_awards from public, anon, authenticated;
grant select on table public.teacher_verification_requests to authenticated;
grant select on table public.badge_awards to authenticated;

create policy teacher_verification_requests_owner_read
  on public.teacher_verification_requests
  for select to authenticated
  using (
    teacher_id = auth.uid()
    and (select public.is_active_profile())
    and public.has_role('teacher')
  );
create policy teacher_verification_requests_admin_read
  on public.teacher_verification_requests
  for select to authenticated
  using ((select public.is_active_profile()) and public.is_admin());
create policy badge_awards_owner_read
  on public.badge_awards
  for select to authenticated
  using (
    teacher_id = auth.uid()
    and (select public.is_active_profile())
    and public.has_role('teacher')
  );
create policy badge_awards_admin_read
  on public.badge_awards
  for select to authenticated
  using ((select public.is_active_profile()) and public.is_admin());

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
  v_request_id uuid;
begin
  if v_teacher_id is null then
    raise exception 'Sign in with an active teacher account to submit a verification request';
  end if;

  perform 1
  from public.profiles p
  where p.id = v_teacher_id
    and p.role = 'teacher'
    and p.is_suspended = false
  for update;
  if not found or not public.is_active_profile() or not public.has_role('teacher') then
    raise exception 'An active, unsuspended teacher account is required';
  end if;

  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'The claim note must be 2000 characters or fewer';
  end if;

  select td.verification_status
  into v_verification_status
  from public.teacher_details td
  where td.profile_id = v_teacher_id;
  if not found then
    raise exception 'Complete your teacher profile before requesting verification';
  end if;
  if v_verification_status = 'verified' then
    raise exception 'This teacher profile is already verified';
  end if;
  if v_verification_status = 'pending' or exists (
    select 1
    from public.teacher_verification_requests r
    where r.teacher_id = v_teacher_id and r.status = 'pending'
  ) then
    raise exception 'A verification request is already under review';
  end if;

  insert into public.teacher_verification_requests (teacher_id, claim_note)
  values (v_teacher_id, v_note)
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
begin
  if v_reviewer_id is null then
    raise exception 'Sign in with an active administrator account to review requests';
  end if;
  if not exists (
    select 1
    from public.profiles p
    where p.id = v_reviewer_id
      and p.role = 'admin'
      and p.is_suspended = false
  ) or not public.is_active_profile() or not public.is_admin() then
    raise exception 'An active, unsuspended administrator account is required';
  end if;
  if decision is null or decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'The review note must be 2000 characters or fewer';
  end if;

  select r.teacher_id, r.status
  into v_teacher_id, v_current_status
  from public.teacher_verification_requests r
  where r.id = request_id
  for update;
  if not found then
    raise exception 'Verification request not found';
  end if;
  if v_current_status <> 'pending' then
    raise exception 'Only pending verification requests can be reviewed';
  end if;

  if decision = 'approved' then
    if not exists (
      select 1
      from public.profiles p
      join public.teacher_details td on td.profile_id = p.id
      where p.id = v_teacher_id
        and p.role = 'teacher'
        and p.is_suspended = false
        and td.verification_status <> 'verified'
    ) then
      raise exception 'The teacher must have an active profile before approval';
    end if;
  end if;

  update public.teacher_verification_requests
  set status = decision,
      reviewed_at = now(),
      reviewer_id = v_reviewer_id,
      review_note = v_note
  where id = request_id;

  if decision = 'approved' then
    update public.teacher_details
    set verification_status = 'verified', updated_at = now()
    where profile_id = v_teacher_id;
    if not found then
      raise exception 'Teacher profile not found';
    end if;

    insert into public.badge_awards (teacher_id, awarded_at, issued_by)
    values (v_teacher_id, now(), v_reviewer_id);
  else
    update public.teacher_details
    set verification_status = 'unverified', updated_at = now()
    where profile_id = v_teacher_id
      and verification_status = 'pending';
  end if;

  return request_id;
end
$$;

revoke all on function public.submit_teacher_verification_request(text) from public, anon, authenticated;
revoke all on function public.review_teacher_verification_request(uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_teacher_verification_request(text) to authenticated;
grant execute on function public.review_teacher_verification_request(uuid, text, text) to authenticated;

comment on table public.teacher_verification_requests is
  'Teacher-submitted verification claims; changes are performed only through security-definer RPCs.';
comment on table public.badge_awards is
  'Administrator-issued teacher verification badge awards; client mutations are not permitted.';
comment on function public.submit_teacher_verification_request(text) is
  'Creates a bounded teacher verification claim for the authenticated active teacher only.';
comment on function public.review_teacher_verification_request(uuid, text, text) is
  'Reviews a pending teacher verification claim as the authenticated active administrator; approval updates teacher details and awards the badge.';

commit;
