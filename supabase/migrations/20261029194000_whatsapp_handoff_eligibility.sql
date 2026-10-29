begin;

create or replace function public.resolve_whatsapp_handoff(
  p_item_type text,
  p_item_id uuid
)
returns table (
  eligible boolean,
  seller_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_seller_id uuid;
  v_valid boolean := false;
begin
  if p_item_id is null
     or p_item_type is null
     or p_item_type not in ('teacher_profile', 'class', 'course', 'product') then
    return query select false, null::uuid;
    return;
  end if;
  if auth.uid() is not null and not public.is_active_profile() then
    return query select false, null::uuid;
    return;
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
        and td.is_accepting_students = true
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
          and td.is_accepting_students = true
          and nullif(btrim(td.public_whatsapp), '') is not null
          and p.role = 'teacher'
          and p.is_suspended = false
    ) then
      v_valid := false;
      v_seller_id := null;
    end if;
  elsif p_item_type = 'product' then
    perform 1 from public.products p where p.id = p_item_id and p.status = 'published';
    v_valid := found;
    v_seller_id := null;
  end if;

  return query
    select v_valid,
           case when v_valid then v_seller_id else null::uuid end;
end;
$$;
revoke all on function public.resolve_whatsapp_handoff(text, uuid) from public, anon, authenticated;
grant execute on function public.resolve_whatsapp_handoff(text, uuid) to anon, authenticated;
comment on function public.resolve_whatsapp_handoff(text, uuid) is
  'Validates that a published WhatsApp listing still belongs to an active, eligible seller without recording a click or exposing seller details.';

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
  v_valid boolean;
begin
  select h.eligible, h.seller_id
    into v_valid, v_seller_id
    from public.resolve_whatsapp_handoff(p_item_type, p_item_id) h;

  if not found or v_valid is distinct from true then
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
  'Atomically revalidates an eligible seller and increments a per-item aggregate WhatsApp handoff-click counter; stores no visitor identity or message content.';

commit;
