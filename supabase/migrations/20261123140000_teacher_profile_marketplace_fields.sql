-- Teacher-set public profile details are informational only; inquiry and sales handoff remains off-site.
begin;
alter table public.teacher_details
  add column if not exists starting_price_kes numeric(12,2),
  add column if not exists pricing_basis text,
  add column if not exists services text[] not null default '{}';

alter table public.teacher_details
  drop constraint if exists teacher_details_starting_price_check,
  add constraint teacher_details_starting_price_check check (
    (starting_price_kes is null and pricing_basis is null)
    or (
      starting_price_kes > 0
      and starting_price_kes <= 10000000
      and pricing_basis in ('lesson_bundle', 'weekly', 'monthly')
    )
  ),
  drop constraint if exists teacher_details_services_check,
  add constraint teacher_details_services_check check (
    services <@ array['tuition']::text[]
  );

create index if not exists teacher_details_public_starting_price_idx
  on public.teacher_details (starting_price_kes asc, profile_id asc)
  where is_accepting_students = true and starting_price_kes is not null;

commit;
