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
create index if not exists idx_course_enrolments_student on public.course_enrolments(student_id,status);
create index if not exists idx_products_status on public.products(status,featured);
create index if not exists idx_courses_status on public.courses(status);
create index if not exists idx_chat_messages_group_time on public.chat_messages(group_id,created_at);
create index if not exists idx_community_messages_channel_time on public.community_messages(channel_id,created_at);
create index if not exists idx_notifications_owner on public.notifications(recipient_id,created_at desc);
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' loop
   execute format('alter table public.%I enable row level security',t.tablename);
   if not exists(select 1 from pg_policies where schemaname='public' and tablename=t.tablename and policyname='admin_all') then
     execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',t.tablename);
   end if;
 end loop;
end $$;
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
do $$ declare t text; begin foreach t in array array['education_systems','grades','pathways','pathway_tracks','subject_groups','learning_areas','grade_learning_areas','combination_rules','subject_combinations','subject_combination_areas','strands','sub_strands','core_competencies','curriculum_values','assessment_scales','scale_levels'] loop
 execute format('create policy public_curriculum_read on public.%I for select to anon,authenticated using (true)',t);
end loop; end $$;
create policy student_subjects_related on public.student_subjects for select to authenticated using(student_id=auth.uid() or public.is_parent_of(student_id));
create policy student_subjects_self_write on public.student_subjects for insert to authenticated with check(student_id=auth.uid());
create policy student_subjects_self_update on public.student_subjects for update to authenticated using(student_id=auth.uid()) with check(student_id=auth.uid());
create policy teacher_subjects_public_read on public.teacher_subjects for select to anon,authenticated using(true);
create policy teacher_subjects_self_write on public.teacher_subjects for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
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
create policy quizzes_creator_manage on public.quizzes for all to authenticated using(created_by=auth.uid() and public.has_role('teacher')) with check(created_by=auth.uid() and public.has_role('teacher'));
create policy quiz_questions_access on public.quiz_questions for select to authenticated using(exists(select 1 from public.quizzes q where q.id=quiz_id and (q.created_by=auth.uid() or (q.is_published and (q.class_id is null or public.can_read_class(q.class_id))))));
create policy quiz_questions_teacher_manage on public.quiz_questions for all to authenticated using(exists(select 1 from public.quizzes q where q.id=quiz_id and q.created_by=auth.uid() and public.has_role('teacher'))) with check(exists(select 1 from public.quizzes q where q.id=quiz_id and q.created_by=auth.uid() and public.has_role('teacher')));
create policy quiz_attempts_self_parent_teacher on public.quiz_attempts for select to authenticated using(student_id=auth.uid() or public.is_parent_of(student_id) or exists(select 1 from public.quizzes q where q.id=quiz_id and q.created_by=auth.uid()));
create policy quiz_attempts_self_write on public.quiz_attempts for all to authenticated using(student_id=auth.uid()) with check(student_id=auth.uid());
create policy reviews_public_read on public.reviews for select to anon,authenticated using(is_published or reviewer_id=auth.uid() or public.is_admin());
create policy reviews_enrolled_student_write on public.reviews for insert to authenticated with check(reviewer_id=auth.uid() and not is_published and exists(select 1 from public.enrolments e where e.class_id=reviews.class_id and e.student_id=auth.uid() and e.status in ('active','completed')));
create policy qa_questions_read on public.qa_questions for select to anon,authenticated using(visibility='public' or asker_id=auth.uid() or public.can_read_class(class_id));
create policy qa_questions_self_write on public.qa_questions for all to authenticated using(asker_id=auth.uid()) with check(asker_id=auth.uid());
create policy qa_answers_read on public.qa_answers for select to anon,authenticated using(exists(select 1 from public.qa_questions q where q.id=question_id and (q.visibility='public' or q.asker_id=auth.uid() or public.can_read_class(q.class_id))));
create policy qa_answers_self_write on public.qa_answers for all to authenticated using(author_id=auth.uid()) with check(author_id=auth.uid());
create policy public_settings_read on public.settings for select to anon,authenticated using(is_public);
create policy reports_owner_read on public.generated_reports for select to authenticated using(owner_id=auth.uid() or (subject_profile_id is not null and public.is_parent_of(subject_profile_id)));
create policy reports_owner_request on public.generated_reports for insert to authenticated with check(owner_id=auth.uid());
create policy published_courses_read on public.courses for select to anon,authenticated using(status='published');
create policy course_structure_public_read on public.course_modules for select to anon,authenticated using(exists(select 1 from public.courses c where c.id=course_id and c.status='published'));
create policy course_lessons_access on public.course_lessons for select to anon,authenticated using(is_published and exists(select 1 from public.course_modules m join public.courses c on c.id=m.course_id where m.id=course_lessons.module_id and c.status='published' and (course_lessons.is_free_preview or (auth.uid() is not null and (public.is_admin() or exists(select 1 from public.course_enrolments e where e.course_id=c.id and e.student_id=auth.uid() and e.status in ('active','completed') and (e.expires_at is null or e.expires_at>now())))))));
create policy lesson_resources_enrolled_access on public.lesson_resources for select to authenticated using(exists(select 1 from public.course_lessons l join public.course_modules m on m.id=l.module_id where l.id=lesson_id and (l.is_free_preview or public.has_course_access(m.course_id))));
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
