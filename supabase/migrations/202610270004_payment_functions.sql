-- Payments unit: pending intent creation, trusted settlement and refund reconciliation.
-- Apply after migrations 001-003. No provider secrets or endpoint calls are stored here.
begin;

create sequence if not exists public.payment_receipt_seq;

alter table public.payments
  add column if not exists idempotency_key text,
  add column if not exists target_id uuid,
  add column if not exists target_student_id uuid references public.profiles(id) on delete restrict,
  add column if not exists target_access_days integer check (target_access_days is null or target_access_days > 0),
  add column if not exists order_id uuid references public.orders(id) on delete set null,
  add column if not exists provider_tracking_id text,
  add column if not exists provider_confirmation_code text,
  add column if not exists checkout_url text;

create unique index if not exists payments_payer_idempotency_unique
  on public.payments (payer_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists payments_provider_tracking_unique
  on public.payments (provider, provider_tracking_id) where provider_tracking_id is not null;

-- Product entitlement uniqueness is made explicit despite nullable opposite target IDs.
create unique index if not exists entitlements_profile_product_unique
  on public.entitlements (profile_id, product_id) where product_id is not null;
create unique index if not exists entitlements_profile_course_unique
  on public.entitlements (profile_id, course_id) where course_id is not null;

insert into public.settings (key, value, description, is_public)
values ('tutoring_commission_percent', '{"tutoring_commission_percent":15}'::jsonb,
        'Default teacher commission for tutoring settlements; editable by administrators.', false)
on conflict (key) do nothing;

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  provider text not null check (provider in ('paystack','pesapal')),
  amount_kes numeric(12,2) not null check (amount_kes > 0),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  provider_reference text,
  submitted_at timestamptz,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_refunds enable row level security;
revoke all on public.payment_refunds from public, anon, authenticated;
grant all on public.payment_refunds to service_role;

create or replace function public.create_payment_intent(
  p_actor uuid,
  p_purpose text,
  p_target_id uuid,
  p_student_id uuid,
  p_provider text,
  p_idempotency_key text,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_student uuid;
  v_existing public.payments%rowtype;
  v_request public.payment_requests%rowtype;
  v_class public.classes%rowtype;
  v_course public.courses%rowtype;
  v_product public.products%rowtype;
  v_price numeric(12,2);
  v_access_days integer;
  v_order_id uuid;
  v_payment_id uuid;
  v_now timestamptz := statement_timestamp();
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_actor is null or p_target_id is null or p_provider not in ('paystack','pesapal')
     or p_purpose not in ('tutoring','course','product')
     or p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 128
     or p_idempotency_key !~ '^[A-Za-z0-9_-]+$'
     or p_reference is null or length(p_reference) > 50 or p_reference !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Invalid payment intent';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_actor::text || ':' || p_idempotency_key, 0));
  select * into v_actor from public.profiles p where p.id = p_actor and not p.is_suspended;
  if not found then raise exception 'Active payer profile required'; end if;

  if p_student_id is null then
    if v_actor.role <> 'student' then raise exception 'Select the learner for this purchase'; end if;
    v_student := p_actor;
  else
    v_student := p_student_id;
    if v_actor.id <> v_student and not exists (
      select 1 from public.parent_student_links l
      where l.parent_id = p_actor and l.student_id = v_student and l.confirmed_at is not null
    ) then raise exception 'Payer is not authorized for this learner'; end if;
    if not exists (select 1 from public.profiles p where p.id = v_student and p.role = 'student' and not p.is_suspended) then
      raise exception 'Active student profile required';
    end if;
  end if;

  select * into v_existing from public.payments p
  where p.payer_id = p_actor and p.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing.purpose <> p_purpose or v_existing.target_id <> p_target_id
       or v_existing.target_student_id <> v_student or v_existing.provider <> p_provider then
      raise exception 'Idempotency key was already used for a different payment';
    end if;
    return jsonb_build_object('id', v_existing.id, 'amount_kes', v_existing.amount_kes,
      'provider_reference', v_existing.provider_reference, 'target_id', v_existing.target_id,
      'target_student_id', v_existing.target_student_id, 'purpose', v_existing.purpose,
      'order_id', v_existing.order_id, 'checkout_url', v_existing.checkout_url,
      'status', v_existing.status, 'reused', true);
  end if;

  if p_purpose = 'tutoring' then
    select * into v_request from public.payment_requests r where r.id = p_target_id for update;
    if not found or v_request.status <> 'pending' or (v_request.expires_at is not null and v_request.expires_at <= v_now)
       or v_request.class_id is null or v_request.student_id is null then
      raise exception 'A current pending class payment request is required';
    end if;
    if v_request.payer_id is not null and v_request.payer_id <> p_actor then raise exception 'Payment request belongs to another payer'; end if;
    if v_request.student_id <> v_student or (p_actor <> v_student and not exists (
      select 1 from public.parent_student_links l
      where l.parent_id = p_actor and l.student_id = v_student and l.confirmed_at is not null
    )) then raise exception 'Payment request does not match the selected learner'; end if;
    select * into v_class from public.classes c where c.id = v_request.class_id and c.teacher_id = v_request.teacher_id
      and c.is_active and c.is_published;
    if not found then raise exception 'Class payment request is no longer valid'; end if;
    v_price := v_request.amount_kes;
  elsif p_purpose = 'course' then
    select * into v_course from public.courses c where c.id = p_target_id and c.status = 'published' and not c.is_free;
    if not found then raise exception 'Published paid course not found'; end if;
    if exists (select 1 from public.course_enrolments e where e.course_id = p_target_id and e.student_id = v_student and e.status in ('active','completed') and (e.expires_at is null or e.expires_at > v_now)) then
      raise exception 'Learner already has course access';
    end if;
    select cp.price_kes, cp.access_days into v_price, v_access_days
    from public.course_prices cp
    where cp.course_id = p_target_id and cp.is_active
      and (cp.starts_at is null or cp.starts_at <= v_now) and (cp.ends_at is null or cp.ends_at > v_now)
    order by cp.created_at desc limit 1;
    if not found then raise exception 'No active course price is configured'; end if;
    if v_access_days is null then
      select cp.access_days into v_access_days from public.course_prices cp
      where cp.course_id = p_target_id and cp.is_active
        and (cp.starts_at is null or cp.starts_at <= v_now) and (cp.ends_at is null or cp.ends_at > v_now)
      order by cp.created_at desc limit 1;
    end if;
    select coalesce(cp.sale_price_kes, cp.price_kes) into v_price
    from public.course_prices cp
    where cp.course_id = p_target_id and cp.is_active
      and (cp.starts_at is null or cp.starts_at <= v_now) and (cp.ends_at is null or cp.ends_at > v_now)
    order by cp.created_at desc limit 1;
  else
    select * into v_product from public.products p where p.id = p_target_id and p.status = 'published' and not p.is_free;
    if not found then raise exception 'Published paid product not found'; end if;
    if exists (select 1 from public.entitlements e where e.profile_id = v_student and e.product_id = p_target_id and e.status = 'active' and (e.ends_at is null or e.ends_at > v_now)) then
      raise exception 'Learner already has product access';
    end if;
    v_price := case when v_product.sale_price_kes is not null
                       and (v_product.sale_starts_at is null or v_product.sale_starts_at <= v_now)
                       and (v_product.sale_ends_at is null or v_product.sale_ends_at > v_now)
                    then v_product.sale_price_kes else v_product.price_kes end;
    v_access_days := v_product.access_days;
  end if;
  if v_price is null or v_price <= 0 then raise exception 'A positive KES price is required'; end if;

  insert into public.payments
    (payer_id, amount_kes, currency, purpose, provider, provider_reference, status, payment_request_id,
     idempotency_key, target_id, target_student_id, target_access_days)
  values
    (p_actor, v_price, 'KES', p_purpose, p_provider, p_reference, 'pending',
     case when p_purpose = 'tutoring' then p_target_id else null end,
     p_idempotency_key, p_target_id, v_student, v_access_days)
  returning id into v_payment_id;

  if p_purpose = 'product' then
    insert into public.orders (buyer_id, payment_id, status, subtotal_kes, discount_kes, total_kes)
    values (p_actor, v_payment_id, 'pending', v_price, 0, v_price) returning id into v_order_id;
    insert into public.order_items (order_id, product_id, title_snapshot, quantity, unit_price_kes)
    values (v_order_id, v_product.id, v_product.title, 1, v_price);
    update public.payments set order_id = v_order_id where id = v_payment_id;
  end if;
  if p_purpose = 'tutoring' and v_request.payer_id is null then
    update public.payment_requests set payer_id = p_actor where id = p_target_id;
  end if;

  return jsonb_build_object('id', v_payment_id, 'amount_kes', v_price, 'provider_reference', p_reference,
    'target_id', p_target_id, 'target_student_id', v_student, 'purpose', p_purpose,
    'order_id', v_order_id, 'checkout_url', null, 'status', 'pending', 'reused', false);
end
$$;
revoke all on function public.create_payment_intent(uuid,text,uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.create_payment_intent(uuid,text,uuid,uuid,text,text,text) to service_role;

create or replace function public.settle_payment_atomic(
  p_payment_id uuid,
  p_provider text,
  p_reference text,
  p_currency text,
  p_amount_kes numeric,
  p_tracking_id text default null,
  p_confirmation_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_request public.payment_requests%rowtype;
  v_class public.classes%rowtype;
  v_commission_percent numeric(5,2) := 15;
  v_setting jsonb;
  v_commission numeric(12,2);
  v_teacher_net numeric(12,2);
  v_receipt text;
  v_seq bigint;
  v_now timestamptz := statement_timestamp();
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_payment from public.payments p where p.id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.status = 'successful' then
    if v_payment.provider = p_provider and v_payment.provider_reference = p_reference
       and v_payment.currency = p_currency and v_payment.amount_kes = p_amount_kes then
      return jsonb_build_object('settled', true, 'duplicate', true, 'payment_id', v_payment.id);
    end if;
    raise exception 'Payment already settled with different transaction details';
  end if;
  if v_payment.status <> 'pending' then raise exception 'Payment is not pending'; end if;
  if v_payment.provider is distinct from p_provider or v_payment.provider_reference is distinct from p_reference
     or p_currency <> 'KES' or v_payment.currency <> 'KES' or v_payment.amount_kes <> p_amount_kes then
    raise exception 'Provider transaction does not match the pending payment';
  end if;

  if v_payment.purpose = 'tutoring' then
    select value into v_setting from public.settings where key = 'tutoring_commission_percent';
    begin
      v_commission_percent := coalesce(nullif(v_setting ->> 'tutoring_commission_percent',''), nullif(v_setting #>> '{}',''), '15')::numeric;
    exception when others then v_commission_percent := 15;
    end;
    if v_commission_percent < 0 or v_commission_percent > 100 then v_commission_percent := 15; end if;
    select * into v_request from public.payment_requests r where r.id = v_payment.payment_request_id for update;
    if not found or v_request.status not in ('pending','paid') then raise exception 'Tutoring request is no longer settleable'; end if;
    select * into v_class from public.classes c where c.id = v_request.class_id and c.teacher_id = v_request.teacher_id and c.is_active;
    if not found then raise exception 'Tutoring class is no longer active'; end if;
    update public.payment_requests set status = 'paid', payer_id = coalesce(payer_id, v_payment.payer_id)
      where id = v_request.id and status = 'pending';
    insert into public.enrolments (class_id, student_id, payer_id, status, lessons_remaining)
    values (v_class.id, v_payment.target_student_id, v_payment.payer_id, 'active', v_class.lessons_in_bundle)
    on conflict (class_id,student_id) do update set payer_id = excluded.payer_id, status = 'active',
      lessons_remaining = coalesce(excluded.lessons_remaining, public.enrolments.lessons_remaining);
  elsif v_payment.purpose = 'course' then
    if not exists (select 1 from public.courses c where c.id = v_payment.target_id and c.status = 'published') then
      raise exception 'Course is no longer published';
    end if;
    insert into public.course_enrolments (course_id, student_id, payment_id, status, expires_at)
    values (v_payment.target_id, v_payment.target_student_id, v_payment.id, 'active',
      case when v_payment.target_access_days is null then null else v_now + make_interval(days => v_payment.target_access_days) end)
    on conflict (course_id,student_id) do update set payment_id = excluded.payment_id, status = 'active',
      enrolled_at = v_now, expires_at = excluded.expires_at;
    v_commission_percent := 100;
  elsif v_payment.purpose = 'product' then
    if not exists (select 1 from public.products p where p.id = v_payment.target_id and p.status = 'published') then
      raise exception 'Product is no longer published';
    end if;
    if v_payment.order_id is null then raise exception 'Product order is missing'; end if;
    update public.orders set status = 'paid' where id = v_payment.order_id and payment_id = v_payment.id;
    insert into public.entitlements (profile_id, product_id, order_id, payment_id, status, starts_at, ends_at, download_limit)
    select v_payment.target_student_id, p.id, v_payment.order_id, v_payment.id, 'active', v_now,
      case when v_payment.target_access_days is null then null else v_now + make_interval(days => v_payment.target_access_days) end,
      p.download_limit
    from public.products p where p.id = v_payment.target_id
    on conflict (profile_id,product_id) where product_id is not null do update
      set order_id = excluded.order_id, payment_id = excluded.payment_id, status = 'active', starts_at = v_now,
          ends_at = excluded.ends_at, download_limit = excluded.download_limit;
    v_commission_percent := 100;
  else
    raise exception 'Unsupported payment purpose';
  end if;

  v_commission := round(v_payment.amount_kes * v_commission_percent / 100, 2);
  v_teacher_net := v_payment.amount_kes - v_commission;
  update public.payments set status = 'successful', paid_at = v_now, updated_at = v_now,
    provider_tracking_id = coalesce(p_tracking_id, provider_tracking_id),
    provider_confirmation_code = coalesce(p_confirmation_code, provider_confirmation_code)
  where id = v_payment.id;

  insert into public.ledger_entries (payment_id, account_profile_id, entry_type, amount_kes, direction, description, metadata)
  values (v_payment.id, null, 'provider_gross', v_payment.amount_kes, 'debit', 'Provider gross collection',
          jsonb_build_object('provider', p_provider, 'gross_kes', v_payment.amount_kes)),
         (v_payment.id, null, 'platform_commission', v_commission, 'credit', 'Platform commission',
          jsonb_build_object('provider', p_provider, 'gross_kes', v_payment.amount_kes, 'commission_percent', v_commission_percent)),
         (v_payment.id, case when v_payment.purpose = 'tutoring' then v_request.teacher_id else null end,
          'teacher_net', v_teacher_net, 'credit', 'Teacher net proceeds',
          jsonb_build_object('provider', p_provider, 'gross_kes', v_payment.amount_kes, 'teacher_net_kes', v_teacher_net));

  v_seq := nextval('public.payment_receipt_seq');
  v_receipt := 'LEX-' || to_char(v_now, 'YYYY') || '-' || lpad(v_seq::text, 6, '0');
  insert into public.receipts (payment_id, receipt_number, owner_id, metadata)
  values (v_payment.id, v_receipt, v_payment.payer_id,
          jsonb_build_object('currency','KES','purpose',v_payment.purpose,'provider',p_provider));
  return jsonb_build_object('settled', true, 'duplicate', false, 'payment_id', v_payment.id, 'receipt_number', v_receipt);
end
$$;
revoke all on function public.settle_payment_atomic(uuid,text,text,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.settle_payment_atomic(uuid,text,text,text,numeric,text,text) to service_role;

create or replace function public.request_payment_refund(p_payment_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_refund public.payment_refunds%rowtype;
  v_created boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_payment from public.payments p where p.id = p_payment_id for update;
  if not found or v_payment.payer_id <> p_actor or v_payment.status <> 'successful' then
    raise exception 'Only the payer of a successful payment may request a refund';
  end if;
  insert into public.payment_refunds (payment_id, provider, amount_kes, status)
  values (v_payment.id, v_payment.provider, v_payment.amount_kes, 'pending')
  on conflict (payment_id) do nothing returning * into v_refund;
  if found then v_created := true;
  else select * into v_refund from public.payment_refunds r where r.payment_id = v_payment.id for update;
  end if;
  return jsonb_build_object('id', v_refund.id, 'status', v_refund.status, 'amount_kes', v_refund.amount_kes,
    'provider_reference', v_refund.provider_reference, 'created', v_created);
end
$$;
revoke all on function public.request_payment_refund(uuid,uuid) from public, anon, authenticated;
grant execute on function public.request_payment_refund(uuid,uuid) to service_role;

create or replace function public.record_payment_refund_submission(p_refund_id uuid, p_provider_reference text default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  update public.payment_refunds set provider_reference = coalesce(p_provider_reference, provider_reference),
    submitted_at = coalesce(submitted_at, statement_timestamp()), updated_at = statement_timestamp()
  where id = p_refund_id and status = 'pending';
  if not found then raise exception 'Pending refund request not found'; end if;
end
$$;
revoke all on function public.record_payment_refund_submission(uuid,text) from public, anon, authenticated;
grant execute on function public.record_payment_refund_submission(uuid,text) to service_role;

-- This RPC is the only code path that reverses entitlements or ledger entries. Call it
-- only after a provider or authorized finance reconciliation confirms the refund.
create or replace function public.confirm_payment_refund(p_refund_id uuid, p_provider_reference text default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_refund public.payment_refunds%rowtype;
  v_payment public.payments%rowtype;
  v_request public.payment_requests%rowtype;
  v_entry record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_refund from public.payment_refunds r where r.id = p_refund_id for update;
  if not found then raise exception 'Refund request not found'; end if;
  select * into v_payment from public.payments p where p.id = v_refund.payment_id for update;
  if v_refund.status = 'confirmed' and v_payment.status = 'refunded' then
    return jsonb_build_object('confirmed', true, 'duplicate', true, 'payment_id', v_payment.id);
  end if;
  if v_refund.status <> 'pending' or v_payment.status <> 'successful' or v_refund.amount_kes <> v_payment.amount_kes then
    raise exception 'Refund is not confirmable';
  end if;
  update public.payment_refunds set status = 'confirmed', provider_reference = coalesce(p_provider_reference, provider_reference),
    reconciled_at = statement_timestamp(), updated_at = statement_timestamp() where id = v_refund.id;
  update public.payments set status = 'refunded', updated_at = statement_timestamp() where id = v_payment.id;
  if v_payment.purpose = 'product' then
    update public.entitlements set status = 'refunded' where payment_id = v_payment.id and status = 'active';
    update public.orders set status = 'refunded' where id = v_payment.order_id;
  elsif v_payment.purpose = 'course' then
    update public.course_enrolments set status = 'refunded' where payment_id = v_payment.id and status in ('active','completed');
  elsif v_payment.purpose = 'tutoring' then
    select * into v_request from public.payment_requests where id = v_payment.payment_request_id;
    update public.enrolments set status = 'refunded'
      where class_id = v_request.class_id and student_id = v_payment.target_student_id and status = 'active';
  end if;
  for v_entry in select * from public.ledger_entries where payment_id = v_payment.id loop
    insert into public.ledger_entries (payment_id, account_profile_id, entry_type, amount_kes, direction, description, metadata)
    values (v_payment.id, v_entry.account_profile_id, 'refund_reversal_' || v_entry.entry_type,
      v_entry.amount_kes, case when v_entry.direction = 'credit' then 'debit' else 'credit' end,
      'Confirmed provider refund reversal', jsonb_build_object('provider',v_payment.provider,'refund_id',v_refund.id,
       'original_entry_id',v_entry.id,'provider_reference',p_provider_reference));
  end loop;
  return jsonb_build_object('confirmed', true, 'duplicate', false, 'payment_id', v_payment.id);
end
$$;
revoke all on function public.confirm_payment_refund(uuid,text) from public, anon, authenticated;
grant execute on function public.confirm_payment_refund(uuid,text) to service_role;

commit;
