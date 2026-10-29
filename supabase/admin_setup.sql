-- Manual, trusted-operator setup only. Run in the Supabase SQL Editor after the
-- intended person has completed Auth signup. This script NEVER creates auth.users.
-- Set exactly one selector below. Email comparison is exact and case-sensitive.
do $$
declare
  target_email text := 'lorinyaalex@gmail.com';
  target_user_id uuid := null;
  matched_id uuid;
  matched_email text;
begin
  if target_email = 'REPLACE_WITH_EXACT_EXISTING_AUTH_EMAIL' then
    target_email := null;
  end if;
  if (target_email is null) = (target_user_id is null) then
    raise exception 'Set exactly one of target_email or target_user_id in this script.';
  end if;

  if target_user_id is not null then
    select u.id, u.email into matched_id, matched_email
      from auth.users as u where u.id = target_user_id;
  else
    select u.id, u.email into matched_id, matched_email
      from auth.users as u where u.email = target_email;
  end if;

  if matched_id is null then
    raise exception 'No pre-existing Auth user matched the supplied exact selector. Sign up first; no user was created.';
  end if;

  insert into public.profiles(id, role, full_name, email, is_suspended)
  select u.id, 'admin', coalesce(nullif(u.raw_user_meta_data->>'full_name',''),u.email), u.email, false
    from auth.users as u where u.id = matched_id
  on conflict(id) do update
    set role = 'admin', is_suspended = false, updated_at = now();

  raise notice 'Promoted existing Auth user % (%) to admin.', matched_id, matched_email;
end $$;
