-- Lexify School application schema. Payment processing is excluded; sales inquiries are handled via seller WhatsApp.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'guest' check (role in ('student','parent','teacher','guest','admin')),
 full_name text not null default '', avatar_url text, phone text, whatsapp text,
 email text, is_suspended boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.student_details (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 education_system_id uuid, grade_id uuid, pathway_id uuid, track_id uuid, school text, county text,
 guardian_name text, guardian_phone text, guardian_whatsapp text,
 parent_id uuid references public.profiles(id) on delete set null, goals text, hobbies text[], preferred_lesson_times text[],
 consent_given boolean not null default false, consent_at timestamptz,
 is_deaf_learner boolean not null default false, community_enabled boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.teacher_details (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 public_name text, public_avatar_url text, public_whatsapp text, bio text,
 experience_years integer check (experience_years is null or experience_years >= 0),
 qualifications text[], is_accepting_students boolean not null default true,
 verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','revoked')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.parent_details (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 community_access_control boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.guest_details (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 adult_or_guardian_consent boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.parent_student_links (
 id uuid primary key default gen_random_uuid(), parent_id uuid not null references public.profiles(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade,
 relationship text, confirmed_at timestamptz, created_at timestamptz not null default now(),
 unique(parent_id,student_id), check(parent_id <> student_id)
);
create table if not exists public.consent_records (
 id uuid primary key default gen_random_uuid(), subject_id uuid not null references public.profiles(id) on delete cascade,
 guardian_id uuid references public.profiles(id) on delete set null, consent_type text not null,
 granted boolean not null, policy_version text, recorded_at timestamptz not null default now(), withdrawn_at timestamptz
);
create table if not exists public.education_systems (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
 is_active boolean not null default true, starts_on date, ends_on date, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(ends_on is null or starts_on is null or ends_on >= starts_on)
);
create table if not exists public.grades (
 id uuid primary key default gen_random_uuid(), system_id uuid not null references public.education_systems(id) on delete cascade,
 code text not null unique, name text not null, level_order integer not null,
 is_active boolean not null default true, starts_on date, ends_on date, cohort_label text, created_at timestamptz not null default now(),
 unique(system_id,level_order), check(ends_on is null or starts_on is null or ends_on >= starts_on)
);
alter table public.student_details add constraint student_details_system_fk foreign key(education_system_id) references public.education_systems(id) on delete set null;
alter table public.student_details add constraint student_details_grade_fk foreign key(grade_id) references public.grades(id) on delete set null;
create table if not exists public.pathways (
 id uuid primary key default gen_random_uuid(), system_id uuid not null references public.education_systems(id) on delete cascade,
 code text not null unique, name text not null, description text, is_active boolean not null default true, sort_order integer not null default 0
);
alter table public.student_details add constraint student_details_pathway_fk foreign key(pathway_id) references public.pathways(id) on delete set null;
create table if not exists public.pathway_tracks (
 id uuid primary key default gen_random_uuid(), pathway_id uuid not null references public.pathways(id) on delete cascade,
 code text not null unique, name text not null, description text, is_active boolean not null default true, sort_order integer not null default 0
);
alter table public.student_details add constraint student_details_track_fk foreign key(track_id) references public.pathway_tracks(id) on delete set null;
create table if not exists public.subject_groups (
 id uuid primary key default gen_random_uuid(), system_id uuid not null references public.education_systems(id) on delete cascade,
 code text not null, name text not null, description text, is_compulsory boolean not null default false,
 unique(system_id,code)
);
create table if not exists public.learning_areas (
 id uuid primary key default gen_random_uuid(), code text not null unique, system_id uuid not null references public.education_systems(id) on delete cascade,
 pathway_id uuid references public.pathways(id) on delete set null, track_id uuid references public.pathway_tracks(id) on delete set null,
 group_id uuid references public.subject_groups(id) on delete set null, parent_area_id uuid references public.learning_areas(id) on delete set null,
 title text not null, description text, kcse_code text, is_core boolean not null default false, is_examinable boolean not null default true,
 is_active boolean not null default true, illustration_url text, icon_name text not null default 'BookOpen', accent_color text not null default '#2563EB',
 is_optional_activity boolean not null default false, restriction_code text, sort_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.grade_learning_areas (
 id uuid primary key default gen_random_uuid(), grade_id uuid not null references public.grades(id) on delete cascade,
 learning_area_id uuid not null references public.learning_areas(id) on delete cascade,
 role text not null check(role in ('core','elective','optional','sub_area')), is_required boolean not null default false,
 sort_order integer not null default 0, unique(grade_id,learning_area_id)
);
create table if not exists public.combination_rules (
 id uuid primary key default gen_random_uuid(), system_id uuid not null references public.education_systems(id) on delete cascade,
 code text not null unique, title text not null, description text not null, rule_json jsonb not null default '{}'::jsonb,
 is_enabled boolean not null default true, is_warning_only boolean not null default false, applies_from_grade_id uuid references public.grades(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.subject_combinations (
 id uuid primary key default gen_random_uuid(), system_id uuid not null references public.education_systems(id) on delete cascade,
 code text not null unique, name text, source text, is_approved boolean not null default false, imported_at timestamptz,
 notes text, unique(system_id,code)
);
create table if not exists public.subject_combination_areas (
 combination_id uuid not null references public.subject_combinations(id) on delete cascade,
 learning_area_id uuid not null references public.learning_areas(id) on delete cascade,
 position smallint not null default 1, primary key(combination_id,learning_area_id)
);
create table if not exists public.strands (
 id uuid primary key default gen_random_uuid(), learning_area_id uuid not null references public.learning_areas(id) on delete cascade,
 code text not null, title text not null, sort_order integer not null default 0, unique(learning_area_id,code)
);
create table if not exists public.sub_strands (
 id uuid primary key default gen_random_uuid(), strand_id uuid not null references public.strands(id) on delete cascade,
 code text not null, title text not null, sort_order integer not null default 0, unique(strand_id,code)
);
create table if not exists public.core_competencies (
 id uuid primary key default gen_random_uuid(), code text not null unique, title text not null, description text, is_active boolean not null default true
);
create table if not exists public.curriculum_values (
 id uuid primary key default gen_random_uuid(), code text not null unique, title text not null, description text, is_active boolean not null default true
);
create table if not exists public.assessment_scales (
 id uuid primary key default gen_random_uuid(), system_id uuid not null references public.education_systems(id) on delete cascade,
 code text not null, title text not null, label text not null default 'Lexify tutoring assessment', is_default boolean not null default true,
 is_active boolean not null default true, unique(system_id,code)
);
create table if not exists public.scale_levels (
 id uuid primary key default gen_random_uuid(), scale_id uuid not null references public.assessment_scales(id) on delete cascade,
 learning_area_id uuid references public.learning_areas(id) on delete cascade, code text not null, title text not null,
 points numeric(6,2) not null, min_percent numeric(5,2), max_percent numeric(5,2), sort_order integer not null,
 unique(scale_id,learning_area_id,code), check(min_percent is null or max_percent is null or max_percent >= min_percent)
);
create table if not exists public.student_subjects (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
 grade_id uuid not null references public.grades(id) on delete cascade, learning_area_id uuid not null references public.learning_areas(id) on delete cascade,
 selection_type text not null default 'core' check(selection_type in ('core','elective','optional','tutoring_only')),
 selected_at timestamptz not null default now(), unique(student_id,grade_id,learning_area_id)
);
create table if not exists public.teacher_subjects (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id) on delete cascade,
 grade_id uuid not null references public.grades(id) on delete cascade, learning_area_id uuid not null references public.learning_areas(id) on delete cascade,
 created_at timestamptz not null default now(), unique(teacher_id,grade_id,learning_area_id)
);
create table if not exists public.classes (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id) on delete restrict,
 grade_id uuid not null references public.grades(id) on delete restrict, learning_area_id uuid not null references public.learning_areas(id) on delete restrict,
 strand_id uuid references public.strands(id) on delete set null, title text not null, description text,
 schedule jsonb not null default '{}'::jsonb, meeting_link text, capacity integer check(capacity is null or capacity > 0),
 pricing_basis text not null check(pricing_basis in ('lesson_bundle','weekly','monthly')),
 price_kes numeric(12,2) not null check(price_kes >= 0), lessons_in_bundle integer check(lessons_in_bundle is null or lessons_in_bundle > 0),
 is_published boolean not null default false, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.enrolments (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, payer_id uuid references public.profiles(id) on delete set null,
 status text not null default 'pending' check(status in ('pending','active','completed','cancelled')),
 starts_at timestamptz, ends_at timestamptz, lessons_remaining integer check(lessons_remaining is null or lessons_remaining >= 0),
 created_at timestamptz not null default now(), unique(class_id,student_id)
);
create table if not exists public.lessons (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes(id) on delete cascade,
 title text not null, description text, starts_at timestamptz not null, ends_at timestamptz,
 created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.attendance (
 id uuid primary key default gen_random_uuid(), lesson_id uuid not null references public.lessons(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, status text not null default 'present' check(status in ('present','absent','late','excused')),
 marked_by uuid references public.profiles(id) on delete set null, joined_at timestamptz, comment text, created_at timestamptz not null default now(), unique(lesson_id,student_id)
);
create table if not exists public.scores (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, learning_area_id uuid not null references public.learning_areas(id) on delete restrict,
 strand_id uuid references public.strands(id) on delete set null, sub_strand_id uuid references public.sub_strands(id) on delete set null,
 scale_level_id uuid references public.scale_levels(id) on delete set null, assessment_type text not null,
 score numeric(8,2), max_score numeric(8,2), percentage numeric(5,2), comment text, assessed_on date not null default current_date,
 is_external_result boolean not null default false, external_system text, entered_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), check(score is null or score >= 0), check(max_score is null or max_score > 0), check(percentage is null or percentage between 0 and 100)
);
create table if not exists public.progress_notes (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, author_id uuid not null references public.profiles(id) on delete restrict,
 note text not null, created_at timestamptz not null default now()
);
create table if not exists public.homework_submissions (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, title text not null, instructions text,
 due_at timestamptz, file_path text, submitted_at timestamptz, score numeric(8,2), feedback text,
 marked_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.materials (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id) on delete cascade,
 title text not null, details text, file_path text not null, mime_type text, created_at timestamptz not null default now()
);
create table if not exists public.material_shares (
 id uuid primary key default gen_random_uuid(), material_id uuid not null references public.materials(id) on delete cascade,
 class_id uuid references public.classes(id) on delete cascade, student_id uuid references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(), check(class_id is not null or student_id is not null)
);
create table if not exists public.quizzes (
 id uuid primary key default gen_random_uuid(), class_id uuid references public.classes(id) on delete cascade,
 learning_area_id uuid references public.learning_areas(id) on delete set null, created_by uuid not null references public.profiles(id) on delete cascade,
 title text not null, instructions text, is_published boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.quiz_questions (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
 question jsonb not null, answer_key jsonb, points numeric(8,2) not null default 1 check(points >= 0), sort_order integer not null default 0
);
create table if not exists public.quiz_attempts (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, answers jsonb not null default '{}'::jsonb,
 score numeric(8,2), started_at timestamptz not null default now(), submitted_at timestamptz
);
create table if not exists public.reviews (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes(id) on delete cascade,
 reviewer_id uuid not null references public.profiles(id) on delete cascade, teacher_id uuid not null references public.profiles(id) on delete cascade,
 rating smallint not null check(rating between 1 and 5), body text, is_published boolean not null default false,
 created_at timestamptz not null default now(), unique(class_id,reviewer_id)
);
create table if not exists public.qa_questions (
 id uuid primary key default gen_random_uuid(), asker_id uuid not null references public.profiles(id) on delete cascade,
 learning_area_id uuid references public.learning_areas(id) on delete set null, title text not null, body text not null,
 visibility text not null default 'public' check(visibility in ('public','class')), class_id uuid references public.classes(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists public.qa_answers (
 id uuid primary key default gen_random_uuid(), question_id uuid not null references public.qa_questions(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade, body text not null, created_at timestamptz not null default now()
);
