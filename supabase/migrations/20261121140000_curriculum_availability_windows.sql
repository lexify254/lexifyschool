-- Make education-system and grade availability windows effective.
-- Public users see only active records inside their configured date window.
-- Admins retain access through the existing admin_all RLS policies.
-- Subject-assignment triggers keep direct writes and the SECURITY DEFINER student RPC aligned.
begin;

create or replace function public.curriculum_record_is_current(
  p_is_active boolean,
  p_starts_on date,
  p_ends_on date
)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select coalesce(p_is_active, false)
    and (p_starts_on is null or p_starts_on <= current_date)
    and (p_ends_on is null or p_ends_on >= current_date)
$$;

drop policy if exists public_curriculum_read on public.education_systems;
create policy current_education_systems_read
  on public.education_systems
  for select to anon, authenticated
  using (public.curriculum_record_is_current(education_systems.is_active, education_systems.starts_on, education_systems.ends_on));

drop policy if exists public_curriculum_read on public.grades;
create policy current_grades_read
  on public.grades
  for select to anon, authenticated
  using (
    public.curriculum_record_is_current(grades.is_active, grades.starts_on, grades.ends_on)
    and exists (
      select 1
      from public.education_systems as systems
      where systems.id = grades.system_id
        and public.curriculum_record_is_current(systems.is_active, systems.starts_on, systems.ends_on)
    )
  );

create or replace function public.guard_curriculum_grade_window()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_available boolean;
begin
  -- Admin actions and trusted service-role imports may manage historical or future records.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  select public.curriculum_record_is_current(g.is_active, g.starts_on, g.ends_on)
      and public.curriculum_record_is_current(s.is_active, s.starts_on, s.ends_on)
    into v_available
  from public.grades as g
  join public.education_systems as s on s.id = g.system_id
  where g.id = new.grade_id;

  if not coalesce(v_available, false) then
    raise exception 'This grade is not currently available for subject selection';
  end if;

  return new;
end
$$;

revoke all on function public.guard_curriculum_grade_window() from public, anon, authenticated;
drop trigger if exists student_subjects_current_grade_guard on public.student_subjects;
create trigger student_subjects_current_grade_guard
  before insert or update on public.student_subjects
  for each row execute function public.guard_curriculum_grade_window();

drop trigger if exists teacher_subjects_current_grade_guard on public.teacher_subjects;
create trigger teacher_subjects_current_grade_guard
  before insert or update on public.teacher_subjects
  for each row execute function public.guard_curriculum_grade_window();

commit;
