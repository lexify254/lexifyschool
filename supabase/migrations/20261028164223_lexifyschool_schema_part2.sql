create table if not exists public.settings (
 key text primary key, value jsonb not null, description text, is_public boolean not null default false,
 updated_by uuid references public.profiles(id) on delete set null, updated_at timestamptz not null default now()
);
create table if not exists public.generated_reports (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
 report_type text not null, subject_profile_id uuid references public.profiles(id) on delete set null,
 file_path text, parameters jsonb not null default '{}'::jsonb, generated_at timestamptz not null default now(), expires_at timestamptz
);
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
create table if not exists public.course_enrolments (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade, status text not null default 'pending' check(status in ('pending','active','completed','revoked')),
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
create table if not exists public.entitlements (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
 product_id uuid references public.products(id) on delete cascade, course_id uuid references public.courses(id) on delete cascade,
 status text not null default 'active' check(status in ('active','revoked','expired')), starts_at timestamptz not null default now(), ends_at timestamptz,
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
