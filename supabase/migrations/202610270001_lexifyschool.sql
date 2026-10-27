-- Lexify School initial schema. Apply only to a new project after review.
-- No secrets, destructive statements, or privileged user creation are included.
create extension if not exists pgcrypto;

-- Identity and role-specific details. Admin is deliberately not a signup role.
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

-- Curriculum and configurable school-year status.
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

-- Tutoring, assessment, content sharing and learner support.
create table if not exists public.classes (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id) on delete restrict,
 grade_id uuid not null references public.grades(id) on delete restrict, learning_area_id uuid not null references public.learning_areas(id) on delete restrict,
 strand_id uuid references public.strands(id) on delete set null, title text not null, description text,
 schedule jsonb not null default '{}'::jsonb, meeting_link text, capacity integer check(capacity is null or capacity > 0),
 payment_basis text not null check(payment_basis in ('lesson_bundle','weekly','monthly')),
 price_kes numeric(12,2) not null check(price_kes >= 0), lessons_in_bundle integer check(lessons_in_bundle is null or lessons_in_bundle > 0),
 is_published boolean not null default false, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.enrolments (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, payer_id uuid references public.profiles(id) on delete set null,
 status text not null default 'pending' check(status in ('pending','active','completed','cancelled','refunded')),
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

-- Payment records are immutable audit-friendly money events; all amounts are KES.
create table if not exists public.payment_requests (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id) on delete restrict,
 payer_id uuid references public.profiles(id) on delete set null, student_id uuid references public.profiles(id) on delete set null,
 class_id uuid references public.classes(id) on delete set null, amount_kes numeric(12,2) not null check(amount_kes > 0),
 description text not null, status text not null default 'pending' check(status in ('pending','paid','cancelled','expired')),
 expires_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(), payer_id uuid not null references public.profiles(id) on delete restrict,
 amount_kes numeric(12,2) not null check(amount_kes >= 0), currency char(3) not null default 'KES' check(currency='KES'),
 purpose text not null check(purpose in ('tutoring','course','product','badge','refund','subscription')),
 provider text check(provider is null or provider in ('paystack','pesapal','manual')),
 provider_reference text, status text not null default 'pending' check(status in ('pending','successful','failed','abandoned','refunded','partially_refunded')),
 payment_request_id uuid references public.payment_requests(id) on delete set null, raw_payload jsonb,
 paid_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(provider,provider_reference)
);
create table if not exists public.receipts (
 id uuid primary key default gen_random_uuid(), payment_id uuid not null unique references public.payments(id) on delete restrict,
 receipt_number text not null unique, owner_id uuid not null references public.profiles(id) on delete restrict,
 file_path text, issued_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
);
create table if not exists public.ledger_entries (
 id uuid primary key default gen_random_uuid(), payment_id uuid references public.payments(id) on delete restrict,
 account_profile_id uuid references public.profiles(id) on delete set null, entry_type text not null,
 amount_kes numeric(12,2) not null check(amount_kes >= 0), direction text not null check(direction in ('credit','debit')),
 description text, created_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
);
create table if not exists public.payout_requests (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id) on delete restrict,
 amount_kes numeric(12,2) not null check(amount_kes > 0), status text not null default 'requested' check(status in ('requested','approved','paid','rejected')),
 requested_at timestamptz not null default now(), processed_at timestamptz, processed_by uuid references public.profiles(id) on delete set null,
 payout_reference text, notes text
);
create table if not exists public.badge_purchases (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id) on delete cascade,
 payment_id uuid references public.payments(id) on delete set null, amount_kes numeric(12,2) not null check(amount_kes >= 0),
 purchase_type text not null default 'one_time' check(purchase_type in ('one_time','yearly')),
 status text not null default 'pending' check(status in ('pending','paid','refunded')), created_at timestamptz not null default now()
);
create table if not exists public.badge_awards (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id) on delete cascade,
 badge_purchase_id uuid not null references public.badge_purchases(id) on delete restrict,
 awarded_by uuid not null references public.profiles(id) on delete restrict, awarded_at timestamptz not null default now(), expires_at timestamptz, revoked_at timestamptz, unique(badge_purchase_id)
);
create table if not exists public.settings (
 key text primary key, value jsonb not null, description text, is_public boolean not null default false,
 updated_by uuid references public.profiles(id) on delete set null, updated_at timestamptz not null default now()
);
create table if not exists public.generated_reports (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
 report_type text not null, subject_profile_id uuid references public.profiles(id) on delete set null,
 file_path text, parameters jsonb not null default '{}'::jsonb, generated_at timestamptz not null default now(), expires_at timestamptz
);

-- Academy: unpublished course content and all paid assets remain private.
create table if not exists public.courses (
 id uuid primary key default gen_random_uuid(), code text not null unique, title text not null, description text,
 icon_name text not null default 'FileText', accent_color text not null default '#2563EB', level text, duration_minutes integer,
 status text not null default 'draft' check(status in ('draft','published','archived')), instructor_id uuid references public.profiles(id) on delete set null,
 is_free boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz
);
create table if not exists public.course_modules (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
 title text not null, description text, sort_order integer not null default 0, release_at timestamptz, unique(course_id,sort_order)
);
create table if not exists public.course_lessons (
 id uuid primary key default gen_random_uuid(), module_id uuid not null references public.course_modules(id) on delete cascade,
 title text not null, lesson_type text not null check(lesson_type in ('video','text','document','practice_file','quiz','assignment')),
 content jsonb not null default '{}'::jsonb, sort_order integer not null default 0, estimated_minutes integer,
 is_free_preview boolean not null default false, release_at timestamptz, is_published boolean not null default false, unique(module_id,sort_order)
);
create table if not exists public.lesson_resources (
 id uuid primary key default gen_random_uuid(), lesson_id uuid not null references public.course_lessons(id) on delete cascade,
 title text not null, file_path text not null, mime_type text, is_downloadable boolean not null default true
);
create table if not exists public.course_prices (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
 price_kes numeric(12,2) not null check(price_kes >= 0), sale_price_kes numeric(12,2) check(sale_price_kes is null or sale_price_kes >= 0),
 starts_at timestamptz, ends_at timestamptz, access_days integer check(access_days is null or access_days > 0), is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.course_bundles (
 id uuid primary key default gen_random_uuid(), code text not null unique, title text not null, description text,
 price_kes numeric(12,2) not null check(price_kes >= 0), is_published boolean not null default false
);
create table if not exists public.course_bundle_items (
 bundle_id uuid not null references public.course_bundles(id) on delete cascade, course_id uuid not null references public.courses(id) on delete cascade, primary key(bundle_id,course_id)
);
create table if not exists public.subscriptions (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
 plan_name text not null, status text not null default 'pending' check(status in ('pending','active','cancelled','expired')),
 starts_at timestamptz, ends_at timestamptz, payment_id uuid references public.payments(id) on delete set null
);
create table if not exists public.course_enrolments (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, payment_id uuid references public.payments(id) on delete set null,
 status text not null default 'pending' check(status in ('pending','active','completed','revoked','refunded')),
 enrolled_at timestamptz not null default now(), expires_at timestamptz, unique(course_id,student_id)
);
create table if not exists public.lesson_progress (
 id uuid primary key default gen_random_uuid(), lesson_id uuid not null references public.course_lessons(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, completed_at timestamptz, seconds_spent integer not null default 0 check(seconds_spent >= 0),
 notes text, unique(lesson_id,student_id)
);
create table if not exists public.course_quizzes (
 id uuid primary key default gen_random_uuid(), lesson_id uuid not null references public.course_lessons(id) on delete cascade,
 questions jsonb not null default '[]'::jsonb, pass_percent numeric(5,2), max_attempts integer check(max_attempts is null or max_attempts > 0)
);
create table if not exists public.course_quiz_attempts (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.course_quizzes(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, answers jsonb not null default '{}'::jsonb,
 score numeric(5,2), started_at timestamptz not null default now(), submitted_at timestamptz
);
create table if not exists public.assignments (
 id uuid primary key default gen_random_uuid(), lesson_id uuid not null references public.course_lessons(id) on delete cascade,
 title text not null, instructions text, due_at timestamptz, max_score numeric(8,2)
);
create table if not exists public.assignment_submissions (
 id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.assignments(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, file_path text, answer text, submitted_at timestamptz not null default now(),
 score numeric(8,2), feedback text, marked_by uuid references public.profiles(id) on delete set null
);
create table if not exists public.certificates (
 id uuid primary key default gen_random_uuid(), certificate_code text not null unique, student_id uuid not null references public.profiles(id) on delete cascade,
 course_id uuid not null references public.courses(id) on delete restrict, file_path text, score numeric(5,2), issued_at timestamptz not null default now(), revoked_at timestamptz, unique(student_id,course_id)
);
create table if not exists public.course_reviews (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
 reviewer_id uuid not null references public.profiles(id) on delete cascade, rating smallint not null check(rating between 1 and 5),
 body text, is_published boolean not null default false, created_at timestamptz not null default now(), unique(course_id,reviewer_id)
);
create table if not exists public.course_lesson_questions (
 id uuid primary key default gen_random_uuid(), lesson_id uuid not null references public.course_lessons(id) on delete cascade,
 asker_id uuid not null references public.profiles(id) on delete cascade, body text not null, created_at timestamptz not null default now()
);
create table if not exists public.course_lesson_answers (
 id uuid primary key default gen_random_uuid(), question_id uuid not null references public.course_lesson_questions(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade, body text not null, created_at timestamptz not null default now()
);

-- Store, products and access entitlements. File contents are never public.
create table if not exists public.product_categories (
 id uuid primary key default gen_random_uuid(), code text not null unique, title text not null, description text, is_active boolean not null default true
);
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(), code text not null unique, category_id uuid references public.product_categories(id) on delete set null,
 title text not null, short_description text, description text, software_name text, software_version text, file_types text[], difficulty text,
 price_kes numeric(12,2) not null default 0 check(price_kes >= 0), sale_price_kes numeric(12,2) check(sale_price_kes is null or sale_price_kes >= 0),
 sale_starts_at timestamptz, sale_ends_at timestamptz, is_free boolean not null default false, licence_type text,
 download_limit integer check(download_limit is null or download_limit > 0), access_days integer check(access_days is null or access_days > 0),
 cover_image_url text, preview_url text, rights_confirmed boolean not null default false, status text not null default 'draft' check(status in ('draft','published','archived')),
 featured boolean not null default false, created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz
);
create table if not exists public.product_files (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
 title text not null, file_path text not null, mime_type text, checksum text, version_number integer not null default 1, macro_warning boolean not null default false, malware_scan_status text not null default 'pending', created_at timestamptz not null default now(), unique(product_id,version_number,title)
);
create table if not exists public.product_versions (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
 version text not null, notes text, created_at timestamptz not null default now(), unique(product_id,version)
);
create table if not exists public.product_tags (
 product_id uuid not null references public.products(id) on delete cascade, tag text not null, primary key(product_id,tag)
);
create table if not exists public.product_bundles (
 id uuid primary key default gen_random_uuid(), code text not null unique, title text not null, price_kes numeric(12,2) not null check(price_kes >= 0), is_published boolean not null default false
);
create table if not exists public.product_bundle_items (
 bundle_id uuid not null references public.product_bundles(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, primary key(bundle_id,product_id)
);
create table if not exists public.promo_codes (
 id uuid primary key default gen_random_uuid(), code text not null unique, discount_percent numeric(5,2) check(discount_percent between 0 and 100),
 discount_kes numeric(12,2) check(discount_kes >= 0), starts_at timestamptz, ends_at timestamptz, max_redemptions integer check(max_redemptions is null or max_redemptions > 0), is_active boolean not null default true
);
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(), buyer_id uuid not null references public.profiles(id) on delete restrict,
 payment_id uuid references public.payments(id) on delete set null, status text not null default 'pending' check(status in ('pending','paid','cancelled','refunded')),
 subtotal_kes numeric(12,2) not null default 0 check(subtotal_kes >= 0), discount_kes numeric(12,2) not null default 0 check(discount_kes >= 0), total_kes numeric(12,2) not null default 0 check(total_kes >= 0), created_at timestamptz not null default now()
);
create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null, bundle_id uuid references public.product_bundles(id) on delete set null,
 title_snapshot text not null, quantity integer not null default 1 check(quantity > 0), unit_price_kes numeric(12,2) not null check(unit_price_kes >= 0), check(product_id is not null or bundle_id is not null)
);
create table if not exists public.entitlements (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
 product_id uuid references public.products(id) on delete cascade, course_id uuid references public.courses(id) on delete cascade,
 order_id uuid references public.orders(id) on delete set null, payment_id uuid references public.payments(id) on delete set null,
 status text not null default 'active' check(status in ('active','revoked','expired','refunded')), starts_at timestamptz not null default now(), ends_at timestamptz,
 download_limit integer check(download_limit is null or download_limit > 0), unique(profile_id,product_id,course_id), check((product_id is null) <> (course_id is null))
);
create table if not exists public.download_logs (
 id uuid primary key default gen_random_uuid(), entitlement_id uuid not null references public.entitlements(id) on delete restrict,
 profile_id uuid not null references public.profiles(id) on delete restrict, product_file_id uuid references public.product_files(id) on delete set null,
 resource_path text not null, downloaded_at timestamptz not null default now(), ip_hash text
);
create table if not exists public.product_reviews (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
 reviewer_id uuid not null references public.profiles(id) on delete cascade, rating smallint not null check(rating between 1 and 5), body text,
 is_published boolean not null default false, created_at timestamptz not null default now(), unique(product_id,reviewer_id)
);
create table if not exists public.wishlists (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade, created_at timestamptz not null default now(), unique(profile_id,product_id)
);

-- Group chat, public community with consent gates, reporting and moderation.
create table if not exists public.chat_groups (
 id uuid primary key default gen_random_uuid(), title text not null, class_id uuid references public.classes(id) on delete cascade,
 created_by uuid not null references public.profiles(id) on delete restrict, announcement_only boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.chat_group_members (
 group_id uuid not null references public.chat_groups(id) on delete cascade, profile_id uuid not null references public.profiles(id) on delete cascade,
 added_by uuid references public.profiles(id) on delete set null, joined_at timestamptz not null default now(), primary key(group_id,profile_id)
);
create table if not exists public.chat_messages (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.chat_groups(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade, body text, attachment_path text,
 reply_to uuid references public.chat_messages(id) on delete set null, created_at timestamptz not null default now(), edited_at timestamptz, deleted_at timestamptz,
 check(body is not null or attachment_path is not null)
);
create table if not exists public.message_reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id) on delete cascade,
 chat_message_id uuid references public.chat_messages(id) on delete cascade, community_message_id uuid,
 reason text not null, status text not null default 'open' check(status in ('open','reviewed','actioned','dismissed')), created_at timestamptz not null default now(), check(chat_message_id is not null or community_message_id is not null)
);
create table if not exists public.community_channels (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, description text,
 is_active boolean not null default true, is_public boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.community_members (
 channel_id uuid not null references public.community_channels(id) on delete cascade, profile_id uuid not null references public.profiles(id) on delete cascade,
 rules_accepted_at timestamptz not null, joined_at timestamptz not null default now(), primary key(channel_id,profile_id)
);
create table if not exists public.community_messages (
 id uuid primary key default gen_random_uuid(), channel_id uuid not null references public.community_channels(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade, body text, attachment_path text,
 reply_to uuid references public.community_messages(id) on delete set null, created_at timestamptz not null default now(), edited_at timestamptz, deleted_at timestamptz,
 check(body is not null or attachment_path is not null)
);
alter table public.message_reports add constraint message_reports_community_fk foreign key(community_message_id) references public.community_messages(id) on delete cascade;
create table if not exists public.moderation_actions (
 id uuid primary key default gen_random_uuid(), moderator_id uuid not null references public.profiles(id) on delete restrict,
 target_profile_id uuid references public.profiles(id) on delete set null, channel_id uuid references public.community_channels(id) on delete set null,
 action text not null check(action in ('delete','mute','timeout','ban','unban','warn')), reason text, starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id) on delete cascade,
 title text not null, body text not null, channel text not null default 'in_app', read_at timestamptz, payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.audit_log (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
 action text not null, entity_type text not null, entity_id text, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.report_jobs (
 id uuid primary key default gen_random_uuid(), requested_by uuid not null references public.profiles(id) on delete cascade,
 report_type text not null, filters jsonb not null default '{}'::jsonb, status text not null default 'queued' check(status in ('queued','running','complete','failed')),
 file_path text, created_at timestamptz not null default now(), completed_at timestamptz
);

-- Safe authorization helpers; SECURITY DEFINER avoids recursive RLS joins.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
 select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and not p.is_suspended)
$$;
create or replace function public.has_role(required_role text) returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
 select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = required_role and not p.is_suspended)
$$;
create or replace function public.current_profile_role() returns text language sql stable security definer set search_path = public, auth, pg_temp as $$
 select p.role from public.profiles p where p.id=auth.uid() and not p.is_suspended
$$;
create or replace function public.is_parent_of(child_id uuid) returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
 select exists(select 1 from public.parent_student_links l where l.parent_id=auth.uid() and l.student_id=child_id and l.confirmed_at is not null)
$$;
create or replace function public.is_class_member(target_class uuid) returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
 select exists(select 1 from public.enrolments e where e.class_id=target_class and e.student_id=auth.uid() and e.status='active')
$$;
create or replace function public.teaches_class(target_class uuid) returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
 select exists(select 1 from public.classes c where c.id=target_class and c.teacher_id=auth.uid())
$$;
create or replace function public.can_read_class(target_class uuid) returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
 select public.is_admin() or public.teaches_class(target_class) or public.is_class_member(target_class)
   or exists(select 1 from public.enrolments e where e.class_id=target_class and public.is_parent_of(e.student_id) and e.status='active')
$$;
create or replace function public.has_course_access(target_course uuid) returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
 select exists(select 1 from public.course_enrolments e where e.course_id=target_course and e.student_id=auth.uid() and e.status in ('active','completed') and (e.expires_at is null or e.expires_at>now()))
$$;
create or replace function public.has_product_access(target_product uuid) returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
 select exists(select 1 from public.entitlements e where e.profile_id=auth.uid() and e.product_id=target_product and e.status='active' and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now()))
$$;
create or replace function public.owns_material(target_material uuid) returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
 select exists(select 1 from public.materials m where m.id=target_material and m.teacher_id=auth.uid())
$$;
create or replace function public.can_read_material(target_material uuid) returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
 select exists(select 1 from public.materials m join public.material_shares s on s.material_id=m.id where m.id=target_material and (m.teacher_id=auth.uid() or s.student_id=auth.uid() or public.is_parent_of(s.student_id) or public.is_class_member(s.class_id) or public.teaches_class(s.class_id)))
$$;
create or replace function public.is_chat_member(target_group uuid) returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
 select exists(select 1 from public.chat_group_members m where m.group_id=target_group and m.profile_id=auth.uid())
$$;
create or replace function public.can_manage_chat_group(target_group uuid) returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
 select exists(select 1 from public.chat_groups g where g.id=target_group and (g.created_by=auth.uid() or (g.class_id is not null and public.teaches_class(g.class_id))))
$$;
create or replace function public.parent_allows_community(child_id uuid) returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
 select exists(select 1 from public.parent_student_links l join public.parent_details pd on pd.profile_id=l.parent_id where l.student_id=child_id and l.confirmed_at is not null and pd.community_access_control)
$$;
create or replace function public.set_child_community_access(child_id uuid, allow_access boolean) returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
 if not public.is_parent_of(child_id) then raise exception 'Only a linked parent or guardian may change this setting'; end if;
 update public.student_details set community_enabled=allow_access,updated_at=now() where profile_id=child_id;
 if not found then raise exception 'Student profile not found'; end if;
end;
$$;
revoke all on function public.set_child_community_access(uuid,boolean) from public;
grant execute on function public.set_child_community_access(uuid,boolean) to authenticated;

-- Common indexes for ownership and query paths.
create unique index if not exists idx_scale_levels_unique_scope on public.scale_levels(scale_id,coalesce(learning_area_id,'00000000-0000-0000-0000-000000000000'::uuid),code);
create index if not exists idx_parent_links_child on public.parent_student_links(student_id);
create index if not exists idx_student_subjects_student on public.student_subjects(student_id,grade_id);
create index if not exists idx_teacher_subjects_teacher on public.teacher_subjects(teacher_id,grade_id);
create index if not exists idx_classes_teacher on public.classes(teacher_id);
create index if not exists idx_enrolments_student on public.enrolments(student_id,status);
create index if not exists idx_enrolments_class on public.enrolments(class_id,status);
create index if not exists idx_lessons_class_time on public.lessons(class_id,starts_at);
create index if not exists idx_attendance_student on public.attendance(student_id);
create index if not exists idx_scores_student_date on public.scores(student_id,assessed_on);
create index if not exists idx_payments_payer on public.payments(payer_id,created_at desc);
create index if not exists idx_course_enrolments_student on public.course_enrolments(student_id,status);
create index if not exists idx_products_status on public.products(status,featured);
create index if not exists idx_courses_status on public.courses(status);
create index if not exists idx_chat_messages_group_time on public.chat_messages(group_id,created_at);
create index if not exists idx_community_messages_channel_time on public.community_messages(channel_id,created_at);
create index if not exists idx_notifications_owner on public.notifications(recipient_id,created_at desc);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Every public table has RLS enabled and an admin-only full-access policy by default.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' loop
   execute format('alter table public.%I enable row level security',t.tablename);
   if not exists(select 1 from pg_policies where schemaname='public' and tablename=t.tablename and policyname='admin_all') then
     execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',t.tablename);
   end if;
 end loop;
end $$;

-- Profiles remain private; self and linked parents see appropriate private profile records.
create policy profiles_self_select on public.profiles for select to authenticated using(id=auth.uid() or public.is_parent_of(id));
create policy profiles_self_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid() and role=public.current_profile_role());
create policy profiles_signup_insert on public.profiles for insert to authenticated with check(id=auth.uid() and role <> 'admin');
create policy student_details_self_parent_select on public.student_details for select to authenticated using(profile_id=auth.uid() or public.is_parent_of(profile_id));
create policy student_details_self_insert on public.student_details for insert to authenticated with check(profile_id=auth.uid());
create policy student_details_self_update on public.student_details for update to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());
create policy teacher_details_public_read on public.teacher_details for select to anon,authenticated using(is_accepting_students or public.is_admin() or profile_id=auth.uid());
create policy teacher_details_self_manage on public.teacher_details for all to authenticated using(profile_id=auth.uid() and public.has_role('teacher')) with check(profile_id=auth.uid() and public.has_role('teacher'));
create policy parent_details_self on public.parent_details for all to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());
create policy guest_details_self on public.guest_details for all to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());
create policy links_related_select on public.parent_student_links for select to authenticated using(parent_id=auth.uid() or student_id=auth.uid());
create policy links_parent_add on public.parent_student_links for insert to authenticated with check(parent_id=auth.uid() and public.has_role('parent'));
create policy links_parent_delete on public.parent_student_links for delete to authenticated using(parent_id=auth.uid());
create policy consent_related_select on public.consent_records for select to authenticated using(subject_id=auth.uid() or guardian_id=auth.uid() or public.is_parent_of(subject_id));
create policy consent_self_insert on public.consent_records for insert to authenticated with check((subject_id=auth.uid() and guardian_id is null) or (guardian_id=auth.uid() and public.is_parent_of(subject_id)));

-- Curriculum is intentionally public; only admins may write (admin_all).
do $$ declare t text; begin foreach t in array array['education_systems','grades','pathways','pathway_tracks','subject_groups','learning_areas','grade_learning_areas','combination_rules','subject_combinations','subject_combination_areas','strands','sub_strands','core_competencies','curriculum_values','assessment_scales','scale_levels'] loop
 execute format('create policy public_curriculum_read on public.%I for select to anon,authenticated using (true)',t);
end loop; end $$;
create policy student_subjects_related on public.student_subjects for select to authenticated using(student_id=auth.uid() or public.is_parent_of(student_id));
create policy student_subjects_self_write on public.student_subjects for insert to authenticated with check(student_id=auth.uid());
create policy student_subjects_self_update on public.student_subjects for update to authenticated using(student_id=auth.uid()) with check(student_id=auth.uid());
create policy teacher_subjects_public_read on public.teacher_subjects for select to anon,authenticated using(true);
create policy teacher_subjects_self_write on public.teacher_subjects for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());

-- Public class listings reveal no learner data. Class learners, linked parents and the teacher see roster details.
create policy published_classes_read on public.classes for select to anon,authenticated using(is_published or public.can_read_class(id));
create policy teacher_class_insert on public.classes for insert to authenticated with check(teacher_id=auth.uid() and public.has_role('teacher'));
create policy teacher_class_update on public.classes for update to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
create policy class_enrolment_related on public.enrolments for select to authenticated using(student_id=auth.uid() or payer_id=auth.uid() or public.is_parent_of(student_id) or public.teaches_class(class_id));
create policy enrolment_self_request on public.enrolments for insert to authenticated with check(student_id=auth.uid() or (payer_id=auth.uid() and public.is_parent_of(student_id)));
create policy lessons_class_read on public.lessons for select to authenticated using(public.can_read_class(class_id));
create policy lessons_teacher_manage on public.lessons for all to authenticated using(public.teaches_class(class_id)) with check(public.teaches_class(class_id));
create policy attendance_related_read on public.attendance for select to authenticated using(student_id=auth.uid() or public.is_parent_of(student_id) or exists(select 1 from public.lessons l where l.id=lesson_id and public.teaches_class(l.class_id)));
create policy attendance_teacher_manage on public.attendance for all to authenticated using(exists(select 1 from public.lessons l where l.id=lesson_id and public.teaches_class(l.class_id))) with check(exists(select 1 from public.lessons l where l.id=lesson_id and public.teaches_class(l.class_id)));
create policy scores_related_read on public.scores for select to authenticated using(student_id=auth.uid() or public.is_parent_of(student_id) or public.teaches_class(class_id));
create policy scores_teacher_write on public.scores for all to authenticated using(public.teaches_class(class_id)) with check(public.teaches_class(class_id) and entered_by=auth.uid());
create policy progress_notes_related_read on public.progress_notes for select to authenticated using(student_id=auth.uid() or public.is_parent_of(student_id) or public.teaches_class(class_id));
create policy progress_notes_teacher_write on public.progress_notes for all to authenticated using(public.teaches_class(class_id) and author_id=auth.uid()) with check(public.teaches_class(class_id) and author_id=auth.uid());
create policy homework_related_read on public.homework_submissions for select to authenticated using(student_id=auth.uid() or public.is_parent_of(student_id) or public.teaches_class(class_id));
create policy homework_student_insert on public.homework_submissions for insert to authenticated with check(student_id=auth.uid() and public.is_class_member(class_id));
create policy homework_teacher_update on public.homework_submissions for update to authenticated using(public.teaches_class(class_id)) with check(public.teaches_class(class_id));
create policy materials_teacher_manage on public.materials for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
create policy materials_shared_read on public.materials for select to authenticated using(public.can_read_material(id));
create policy shares_teacher_manage on public.material_shares for all to authenticated using(public.owns_material(material_id)) with check(public.owns_material(material_id));
create policy quizzes_class_read on public.quizzes for select to authenticated using((is_published and (class_id is null or public.can_read_class(class_id))) or created_by=auth.uid());
create policy quizzes_creator_manage on public.quizzes for all to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());
create policy quiz_questions_access on public.quiz_questions for select to authenticated using(exists(select 1 from public.quizzes q where q.id=quiz_id and (q.created_by=auth.uid() or (q.is_published and (q.class_id is null or public.can_read_class(q.class_id))))));
create policy quiz_questions_teacher_manage on public.quiz_questions for all to authenticated using(exists(select 1 from public.quizzes q where q.id=quiz_id and q.created_by=auth.uid())) with check(exists(select 1 from public.quizzes q where q.id=quiz_id and q.created_by=auth.uid()));
create policy quiz_attempts_self_parent_teacher on public.quiz_attempts for select to authenticated using(student_id=auth.uid() or public.is_parent_of(student_id) or exists(select 1 from public.quizzes q where q.id=quiz_id and q.created_by=auth.uid()));
create policy quiz_attempts_self_write on public.quiz_attempts for all to authenticated using(student_id=auth.uid()) with check(student_id=auth.uid());
create policy reviews_public_read on public.reviews for select to anon,authenticated using(is_published or reviewer_id=auth.uid() or public.is_admin());
create policy reviews_paid_student_write on public.reviews for insert to authenticated with check(reviewer_id=auth.uid() and not is_published and exists(select 1 from public.enrolments e where e.class_id=reviews.class_id and e.student_id=auth.uid() and e.status in ('active','completed')));
create policy qa_questions_read on public.qa_questions for select to anon,authenticated using(visibility='public' or asker_id=auth.uid() or public.can_read_class(class_id));
create policy qa_questions_self_write on public.qa_questions for all to authenticated using(asker_id=auth.uid()) with check(asker_id=auth.uid());
create policy qa_answers_read on public.qa_answers for select to anon,authenticated using(exists(select 1 from public.qa_questions q where q.id=question_id and (q.visibility='public' or q.asker_id=auth.uid() or public.can_read_class(q.class_id))));
create policy qa_answers_self_write on public.qa_answers for all to authenticated using(author_id=auth.uid()) with check(author_id=auth.uid());

-- Payments: payer, beneficiary teacher, linked parent, and admin scopes.
create policy payment_requests_related_read on public.payment_requests for select to authenticated using(teacher_id=auth.uid() or payer_id=auth.uid() or student_id=auth.uid() or public.is_parent_of(student_id));
create policy payment_requests_teacher_insert on public.payment_requests for insert to authenticated with check(teacher_id=auth.uid() and public.teaches_class(class_id));
create policy payment_requests_teacher_update on public.payment_requests for update to authenticated using(teacher_id=auth.uid() and status='pending') with check(teacher_id=auth.uid());
create policy payments_payer_read on public.payments for select to authenticated using(payer_id=auth.uid() or exists(select 1 from public.payment_requests r where r.id=payment_request_id and (r.teacher_id=auth.uid() or public.is_parent_of(r.student_id))));
create policy receipts_owner_read on public.receipts for select to authenticated using(owner_id=auth.uid() or public.is_parent_of(owner_id));
create policy ledger_related_read on public.ledger_entries for select to authenticated using(account_profile_id=auth.uid());
create policy payout_teacher_read_insert on public.payout_requests for select to authenticated using(teacher_id=auth.uid());
create policy payout_teacher_insert on public.payout_requests for insert to authenticated with check(teacher_id=auth.uid());
create policy badge_purchase_owner_read on public.badge_purchases for select to authenticated using(teacher_id=auth.uid());
create policy badge_purchase_teacher_insert on public.badge_purchases for insert to authenticated with check(teacher_id=auth.uid());
create policy badge_awards_public_read on public.badge_awards for select to anon,authenticated using(revoked_at is null and (expires_at is null or expires_at>now()));
create policy public_settings_read on public.settings for select to anon,authenticated using(is_public);
create policy reports_owner_read on public.generated_reports for select to authenticated using(owner_id=auth.uid() or (subject_profile_id is not null and public.is_parent_of(subject_profile_id)));
create policy reports_owner_request on public.generated_reports for insert to authenticated with check(owner_id=auth.uid());

-- Courses catalogue public when published; learning content and answer keys private to enrollees/admin.
create policy published_courses_read on public.courses for select to anon,authenticated using(status='published');
create policy course_structure_public_read on public.course_modules for select to anon,authenticated using(exists(select 1 from public.courses c where c.id=course_id and c.status='published'));
create policy course_lessons_access on public.course_lessons for select to anon,authenticated using(is_published and exists(select 1 from public.course_modules m join public.courses c on c.id=m.course_id where m.id=course_lessons.module_id and c.status='published' and (course_lessons.is_free_preview or (auth.uid() is not null and (public.is_admin() or exists(select 1 from public.course_enrolments e where e.course_id=c.id and e.student_id=auth.uid() and e.status in ('active','completed') and (e.expires_at is null or e.expires_at>now())))))));
create policy lesson_resources_paid_access on public.lesson_resources for select to authenticated using(exists(select 1 from public.course_lessons l join public.course_modules m on m.id=l.module_id where l.id=lesson_id and (l.is_free_preview or public.has_course_access(m.course_id))));
create policy course_prices_public_read on public.course_prices for select to anon,authenticated using(is_active and exists(select 1 from public.courses c where c.id=course_id and c.status='published'));
create policy course_bundles_public_read on public.course_bundles for select to anon,authenticated using(is_published);
create policy bundle_items_public_read on public.course_bundle_items for select to anon,authenticated using(exists(select 1 from public.course_bundles b where b.id=bundle_id and b.is_published));
create policy course_enrolments_owner_read on public.course_enrolments for select to authenticated using(student_id=auth.uid() or public.is_parent_of(student_id));
create policy lesson_progress_owner on public.lesson_progress for all to authenticated using(student_id=auth.uid()) with check(student_id=auth.uid() and public.has_course_access((select m.course_id from public.course_lessons l join public.course_modules m on m.id=l.module_id where l.id=lesson_id)));
create policy lesson_progress_parent_read on public.lesson_progress for select to authenticated using(public.is_parent_of(student_id));
create policy course_quizzes_enrolled on public.course_quizzes for select to authenticated using(exists(select 1 from public.course_lessons l join public.course_modules m on m.id=l.module_id where l.id=lesson_id and (l.is_free_preview or public.has_course_access(m.course_id))));
create policy course_quiz_attempts_owner on public.course_quiz_attempts for all to authenticated using(student_id=auth.uid()) with check(student_id=auth.uid() and exists(select 1 from public.course_quizzes q join public.course_lessons l on l.id=q.lesson_id join public.course_modules m on m.id=l.module_id where q.id=quiz_id and (l.is_free_preview or public.has_course_access(m.course_id))));
create policy course_quiz_attempts_parent_read on public.course_quiz_attempts for select to authenticated using(public.is_parent_of(student_id));
create policy assignments_enrolled_read on public.assignments for select to authenticated using(exists(select 1 from public.course_lessons l join public.course_modules m on m.id=l.module_id where l.id=lesson_id and public.has_course_access(m.course_id)));
create policy assignment_submissions_owner on public.assignment_submissions for select to authenticated using(student_id=auth.uid() or marked_by=auth.uid());
create policy assignment_submissions_insert on public.assignment_submissions for insert to authenticated with check(student_id=auth.uid() and exists(select 1 from public.assignments a join public.course_lessons l on l.id=a.lesson_id join public.course_modules m on m.id=l.module_id where a.id=assignment_id and public.has_course_access(m.course_id)));
create policy assignment_submissions_parent_read on public.assignment_submissions for select to authenticated using(public.is_parent_of(student_id));
create policy certificates_owner_read on public.certificates for select to authenticated using(revoked_at is null and (student_id=auth.uid() or public.is_parent_of(student_id)));
create policy course_reviews_public_read on public.course_reviews for select to anon,authenticated using(is_published or reviewer_id=auth.uid());
create policy course_reviews_enrollee_write on public.course_reviews for insert to authenticated with check(reviewer_id=auth.uid() and not is_published and exists(select 1 from public.course_enrolments e where e.course_id=course_reviews.course_id and e.student_id=auth.uid() and e.status in ('active','completed')));
create policy lesson_questions_enrolled_read on public.course_lesson_questions for select to authenticated using(asker_id=auth.uid() or exists(select 1 from public.course_lessons l join public.course_modules m on m.id=l.module_id where l.id=lesson_id and (l.is_free_preview or public.has_course_access(m.course_id))));
create policy lesson_questions_self on public.course_lesson_questions for insert to authenticated with check(asker_id=auth.uid() and exists(select 1 from public.course_lessons l join public.course_modules m on m.id=l.module_id where l.id=lesson_id and (l.is_free_preview or public.has_course_access(m.course_id))));
create policy lesson_answers_enrolled_read on public.course_lesson_answers for select to authenticated using(exists(select 1 from public.course_lesson_questions q where q.id=question_id and (q.asker_id=auth.uid() or public.is_admin() or exists(select 1 from public.course_lessons l join public.course_modules m on m.id=l.module_id where l.id=q.lesson_id and public.has_course_access(m.course_id)))));
create policy lesson_answers_self on public.course_lesson_answers for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from public.course_lesson_questions q join public.course_lessons l on l.id=q.lesson_id join public.course_modules m on m.id=l.module_id where q.id=question_id and (l.is_free_preview or public.has_course_access(m.course_id))));

-- Public product listing/preview only; paid files never selectable from client storage.
create policy product_categories_public on public.product_categories for select to anon,authenticated using(is_active);
create policy published_products_public on public.products for select to anon,authenticated using(status='published');
create policy product_files_entitled_read on public.product_files for select to authenticated using(public.has_product_access(product_id));
create policy product_versions_public on public.product_versions for select to anon,authenticated using(exists(select 1 from public.products p where p.id=product_id and p.status='published'));
create policy product_tags_public on public.product_tags for select to anon,authenticated using(exists(select 1 from public.products p where p.id=product_id and p.status='published'));
create policy product_bundles_public on public.product_bundles for select to anon,authenticated using(is_published);
create policy product_bundle_items_public on public.product_bundle_items for select to anon,authenticated using(exists(select 1 from public.product_bundles b where b.id=bundle_id and b.is_published));
create policy promo_codes_admin_user_read on public.promo_codes for select to authenticated using(is_active);
create policy orders_owner_read_insert on public.orders for select to authenticated using(buyer_id=auth.uid());
create policy orders_owner_insert on public.orders for insert to authenticated with check(buyer_id=auth.uid());
create policy order_items_owner_read on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.buyer_id=auth.uid()));
create policy entitlements_owner_read on public.entitlements for select to authenticated using(profile_id=auth.uid() or public.is_parent_of(profile_id));
create policy download_logs_owner_read on public.download_logs for select to authenticated using(profile_id=auth.uid());
create policy product_reviews_public on public.product_reviews for select to anon,authenticated using(is_published or reviewer_id=auth.uid());
create policy product_reviews_entitlement_insert on public.product_reviews for insert to authenticated with check(reviewer_id=auth.uid() and not is_published and public.has_product_access(product_id));
create policy wishlist_owner on public.wishlists for all to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());

-- Chats only for group members; class groups also require class membership. Community is public-channel only,
-- with parent-controlled learner consent enforced for membership and message creation.
create policy chat_group_membership_read on public.chat_groups for select to authenticated using(public.is_chat_member(id) or created_by=auth.uid() or (class_id is not null and public.can_read_class(class_id)));
create policy chat_group_creator_manage on public.chat_groups for all to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());
create policy chat_members_related on public.chat_group_members for select to authenticated using(profile_id=auth.uid() or public.is_chat_member(group_id));
create policy chat_member_insert on public.chat_group_members for insert to authenticated with check(public.can_manage_chat_group(group_id));
create policy chat_message_member_read on public.chat_messages for select to authenticated using(exists(select 1 from public.chat_group_members m where m.group_id=chat_messages.group_id and m.profile_id=auth.uid()));
create policy chat_message_member_insert on public.chat_messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.chat_group_members m where m.group_id=chat_messages.group_id and m.profile_id=auth.uid()));
create policy chat_message_sender_update on public.chat_messages for update to authenticated using(sender_id=auth.uid()) with check(sender_id=auth.uid());
create policy community_channels_public_read on public.community_channels for select to anon,authenticated using(is_active and is_public);
create policy community_members_channel_read on public.community_members for select to authenticated using(profile_id=auth.uid() or public.is_admin());
create policy community_members_join on public.community_members for insert to authenticated with check(profile_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='student') and exists(select 1 from public.student_details s where s.profile_id=auth.uid() and s.community_enabled) and exists(select 1 from public.consent_records c where c.subject_id=auth.uid() and c.consent_type='community' and c.granted and c.guardian_id is not null) and public.parent_allows_community(auth.uid()));
create policy community_members_leave on public.community_members for delete to authenticated using(profile_id=auth.uid());
create policy community_messages_member_read on public.community_messages for select to authenticated using(exists(select 1 from public.community_members m where m.channel_id=community_messages.channel_id and m.profile_id=auth.uid()));
create policy community_messages_member_insert on public.community_messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.community_members m where m.channel_id=community_messages.channel_id and m.profile_id=auth.uid()));
create policy community_messages_sender_update on public.community_messages for update to authenticated using(sender_id=auth.uid()) with check(sender_id=auth.uid());
create policy message_reports_self on public.message_reports for insert to authenticated with check(reporter_id=auth.uid());
create policy message_reports_own_read on public.message_reports for select to authenticated using(reporter_id=auth.uid());
create policy moderation_admin_read on public.moderation_actions for select to authenticated using(public.is_admin());
create policy notifications_self on public.notifications for select to authenticated using(recipient_id=auth.uid());
create policy notifications_self_update on public.notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
create policy audit_admin_only on public.audit_log for select to authenticated using(public.is_admin());
create policy report_jobs_owner on public.report_jobs for select to authenticated using(requested_by=auth.uid());
create policy report_jobs_request on public.report_jobs for insert to authenticated with check(requested_by=auth.uid());

-- Storage: user-generated objects live in owner/<auth.uid>/... paths. Product/course files are server-only;
-- entitlement checks and expiring signed links must be issued by trusted server/service-role code.
insert into storage.buckets(id,name,public) values
 ('avatars','avatars',true),('subject-illustrations','subject-illustrations',true),('materials','materials',false),
 ('homework','homework',false),('course-content','course-content',false),('products','products',false),
 ('receipts','receipts',false),('reports','reports',false),('certificates','certificates',false),('product-previews','product-previews',true)
on conflict(id) do nothing;
create policy public_avatar_read on storage.objects for select to anon,authenticated using(bucket_id='avatars');
create policy avatar_owner_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_owner_update on storage.objects for update to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy public_illustration_read on storage.objects for select to anon,authenticated using(bucket_id='subject-illustrations');
create policy illustration_admin_insert on storage.objects for insert to authenticated with check(bucket_id='subject-illustrations' and public.is_admin());
create policy illustration_admin_update on storage.objects for update to authenticated using(bucket_id='subject-illustrations' and public.is_admin()) with check(bucket_id='subject-illustrations' and public.is_admin());
create policy public_watermarked_preview_read on storage.objects for select to anon,authenticated using(bucket_id='product-previews');
create policy preview_admin_insert on storage.objects for insert to authenticated with check(bucket_id='product-previews' and public.is_admin());
create policy preview_admin_update on storage.objects for update to authenticated using(bucket_id='product-previews' and public.is_admin()) with check(bucket_id='product-previews' and public.is_admin());
create policy material_owner_or_teacher_select on storage.objects for select to authenticated using(bucket_id='materials' and (public.is_admin() or (storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.materials m join public.material_shares s on s.material_id=m.id where m.file_path=name and (s.student_id=auth.uid() or public.is_parent_of(s.student_id) or public.is_class_member(s.class_id)))));
create policy material_teacher_insert on storage.objects for insert to authenticated with check(bucket_id='materials' and (storage.foldername(name))[1]=auth.uid()::text and public.has_role('teacher'));
create policy homework_owner_teacher_select on storage.objects for select to authenticated using(bucket_id='homework' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin() or exists(select 1 from public.homework_submissions h where h.file_path=name and (public.teaches_class(h.class_id) or public.is_parent_of(h.student_id)))));
create policy homework_owner_insert on storage.objects for insert to authenticated with check(bucket_id='homework' and (storage.foldername(name))[1]=auth.uid()::text);
create policy receipt_owner_select on storage.objects for select to authenticated using(bucket_id='receipts' and (public.is_admin() or exists(select 1 from public.receipts r where r.file_path=name and (r.owner_id=auth.uid() or public.is_parent_of(r.owner_id)))));
create policy report_owner_select on storage.objects for select to authenticated using(bucket_id='reports' and (public.is_admin() or exists(select 1 from public.generated_reports r where r.file_path=name and (r.owner_id=auth.uid() or (r.subject_profile_id is not null and public.is_parent_of(r.subject_profile_id))))));
create policy certificate_owner_select on storage.objects for select to authenticated using(bucket_id='certificates' and (public.is_admin() or exists(select 1 from public.certificates c where c.file_path=name and (c.student_id=auth.uid() or public.is_parent_of(c.student_id)))));
-- No client SELECT/INSERT policies for course-content or products: signed URLs are granted only after server checks.
