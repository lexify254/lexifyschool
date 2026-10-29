begin;

-- Bootstrap exactly one initial administrator after the allowlisted owner has
-- verified control of the configured email address. Future authorization is
-- based on the immutable Auth UUID and the profiles.role value, not email.
create or replace function public.promote_verified_first_admin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.email_confirmed_at is not null then
      return new;
    end if;
  end if;

  if lower(btrim(coalesce(new.email, ''))) <> 'lorinyaalex@gmail.com' then
    return new;
  end if;

  -- Serialize concurrent confirmations so only one account can claim the
  -- initial administrator role.
  perform pg_advisory_xact_lock(
    hashtextextended('lexifyschool-first-admin-claim', 0)
  );

  if exists (select 1 from public.profiles where role = 'admin') then
    return new;
  end if;

  -- The existing auth.users INSERT trigger creates this UUID-bound profile.
  -- Do not change its suspension state or any other profile fields here.
  update public.profiles
     set role = 'admin', updated_at = now()
   where id = new.id
     and role <> 'admin';

  return new;
end;
$$;

revoke all on function public.promote_verified_first_admin() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_verified_first_admin on auth.users;
create trigger on_auth_user_created_verified_first_admin
after insert on auth.users
for each row
when (new.email_confirmed_at is not null)
execute function public.promote_verified_first_admin();

drop trigger if exists on_auth_user_verified_first_admin on auth.users;
create trigger on_auth_user_verified_first_admin
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.promote_verified_first_admin();

comment on function public.promote_verified_first_admin() is
  'One-time, allowlisted first-Admin bootstrap on confirmed email; the resulting role is stored on the Supabase Auth UUID.';

commit;
