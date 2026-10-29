begin;

create table if not exists public.whatsapp_handoff_counts (
  id bigint generated always as identity primary key,
  item_type text not null check (item_type in ('teacher_profile', 'class', 'course', 'product')),
  item_id uuid not null,
  seller_id uuid references public.profiles(id) on delete cascade,
  seller_key text generated always as (coalesce(seller_id::text, 'platform')) stored,
  handoff_count bigint not null default 0 check (handoff_count >= 0),
  updated_at timestamptz not null default now()
);
create unique index if not exists whatsapp_handoff_counts_item_seller_unique
  on public.whatsapp_handoff_counts (item_type, item_id, seller_key);

alter table public.whatsapp_handoff_counts enable row level security;
revoke all on table public.whatsapp_handoff_counts from anon, authenticated;
grant select on table public.whatsapp_handoff_counts to authenticated;
drop policy if exists whatsapp_handoff_counts_seller_admin_read on public.whatsapp_handoff_counts;
create policy whatsapp_handoff_counts_seller_admin_read
  on public.whatsapp_handoff_counts
  for select to authenticated
  using (
    public.is_active_profile()
    and (seller_id = auth.uid() or public.is_admin())
  );

create index if not exists whatsapp_handoff_counts_seller_idx
  on public.whatsapp_handoff_counts (seller_id)
  where seller_id is not null;

create table if not exists public.seller_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  public_token uuid not null unique default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  seller_name text not null check (char_length(btrim(seller_name)) between 1 and 120),
  buyer_name text check (buyer_name is null or char_length(btrim(buyer_name)) <= 120),
  item_title text not null check (char_length(btrim(item_title)) between 1 and 180),
  item_description text check (item_description is null or char_length(item_description) <= 500),
  quantity integer not null check (quantity between 1 and 1000),
  unit_price_kes numeric(12,2) not null check (unit_price_kes >= 0 and unit_price_kes <= 10000000),
  total_kes numeric(14,2) generated always as (quantity * unit_price_kes) stored,
  currency text not null default 'KES' check (currency = 'KES'),
  created_at timestamptz not null default now()
);

create or replace function public.assign_seller_receipt_number()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;
  if new.created_at is null then
    new.created_at := now();
  end if;
  if new.public_token is null then
    new.public_token := gen_random_uuid();
  end if;
  if new.receipt_number is null or btrim(new.receipt_number) = '' then
    new.receipt_number := 'LEX-'
      || to_char(new.created_at at time zone 'UTC', 'YYYYMMDD')
      || '-'
      || upper(substr(replace(new.id::text, '-', ''), 1, 8));
  end if;
  return new;
end;
$$;
revoke all on function public.assign_seller_receipt_number() from public, anon, authenticated;
drop trigger if exists seller_receipts_assign_number on public.seller_receipts;
create trigger seller_receipts_assign_number
  before insert on public.seller_receipts
  for each row execute function public.assign_seller_receipt_number();

alter table public.seller_receipts enable row level security;
revoke all on table public.seller_receipts from anon, authenticated;
grant select on table public.seller_receipts to authenticated;
drop policy if exists seller_receipts_owner_admin_read on public.seller_receipts;
create policy seller_receipts_owner_admin_read
  on public.seller_receipts
  for select to authenticated
  using (
    public.is_active_profile()
    and (seller_id = auth.uid() or public.is_admin())
  );

create index if not exists seller_receipts_seller_created_idx
  on public.seller_receipts (seller_id, created_at desc);

create or replace function public.create_seller_receipt(
  p_confirm_external_sale boolean,
  p_buyer_name text,
  p_item_title text,
  p_item_description text,
  p_quantity integer,
  p_unit_price_kes numeric
)
returns table (
  id uuid,
  receipt_number text,
  public_token uuid,
  seller_id uuid,
  seller_name text,
  buyer_name text,
  item_title text,
  item_description text,
  quantity integer,
  unit_price_kes numeric,
  total_kes numeric,
  currency text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_full_name text;
  v_seller_name text;
  v_receipt public.seller_receipts%rowtype;
begin
  if p_confirm_external_sale is distinct from true then
    raise exception 'Confirm that the sale was completed outside Lexify School before issuing a receipt.' using errcode = '22023';
  end if;

  if v_user_id is null or not public.is_active_profile() then
    raise exception 'An active signed-in seller is required.' using errcode = '42501';
  end if;

  select p.role, p.full_name
    into v_role, v_full_name
    from public.profiles p
    where p.id = v_user_id and p.is_suspended = false;
  if not found or v_role not in ('teacher', 'admin') then
    raise exception 'Only active teachers and administrators may issue seller receipts.' using errcode = '42501';
  end if;

  if p_item_title is null or char_length(btrim(p_item_title)) not between 1 and 180 then
    raise exception 'An item title of 1 to 180 characters is required.' using errcode = '22023';
  end if;
  if p_item_description is not null and char_length(p_item_description) > 500 then
    raise exception 'Item description must not exceed 500 characters.' using errcode = '22023';
  end if;
  if p_buyer_name is not null and char_length(btrim(p_buyer_name)) > 120 then
    raise exception 'Buyer name must not exceed 120 characters.' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity not between 1 and 1000 then
    raise exception 'Quantity must be between 1 and 1000.' using errcode = '22023';
  end if;
  if p_unit_price_kes is null or p_unit_price_kes < 0 or p_unit_price_kes > 10000000 then
    raise exception 'Unit price must be between KES 0 and KES 10,000,000.' using errcode = '22023';
  end if;

  if v_role = 'admin' then
    v_seller_name := 'Lexify School';
  else
    select coalesce(
      (
        select nullif(btrim(td.public_name), '')
          from public.teacher_details td
          where td.profile_id = v_user_id
      ),
      nullif(btrim(v_full_name), '')
    ) into v_seller_name;
  end if;
  if v_seller_name is null or char_length(v_seller_name) > 120 then
    raise exception 'A valid seller name is required before a receipt can be issued.' using errcode = '22023';
  end if;

  insert into public.seller_receipts (
    seller_id,
    seller_name,
    buyer_name,
    item_title,
    item_description,
    quantity,
    unit_price_kes
  ) values (
    v_user_id,
    v_seller_name,
    nullif(btrim(p_buyer_name), ''),
    btrim(p_item_title),
    nullif(btrim(p_item_description), ''),
    p_quantity,
    p_unit_price_kes
  ) returning * into v_receipt;

  return query
    select v_receipt.id,
           v_receipt.receipt_number,
           v_receipt.public_token,
           v_receipt.seller_id,
           v_receipt.seller_name,
           v_receipt.buyer_name,
           v_receipt.item_title,
           v_receipt.item_description,
           v_receipt.quantity,
           v_receipt.unit_price_kes,
           v_receipt.total_kes,
           v_receipt.currency,
           v_receipt.created_at;
end;
$$;
revoke all on function public.create_seller_receipt(boolean, text, text, text, integer, numeric) from public, anon, authenticated;
grant execute on function public.create_seller_receipt(boolean, text, text, text, integer, numeric) to authenticated;
comment on function public.create_seller_receipt(boolean, text, text, text, integer, numeric) is
  'Creates a seller-reported receipt only after the seller attests that the sale was completed externally. Lexify School does not process or verify payment.';

create or replace function public.record_whatsapp_handoff(
  p_item_type text,
  p_item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_seller_id uuid;
  v_valid boolean := false;
begin
  if p_item_id is null or p_item_type not in ('teacher_profile', 'class', 'course', 'product') then
    return false;
  end if;
  if auth.uid() is not null and not public.is_active_profile() then
    return false;
  end if;

  if p_item_type = 'teacher_profile' then
    select td.profile_id into v_seller_id
      from public.teacher_details td
      join public.profiles p on p.id = td.profile_id
      where td.profile_id = p_item_id
        and td.is_accepting_students = true
        and nullif(btrim(td.public_whatsapp), '') is not null
        and p.role = 'teacher'
        and p.is_suspended = false;
    v_valid := found;
  elsif p_item_type = 'class' then
    select c.teacher_id into v_seller_id
      from public.classes c
      join public.teacher_details td on td.profile_id = c.teacher_id
      join public.profiles p on p.id = c.teacher_id
      where c.id = p_item_id
        and c.is_published = true
        and c.is_active = true
        and nullif(btrim(td.public_whatsapp), '') is not null
        and p.role = 'teacher'
        and p.is_suspended = false;
    v_valid := found;
  elsif p_item_type = 'course' then
    select c.instructor_id into v_seller_id
      from public.courses c
      where c.id = p_item_id and c.status = 'published';
    v_valid := found;
    if v_valid and v_seller_id is not null and not exists (
      select 1
        from public.teacher_details td
        join public.profiles p on p.id = td.profile_id
        where td.profile_id = v_seller_id
          and nullif(btrim(td.public_whatsapp), '') is not null
          and p.role = 'teacher'
          and p.is_suspended = false
    ) then
      return false;
    end if;
  elsif p_item_type = 'product' then
    perform 1 from public.products p where p.id = p_item_id and p.status = 'published';
    v_valid := found;
    v_seller_id := null;
  end if;

  if not v_valid then
    return false;
  end if;

  insert into public.whatsapp_handoff_counts as existing (
    item_type,
    item_id,
    seller_id,
    handoff_count,
    updated_at
  ) values (
    p_item_type,
    p_item_id,
    v_seller_id,
    1,
    now()
  )
  on conflict (item_type, item_id, seller_key)
  do update set
    handoff_count = existing.handoff_count + 1,
    updated_at = now();

  return true;
end;
$$;
revoke all on function public.record_whatsapp_handoff(text, uuid) from public, anon, authenticated;
grant execute on function public.record_whatsapp_handoff(text, uuid) to anon, authenticated;
comment on function public.record_whatsapp_handoff(text, uuid) is
  'Atomically increments a per-item aggregate WhatsApp handoff-click counter; stores no visitor identity or message content.';

create or replace function public.get_whatsapp_handoff_total_count()
returns bigint
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_total bigint;
begin
  if auth.uid() is null or not public.is_active_profile() then
    raise exception 'An active signed-in account is required.' using errcode = '42501';
  end if;

  if public.is_admin() then
    select coalesce(sum(c.handoff_count), 0)::bigint into v_total
      from public.whatsapp_handoff_counts c;
  elsif public.has_role('teacher') then
    select coalesce(sum(c.handoff_count), 0)::bigint into v_total
      from public.whatsapp_handoff_counts c
      where c.seller_id = auth.uid();
  else
    raise exception 'Only active teachers and administrators may view handoff totals.' using errcode = '42501';
  end if;

  return coalesce(v_total, 0);
end;
$$;
revoke all on function public.get_whatsapp_handoff_total_count() from public, anon, authenticated;
grant execute on function public.get_whatsapp_handoff_total_count() to authenticated;

create or replace function public.verify_seller_receipt(p_token uuid)
returns table (
  receipt_number text,
  seller_name text,
  item_title text,
  total_kes numeric,
  currency text,
  issued_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select r.receipt_number,
         r.seller_name,
         r.item_title,
         r.total_kes,
         r.currency,
         r.created_at
    from public.seller_receipts r
    where r.public_token = p_token
$$;
revoke all on function public.verify_seller_receipt(uuid) from public, anon, authenticated;
grant execute on function public.verify_seller_receipt(uuid) to anon, authenticated;
comment on function public.verify_seller_receipt(uuid) is
  'Returns a minimal public receipt verification summary by unguessable token; never returns buyer details.';

commit;
