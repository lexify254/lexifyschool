-- Security hardening for Lexify School, after migrations 001 and 002.
-- Preserve admin_all policies for authenticated administrators. Trusted server/service-role
-- routes (which do not carry an end-user auth.uid()) remain able to perform server writes.
begin;

-- Protect account role, suspension and auth-owned identity fields. Users may still edit
-- their own ordinary profile fields; admins retain intended access through admin_all.
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.is_suspended is distinct from old.is_suspended
       or new.email is distinct from old.email
       or new.created_at is distinct from old.created_at then
      raise exception 'Role, suspension, auth identity, and account creation fields require administrator authorization';
    end if;
  end if;
  return new;
end
$$;
revoke all on function public.guard_profile_role_change() from public, anon, authenticated;
drop trigger if exists guard_profile_role_change on public.profiles;
create trigger guard_profile_role_change
before update on public.profiles
for each row execute function public.guard_profile_role_change();
comment on function public.guard_profile_role_change() is
  'Prevents self-service changes to role, suspension, auth-linked email, primary identity, and creation timestamp.';

-- Teachers can edit their public details but cannot claim verified/revoked status.
-- Self-created rows (if any client path is added later) must start unverified.
create or replace function public.guard_teacher_verification_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.verification_status is distinct from 'unverified' then
        raise exception 'Teacher verification status is administrator-controlled';
      end if;
    elsif new.verification_status is distinct from old.verification_status then
      raise exception 'Teacher verification status is administrator-controlled';
    end if;
  end if;
  return new;
end
$$;
revoke all on function public.guard_teacher_verification_status() from public, anon, authenticated;
drop trigger if exists guard_teacher_verification_status on public.teacher_details;
create trigger guard_teacher_verification_status
before insert or update on public.teacher_details
for each row execute function public.guard_teacher_verification_status();
drop policy if exists teacher_details_self_manage on public.teacher_details;
drop policy if exists teacher_details_self_update on public.teacher_details;
create policy teacher_details_self_update on public.teacher_details
  for update to authenticated
  using (profile_id = auth.uid() and public.has_role('teacher'))
  with check (profile_id = auth.uid() and public.has_role('teacher'));
comment on function public.guard_teacher_verification_status() is
  'Allows teacher self-service edits to non-status details while verification transitions remain trusted/admin-only.';

-- Learners can edit only ordinary profile/preferences fields. Grade and pathway changes
-- are permitted only within the already-validated save_student_subjects RPC. The RPC is
-- wrapped below to set a transaction-local marker, and its implementation is no longer
-- directly executable by clients. The parent community-access RPC remains usable only
-- for a confirmed child relationship; direct student updates cannot change that setting.
create or replace function public.guard_student_details_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_rpc_allowed boolean := coalesce(current_setting('lexifyschool.validated_subject_save', true), 'off') = 'on';
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    raise exception 'Student details are created by signup or an administrator';
  end if;

  if new.profile_id is distinct from old.profile_id
     or new.education_system_id is distinct from old.education_system_id
     or new.track_id is distinct from old.track_id
     or new.is_deaf_learner is distinct from old.is_deaf_learner
     or new.consent_given is distinct from old.consent_given
     or new.consent_at is distinct from old.consent_at
     or new.parent_id is distinct from old.parent_id
     or new.created_at is distinct from old.created_at then
    raise exception 'System, consent, deaf-learner, identity, and parent-link fields require trusted/admin changes';
  end if;

  if (new.grade_id is distinct from old.grade_id or new.pathway_id is distinct from old.pathway_id)
     and not v_rpc_allowed then
    raise exception 'Grade and pathway changes must use save_student_subjects';
  end if;

  if new.community_enabled is distinct from old.community_enabled
     and not public.is_parent_of(old.profile_id) then
    raise exception 'Community access for a learner is controlled by a confirmed parent or administrator';
  end if;
  return new;
end
$$;
revoke all on function public.guard_student_details_write() from public, anon, authenticated;
drop trigger if exists guard_student_details_write on public.student_details;
create trigger guard_student_details_write
before insert or update on public.student_details
for each row execute function public.guard_student_details_write();
drop policy if exists student_details_self_insert on public.student_details;
drop policy if exists student_details_self_update on public.student_details;
create policy student_details_self_update on public.student_details
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
comment on function public.guard_student_details_write() is
  'Restricts student self-edits to school/county/goals/hobbies (plus authorized parent community-access changes); curriculum updates use the validated RPC.';

-- Keep the existing validated RPC implementation but wrap it so student_details
-- triggers can distinguish its safe grade/pathway update from direct client writes.
do $$
begin
  if to_regprocedure('public.save_student_subjects_impl(uuid,uuid[],uuid,uuid)') is null
     and to_regprocedure('public.save_student_subjects(uuid,uuid[],uuid,uuid)') is not null then
    alter function public.save_student_subjects(uuid, uuid[], uuid, uuid)
      rename to save_student_subjects_impl;
  end if;
end
$$;
create or replace function public.save_student_subjects(
  grade_id uuid,
  selected_area_ids uuid[],
  pathway_id uuid default null,
  track_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_result jsonb;
begin
  perform set_config('lexifyschool.validated_subject_save', 'on', true);
  v_result := public.save_student_subjects_impl(grade_id, selected_area_ids, pathway_id, track_id);
  perform set_config('lexifyschool.validated_subject_save', 'off', true);
  return v_result;
end
$$;
revoke all on function public.save_student_subjects_impl(uuid, uuid[], uuid, uuid) from public, anon, authenticated;
revoke all on function public.save_student_subjects(uuid, uuid[], uuid, uuid) from public, anon;
grant execute on function public.save_student_subjects(uuid, uuid[], uuid, uuid) to authenticated;
comment on function public.save_student_subjects(uuid, uuid[], uuid, uuid) is
  'Validates and atomically saves learner curriculum selections; sole client path to update grade/pathway.';

-- A teacher may create only a fresh requested payout. Only administrators/trusted
-- server routes may update or process payout records; admin_all remains effective.
create or replace function public.guard_payout_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if auth.uid() is null or public.is_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.teacher_id is distinct from auth.uid()
       or new.status is distinct from 'requested'
       or new.processed_at is not null
       or new.processed_by is not null
       or new.payout_reference is not null then
      raise exception 'Teachers may create only unprocessed payout requests in requested status';
    end if;
    return new;
  end if;
  raise exception 'Payout requests may be processed only by an administrator or trusted server';
end
$$;
revoke all on function public.guard_payout_request() from public, anon, authenticated;
drop trigger if exists guard_payout_request on public.payout_requests;
create trigger guard_payout_request
before insert or update or delete on public.payout_requests
for each row execute function public.guard_payout_request();
drop policy if exists payout_teacher_insert on public.payout_requests;
create policy payout_teacher_insert on public.payout_requests
  for insert to authenticated
  with check (teacher_id = auth.uid() and status = 'requested' and public.has_role('teacher'));
comment on function public.guard_payout_request() is
  'Enforces requested-only teacher creation and prevents teacher-side payout processing or mutation.';

-- Teacher-created badge purchases remain pending until administrator/server confirmation.
create or replace function public.guard_badge_purchase()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if auth.uid() is null or public.is_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.teacher_id is distinct from auth.uid() or new.status is distinct from 'pending' then
      raise exception 'Teacher-created badge purchases must belong to the teacher and remain pending';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    raise exception 'Badge purchase status is administrator/server-controlled';
  end if;
  return new;
end
$$;
revoke all on function public.guard_badge_purchase() from public, anon, authenticated;
drop trigger if exists guard_badge_purchase on public.badge_purchases;
create trigger guard_badge_purchase
before insert or update on public.badge_purchases
for each row execute function public.guard_badge_purchase();
drop policy if exists badge_purchase_teacher_insert on public.badge_purchases;
create policy badge_purchase_teacher_insert on public.badge_purchases
  for insert to authenticated
  with check (teacher_id = auth.uid() and status = 'pending' and public.has_role('teacher'));
comment on function public.guard_badge_purchase() is
  'Keeps teacher-created badge purchases pending until a trusted confirmation.';

-- Orders are server-created and server-updated monetary records. Buyers retain their
-- existing read policy; removing the client insert policy makes admin_all the only
-- authenticated direct-write policy while service-role routes remain available.
drop policy if exists orders_owner_insert on public.orders;
create or replace function public.guard_order_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Orders and order totals are created or changed only by a trusted server or administrator';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;
revoke all on function public.guard_order_write() from public, anon, authenticated;
drop trigger if exists guard_order_write on public.orders;
create trigger guard_order_write
before insert or update or delete on public.orders
for each row execute function public.guard_order_write();
comment on function public.guard_order_write() is
  'Rejects client-authenticated order creation/mutation; buyers continue to read their own orders.';

-- Attempt scores are trusted grading results. Learners may create attempts and edit
-- answers only before submission; submitted attempts cannot be updated/deleted by them.
create or replace function public.guard_quiz_attempt()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if auth.uid() is null or public.is_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.student_id is distinct from auth.uid() or new.score is not null then
      raise exception 'Learners may create only their own ungraded quiz attempts';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.submitted_at is not null then
      raise exception 'Submitted quiz attempts cannot be deleted';
    end if;
    return old;
  end if;

  if old.submitted_at is not null then
    raise exception 'Submitted quiz attempts cannot be changed';
  end if;
  if new.id is distinct from old.id
     or new.quiz_id is distinct from old.quiz_id
     or new.student_id is distinct from old.student_id
     or new.started_at is distinct from old.started_at
     or new.score is distinct from old.score
     or new.score is not null then
    raise exception 'Attempt identity and score fields are server/admin-controlled';
  end if;
  return new;
end
$$;
revoke all on function public.guard_quiz_attempt() from public, anon, authenticated;
drop trigger if exists guard_quiz_attempt on public.quiz_attempts;
create trigger guard_quiz_attempt
before insert or update or delete on public.quiz_attempts
for each row execute function public.guard_quiz_attempt();
drop trigger if exists guard_course_quiz_attempt on public.course_quiz_attempts;
create trigger guard_course_quiz_attempt
before insert or update or delete on public.course_quiz_attempts
for each row execute function public.guard_quiz_attempt();
drop policy if exists quiz_attempts_self_write on public.quiz_attempts;
drop policy if exists quiz_attempts_self_insert on public.quiz_attempts;
drop policy if exists quiz_attempts_self_update on public.quiz_attempts;
drop policy if exists quiz_attempts_self_delete on public.quiz_attempts;
create policy quiz_attempts_self_insert on public.quiz_attempts
  for insert to authenticated with check (student_id = auth.uid() and score is null);
create policy quiz_attempts_self_update on public.quiz_attempts
  for update to authenticated
  using (student_id = auth.uid() and submitted_at is null)
  with check (student_id = auth.uid() and score is null);
create policy quiz_attempts_self_delete on public.quiz_attempts
  for delete to authenticated using (student_id = auth.uid() and submitted_at is null);
drop policy if exists course_quiz_attempts_owner on public.course_quiz_attempts;
drop policy if exists course_quiz_attempts_owner_insert on public.course_quiz_attempts;
drop policy if exists course_quiz_attempts_owner_update on public.course_quiz_attempts;
drop policy if exists course_quiz_attempts_owner_delete on public.course_quiz_attempts;
create policy course_quiz_attempts_owner_insert on public.course_quiz_attempts
  for insert to authenticated
  with check (student_id = auth.uid() and score is null and exists (
    select 1 from public.course_quizzes q
    join public.course_lessons l on l.id = q.lesson_id
    join public.course_modules m on m.id = l.module_id
    where q.id = quiz_id and (l.is_free_preview or public.has_course_access(m.course_id))
  ));
create policy course_quiz_attempts_owner_update on public.course_quiz_attempts
  for update to authenticated
  using (student_id = auth.uid() and submitted_at is null)
  with check (student_id = auth.uid() and score is null and exists (
    select 1 from public.course_quizzes q
    join public.course_lessons l on l.id = q.lesson_id
    join public.course_modules m on m.id = l.module_id
    where q.id = quiz_id and (l.is_free_preview or public.has_course_access(m.course_id))
  ));
create policy course_quiz_attempts_owner_delete on public.course_quiz_attempts
  for delete to authenticated using (student_id = auth.uid() and submitted_at is null);
comment on function public.guard_quiz_attempt() is
  'Protects learner quiz scores and makes submitted quiz_attempts/course_quiz_attempts immutable to learners.';

-- Sender update policies alone do not constrain individual columns. Keep message text
-- and soft-edit metadata editable, but prohibit changing ownership, routing, attachment,
-- reply, identity, or creation fields on existing chat/community messages.
create or replace function public.guard_message_sender_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_table_name = 'chat_messages' then
    if new.id is distinct from old.id
       or new.group_id is distinct from old.group_id
       or new.sender_id is distinct from old.sender_id
       or new.attachment_path is distinct from old.attachment_path
       or new.reply_to is distinct from old.reply_to
       or new.created_at is distinct from old.created_at then
      raise exception 'Message identity, group, attachment, and reply fields cannot be changed by the sender';
    end if;
  elsif tg_table_name = 'community_messages' then
    if new.id is distinct from old.id
       or new.channel_id is distinct from old.channel_id
       or new.sender_id is distinct from old.sender_id
       or new.attachment_path is distinct from old.attachment_path
       or new.reply_to is distinct from old.reply_to
       or new.created_at is distinct from old.created_at then
      raise exception 'Message identity, channel, attachment, and reply fields cannot be changed by the sender';
    end if;
  end if;
  if old.deleted_at is not null then
    raise exception 'Deleted messages cannot be edited';
  end if;
  return new;
end
$$;
revoke all on function public.guard_message_sender_update() from public, anon, authenticated;
drop trigger if exists guard_chat_message_sender_update on public.chat_messages;
create trigger guard_chat_message_sender_update
before update on public.chat_messages
for each row execute function public.guard_message_sender_update();
drop trigger if exists guard_community_message_sender_update on public.community_messages;
create trigger guard_community_message_sender_update
before update on public.community_messages
for each row execute function public.guard_message_sender_update();
comment on function public.guard_message_sender_update() is
  'Limits sender edits to body/edit metadata; sender, channel/group, attachment, reply, and message identity remain fixed.';

-- Public class listings must never expose meeting URLs. Anonymous clients use this
-- curated view; authenticated member/teacher/admin access to the classes base table is
-- unchanged. The view owner evaluates the published-only predicate, and no meeting_link
-- column is present in the view definition.
revoke select on public.classes from anon;
create or replace view public.public_class_listings
with (security_barrier = true)
as
  select id, teacher_id, grade_id, learning_area_id, strand_id, title, description,
         schedule, capacity, payment_basis, price_kes, lessons_in_bundle,
         is_published, is_active, created_at, updated_at
  from public.classes
  where is_published and is_active;
revoke all on public.public_class_listings from public;
grant select on public.public_class_listings to anon, authenticated;
comment on view public.public_class_listings is
  'Safe public view of published active classes; meeting_link is intentionally omitted.';

commit;
