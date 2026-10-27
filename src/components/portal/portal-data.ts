import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentProfile } from "@/lib/auth/guards";
import type { PortalRecord } from "./portal-ui";
import { whatsappHref } from "@/lib/whatsapp/links";

export type SubjectItem = { id: string; title: string; iconName?: string | null; accentColor?: string | null; illustrationUrl?: string | null; note?: string };
export type DashboardData = {
  stats: { label: string; value: string; note?: string }[];
  subjects: SubjectItem[];
  scores: { title: string; detail: string; meta: string }[];
  programs: PortalRecord[];
  upcoming: PortalRecord[];
  goals: string[];
  records: PortalRecord[];
  attendance: { present: number; absent: number; late: number; excused: number; total: number };
  strongest?: string;
  weakest?: string;
};
type Row = Record<string, any>;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : [];
const text = (value: unknown, fallback = "—") => value == null || value === "" ? fallback : String(value);
const date = (value: unknown) => { if (!value) return "Date not set"; const parsed = new Date(String(value)); return Number.isNaN(parsed.valueOf()) ? String(value) : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: typeof value === "string" && value.includes(":") ? "short" : undefined }).format(parsed); };
const kes = (value: unknown) => `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
const scheduleText = (value: unknown) => {
  if (!value || (typeof value === "object" && !Array.isArray(value) && !Object.keys(value as object).length)) return "Schedule not listed";
  let record: unknown = value;
  if (typeof value === "string") { try { record = JSON.parse(value); } catch { return value.replace(/https?:\/\/\S+/gi, "[private link omitted]"); } }
  if (Array.isArray(record)) return record.map((part) => typeof part === "string" || typeof part === "number" ? String(part) : "").filter(Boolean).join(" · ") || "Schedule recorded";
  if (typeof record !== "object" || record === null) return "Schedule recorded";
  const entries = Object.entries(record as Record<string, unknown>).filter(([key]) => !/(meeting|link|url|phone|contact)/i.test(key)).map(([key, item]) => {
    const valueText = Array.isArray(item) ? item.filter((x) => typeof x === "string" || typeof x === "number").join(", ") : (typeof item === "string" || typeof item === "number") ? String(item) : "";
    return valueText ? `${key.replaceAll("_", " ")}: ${valueText.replace(/https?:\/\/\S+/gi, "[private link omitted]")}` : "";
  }).filter(Boolean);
  return entries.length ? entries.join(" · ") : "Schedule recorded";
};
const list = async (client: SupabaseClient, table: string, select: string, filters: (q: any) => any, limit = 50) => {
  try { const { data } = await filters(client.from(table).select(select)).limit(limit); return rows(data); } catch { return []; }
};
const one = async (client: SupabaseClient, table: string, select: string, filters: (q: any) => any) => {
  try { const { data } = await filters(client.from(table).select(select)).maybeSingle(); return data as Row | null; } catch { return null; }
};
const inList = (client: SupabaseClient, table: string, select: string, column: string, ids: string[], limit = 100) => ids.length ? list(client, table, select, (q) => q.in(column, ids), limit) : Promise.resolve([] as Row[]);
const ymd = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

export async function readStudentDashboard(client: SupabaseClient, profile: CurrentProfile): Promise<DashboardData> {
  const id = profile.id;
  const [detail, selections, enrolments, scores, attendances, courses, entitlements, payments] = await Promise.all([
    one(client, "student_details", "goals,community_enabled", (q) => q.eq("profile_id", id)),
    list(client, "student_subjects", "id,learning_area_id,selection_type", (q) => q.eq("student_id", id), 100),
    list(client, "enrolments", "id,class_id,status,starts_at,ends_at,lessons_remaining", (q) => q.eq("student_id", id).eq("status", "active"), 100),
    list(client, "scores", "id,learning_area_id,assessment_type,score,max_score,percentage,assessed_on", (q) => q.eq("student_id", id).order("assessed_on", { ascending: false }), 50),
    list(client, "attendance", "id,lesson_id,status,joined_at", (q) => q.eq("student_id", id), 500),
    list(client, "course_enrolments", "id,course_id,status,expires_at,enrolled_at", (q) => q.eq("student_id", id).in("status", ["active", "completed"]), 100),
    list(client, "entitlements", "id,product_id,status,ends_at,starts_at", (q) => q.eq("profile_id", id).eq("status", "active"), 100),
    list(client, "payments", "id,amount_kes,status,purpose,paid_at,created_at", (q) => q.eq("payer_id", id).order("created_at", { ascending: false }), 30),
  ]);
  const classIds = enrolments.map((x) => String(x.class_id));
  const [classes, lessons] = await Promise.all([
    inList(client, "classes", "id,title,teacher_id,learning_area_id,schedule,payment_basis,price_kes,lessons_in_bundle", "id", classIds),
    classIds.length ? list(client, "lessons", "id,class_id,title,starts_at,ends_at", (q) => q.in("class_id", classIds).gte("starts_at", ymd(-60)).order("starts_at", { ascending: true }), 100) : Promise.resolve([]),
  ]);
  const areaIds = [...new Set([...selections.map((x) => String(x.learning_area_id)), ...scores.map((x) => String(x.learning_area_id)), ...classes.map((x) => String(x.learning_area_id))].filter(Boolean))];
  const teacherIds = [...new Set(classes.map((x) => String(x.teacher_id)).filter(Boolean))];
  const [areas, teachers, courseRows, products] = await Promise.all([
    inList(client, "learning_areas", "id,title,icon_name,accent_color,illustration_url", "id", areaIds),
    inList(client, "teacher_details", "profile_id,public_name,public_whatsapp", "profile_id", teacherIds),
    inList(client, "courses", "id,title,code", "id", courses.map((x) => String(x.course_id))),
    inList(client, "products", "id,title,code", "id", entitlements.map((x) => String(x.product_id)).filter(Boolean)),
  ]);
  const areaBy = new Map(areas.map((x) => [String(x.id), x]));
  const teacherBy = new Map(teachers.map((x) => [String(x.profile_id), x]));
  const subjects = selections.map((item): SubjectItem | null => { const area = areaBy.get(String(item.learning_area_id)); return area ? { id: String(area.id), title: text(area.title), iconName: area.icon_name, accentColor: area.accent_color, illustrationUrl: area.illustration_url, note: text(item.selection_type, "Selected") } : null; }).filter((x): x is SubjectItem => !!x);
  const scoreRows = scores.map((x): Row => ({ ...x, area: areaBy.get(String(x.learning_area_id)) })).filter((x) => x.area).map((x) => ({ title: text(x.area.title), detail: x.percentage != null ? `${Number(x.percentage)}%` : x.score != null && x.max_score != null ? `${x.score} / ${x.max_score}` : "Score not entered", meta: `${text(x.assessment_type)} · ${date(x.assessed_on)}` }));
  const scoreGroups = new Map<string, number[]>();
  for (const score of scores) { const area = areaBy.get(String(score.learning_area_id)); const pct = score.percentage != null ? Number(score.percentage) : Number(score.max_score) > 0 && score.score != null ? 100 * Number(score.score) / Number(score.max_score) : null; if (area && pct != null) scoreGroups.set(String(area.id), [...(scoreGroups.get(String(area.id)) ?? []), pct]); }
  const averages = [...scoreGroups].map(([areaId, vals]) => ({ area: areaBy.get(areaId), value: vals.reduce((a, b) => a + b, 0) / vals.length })).filter((x) => x.area).sort((a, b) => b.value - a.value);
  const programs: PortalRecord[] = enrolments.map((enrol) => {
    const klass = classes.find((x) => String(x.id) === String(enrol.class_id));
    const teacher = klass ? teacherBy.get(String(klass.teacher_id)) : null;
    const area = klass ? areaBy.get(String(klass.learning_area_id)) : null;
    return { title: text(klass?.title, "Tutoring program"), detail: [area?.title, teacher?.public_name ? `Teacher: ${teacher.public_name}` : "Teacher profile not available"].filter(Boolean).join(" · "), meta: `${scheduleText(klass?.schedule)} · ${klass ? kes(klass.price_kes) : "Price not available"} · ${text(klass?.payment_basis, "Payment basis not listed").replaceAll("_", " ")} · ${enrol.lessons_remaining == null ? "Lessons remaining not tracked" : `${enrol.lessons_remaining} lesson${Number(enrol.lessons_remaining) === 1 ? "" : "s"} remaining`} · ${enrol.ends_at ? `Expires ${date(enrol.ends_at)}` : "No expiry recorded"}` };
  });
  const upcoming: PortalRecord[] = lessons.filter((x) => new Date(String(x.starts_at)).getTime() >= Date.now()).slice(0, 8).map((lesson) => ({ title: text(lesson.title), detail: date(lesson.starts_at), meta: classes.find((x) => String(x.id) === String(lesson.class_id))?.title }));
  const total = attendances.length;
  const attendance = { present: attendances.filter((x) => x.status === "present").length, absent: attendances.filter((x) => x.status === "absent").length, late: attendances.filter((x) => x.status === "late").length, excused: attendances.filter((x) => x.status === "excused").length, total };
  const courseNames = new Map(courseRows.map((x) => [String(x.id), text(x.title)]));
  const productNames = new Map(products.map((x) => [String(x.id), text(x.title)]));
  const records: PortalRecord[] = [
    ...courses.map((x) => ({ title: courseNames.get(String(x.course_id)) ?? "Academy course", detail: `Status: ${text(x.status)}`, meta: x.expires_at ? `Access until ${date(x.expires_at)}` : "No expiry recorded", href: "/student/courses" })),
    ...entitlements.map((x) => ({ title: productNames.get(String(x.product_id)) ?? "Purchased project", detail: x.ends_at ? `Access until ${date(x.ends_at)}` : "Active entitlement", href: "/student/library" })),
    ...payments.map((x) => ({ title: `${text(x.purpose)} payment`, detail: `${kes(x.amount_kes)} · ${text(x.status)}`, meta: x.paid_at ? `Paid ${date(x.paid_at)}` : date(x.created_at), href: "/student/payments" })),
  ];
  return {
    stats: [
      { label: "Active tutoring programs", value: String(enrolments.length) }, { label: "Attendance records", value: String(total), note: total ? `${attendance.present} present · ${attendance.absent} absent · ${attendance.late} late · ${attendance.excused} excused` : "No attendance has been recorded yet" },
      { label: "Assessment records", value: String(scores.length), note: scores.length ? "Based on teacher-entered assessments" : "Scores will appear when recorded" },
    ],
    subjects, scores: scoreRows.slice(0, 8), programs, upcoming,
    goals: detail?.goals ? String(detail.goals).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean) : [], records, attendance,
    strongest: averages[0] ? text(averages[0].area?.title) : "Not enough scored assessments yet", weakest: averages.length ? text(averages[averages.length - 1].area?.title) : "Not enough scored assessments yet",
  } as DashboardData & { strongest: string; weakest: string };
}

export async function readParentDashboard(client: SupabaseClient, profile: CurrentProfile): Promise<DashboardData & { children: Row[] }> {
  const links = await list(client, "parent_student_links", "student_id,relationship,confirmed_at", (q) => q.eq("parent_id", profile.id).not("confirmed_at", "is", null), 100);
  const childIds = links.map((x) => String(x.student_id));
  const [profiles, details, subjects, courseEnrolments, entitlements, receipts, reports] = await Promise.all([
    inList(client, "profiles", "id,full_name,avatar_url", "id", childIds), inList(client, "student_details", "profile_id,goals,community_enabled", "profile_id", childIds),
    inList(client, "student_subjects", "id,student_id,learning_area_id,selection_type", "student_id", childIds), inList(client, "course_enrolments", "id,student_id,course_id,status,expires_at", "student_id", childIds),
    inList(client, "entitlements", "id,profile_id,product_id,status,ends_at", "profile_id", childIds), list(client, "receipts", "id,owner_id,payment_id,receipt_number,file_path,issued_at", (q) => q.in("owner_id", [profile.id, ...childIds]).order("issued_at", { ascending: false }), 100),
    list(client, "generated_reports", "id,subject_profile_id,report_type,file_path,generated_at,expires_at", (q) => q.in("subject_profile_id", childIds).order("generated_at", { ascending: false }), 50),
  ]);
  const areaIds = [...new Set(subjects.map((x) => String(x.learning_area_id)))];
  const courseIds = [...new Set(courseEnrolments.map((x) => String(x.course_id)))];
  const productIds = [...new Set(entitlements.map((x) => String(x.product_id)).filter(Boolean))];
  const [areas, courses, products] = await Promise.all([inList(client, "learning_areas", "id,title,icon_name,accent_color,illustration_url", "id", areaIds), inList(client, "courses", "id,title", "id", courseIds), inList(client, "products", "id,title", "id", productIds)]);
  const profileMap = new Map(profiles.map((x) => [String(x.id), x]));
  const detailsMap = new Map(details.map((x) => [String(x.profile_id), x]));
  const children = childIds.map((childId) => ({ id: childId, name: text(profileMap.get(childId)?.full_name, "Linked learner"), relationship: text(links.find((l) => String(l.student_id) === childId)?.relationship, "Child or learner"), goals: text(detailsMap.get(childId)?.goals, "No learning goals provided"), communityEnabled: detailsMap.get(childId)?.community_enabled !== false, subjects: subjects.filter((s) => String(s.student_id) === childId).map((s) => { const a = areas.find((z) => String(z.id) === String(s.learning_area_id)); return a ? { id: String(a.id), title: text(a.title), iconName: a.icon_name, accentColor: a.accent_color, illustrationUrl: a.illustration_url } : null; }).filter(Boolean) as SubjectItem[], courses: courseEnrolments.filter((c) => String(c.student_id) === childId).map((c) => courses.find((x) => String(x.id) === String(c.course_id))?.title).filter(Boolean) as string[], projects: entitlements.filter((e) => String(e.profile_id) === childId).map((e) => products.find((x) => String(x.id) === String(e.product_id))?.title).filter(Boolean) as string[] }));
  const records = [
    ...reports.map((x) => ({ title: `${text(x.report_type).replaceAll("_", " ")} report`, detail: profileMap.get(String(x.subject_profile_id))?.full_name ?? "Linked learner", meta: `Generated ${date(x.generated_at)}${x.expires_at ? ` · expires ${date(x.expires_at)}` : ""}${x.file_path ? " · report file exists; download endpoint not configured" : ""}` })),
    ...receipts.map((x) => ({ title: `Receipt ${text(x.receipt_number)}`, detail: `Issued ${date(x.issued_at)}`, meta: x.file_path ? "Receipt file exists; secure download is not configured here" : "No receipt file is attached" })),
  ];
  return { stats: [{ label: "Confirmed linked learners", value: String(children.length) }, { label: "Available report records", value: String(reports.length) }, { label: "Receipts on file", value: String(receipts.length) }], subjects: [], scores: [], programs: [], upcoming: [], goals: [], records, attendance: { present: 0, absent: 0, late: 0, excused: 0, total: 0 }, children };
}

export async function readTeacherDashboard(client: SupabaseClient, profile: CurrentProfile): Promise<DashboardData> {
  const [classes, earnings, payouts, awards, paymentRequests] = await Promise.all([
    list(client, "classes", "id,title,learning_area_id,grade_id,payment_basis,price_kes,lessons_in_bundle,is_active,schedule", (q) => q.eq("teacher_id", profile.id), 100),
    list(client, "ledger_entries", "id,entry_type,amount_kes,direction,description,created_at", (q) => q.eq("account_profile_id", profile.id).order("created_at", { ascending: false }), 100),
    list(client, "payout_requests", "id,amount_kes,status,requested_at,processed_at", (q) => q.eq("teacher_id", profile.id).order("requested_at", { ascending: false }), 50),
    list(client, "badge_awards", "id,awarded_at,expires_at,revoked_at", (q) => q.eq("teacher_id", profile.id).is("revoked_at", null), 20),
    list(client, "payment_requests", "id,amount_kes,description,status,expires_at,created_at", (q) => q.eq("teacher_id", profile.id).order("created_at", { ascending: false }), 50),
  ]);
  const classIds = classes.map((x) => String(x.id));
  const [enrolments, lessons, areas, grades] = await Promise.all([
    classIds.length ? list(client, "enrolments", "id,class_id,student_id,status,lessons_remaining,ends_at", (q) => q.in("class_id", classIds), 150) : Promise.resolve([] as Row[]),
    classIds.length ? list(client, "lessons", "id,class_id,title,starts_at", (q) => q.in("class_id", classIds).gte("starts_at", ymd(0)).order("starts_at", { ascending: true }), 100) : Promise.resolve([] as Row[]),
    inList(client, "learning_areas", "id,title,icon_name,accent_color,illustration_url", "id", classes.map((x) => String(x.learning_area_id))),
    inList(client, "grades", "id,name", "id", classes.map((x) => String(x.grade_id))),
  ]);
  const studentIds = [...new Set(enrolments.map((x) => String(x.student_id)))];
  const [attendanceRows, assessmentRows, homeworkRows] = await Promise.all([studentIds.length ? list(client, "attendance", "id,status,student_id", (q) => q.in("student_id", studentIds), 500) : Promise.resolve([] as Row[]), classIds.length ? list(client, "scores", "id,student_id,percentage,score,assessed_on", (q) => q.in("class_id", classIds).order("assessed_on", { ascending: false }), 200) : Promise.resolve([] as Row[]), classIds.length ? list(client, "homework_submissions", "id,student_id,title,submitted_at,score", (q) => q.in("class_id", classIds), 200) : Promise.resolve([] as Row[])]);
  const studentProfiles = await inList(client, "profiles", "id,full_name", "id", studentIds);
  const subjectIds = [...new Set(classes.map((x) => String(x.learning_area_id)))];
  const areaMap = new Map(areas.map((x) => [String(x.id), x]));
  const gradeMap = new Map(grades.map((x) => [String(x.id), x]));
  const classById = new Map(classes.map((x) => [String(x.id), x]));
  const profileMap = new Map(studentProfiles.map((x) => [String(x.id), x]));
  const balance = earnings.reduce((sum, entry) => sum + (entry.direction === "credit" ? 1 : -1) * Number(entry.amount_kes ?? 0), 0);
  const programs: PortalRecord[] = classes.map((klass) => ({ title: text(klass.title), detail: [areaMap.get(String(klass.learning_area_id))?.title, gradeMap.get(String(klass.grade_id))?.name].filter(Boolean).join(" · ") || "Class details not available", meta: `${scheduleText(klass.schedule)} · ${kes(klass.price_kes)} · ${text(klass.payment_basis).replaceAll("_", " ")}${klass.lessons_in_bundle ? ` · ${klass.lessons_in_bundle} lessons per bundle` : ""} · ${klass.is_active ? "Active" : "Inactive"}` }));
  const students = studentIds.map((id) => ({ title: text(profileMap.get(id)?.full_name, "Learner"), detail: classes.filter((x) => enrolments.some((e) => String(e.student_id) === id && String(e.class_id) === String(x.id))).map((x) => text(x.title)).join(", ") || "Enrolled class" }));
  const upcoming = lessons.slice(0, 8).map((x) => ({ title: text(x.title), detail: date(x.starts_at), meta: classById.get(String(x.class_id))?.title }));
  const records: PortalRecord[] = [
    ...paymentRequests.map((x) => ({ title: text(x.description), detail: `${kes(x.amount_kes)} · ${text(x.status)}`, meta: x.expires_at ? `Expires ${date(x.expires_at)}` : date(x.created_at) })),
    ...payouts.map((x) => ({ title: `Payout ${text(x.status)}`, detail: kes(x.amount_kes), meta: date(x.requested_at) })),
    ...awards.map((x) => ({ title: "Verified teacher badge", detail: x.expires_at ? `Expires ${date(x.expires_at)}` : "No expiry recorded", meta: `Awarded ${date(x.awarded_at)}`, tone: "good" as const })),
  ];
  return { stats: [{ label: "Classes", value: String(classes.length) }, { label: "Active learner enrolments", value: String(enrolments.filter((x) => x.status === "active").length) }, { label: "Upcoming bookings", value: String(lessons.length) }, { label: "Attendance records", value: String(attendanceRows.length), note: attendanceRows.length ? `${attendanceRows.filter((x) => x.status === "present").length} present · ${attendanceRows.filter((x) => x.status === "absent").length} absent · ${attendanceRows.filter((x) => x.status === "late").length} late · ${attendanceRows.filter((x) => x.status === "excused").length} excused` : "No attendance recorded yet" }, { label: "Assessment records", value: String(assessmentRows.length) }, { label: "Homework records", value: String(homeworkRows.length) }, { label: "Ledger balance", value: kes(balance), note: "Net of ledger credits and debits" }], subjects: classes.map((c) => areaMap.get(String(c.learning_area_id))).filter(Boolean).map((a) => ({ id: String(a!.id), title: text(a!.title), iconName: a!.icon_name, accentColor: a!.accent_color, illustrationUrl: a!.illustration_url })), scores: students.map((s) => ({ title: s.title, detail: s.detail, meta: "Student performance is available in class records" })), programs, upcoming, goals: [], records, attendance: { present: 0, absent: 0, late: 0, excused: 0, total: 0 }, teacherStudents: students, studentIds, subjectIds } as DashboardData;
}

export async function readGuestDashboard(client: SupabaseClient, profile: CurrentProfile): Promise<DashboardData> {
  const [enrolments, certificates, entitlements, receipts, payments] = await Promise.all([
    list(client, "course_enrolments", "id,course_id,status,enrolled_at,expires_at", (q) => q.eq("student_id", profile.id).in("status", ["active", "completed"]), 100),
    list(client, "certificates", "id,certificate_code,course_id,file_path,score,issued_at", (q) => q.eq("student_id", profile.id).is("revoked_at", null).order("issued_at", { ascending: false }), 50),
    list(client, "entitlements", "id,product_id,status,ends_at", (q) => q.eq("profile_id", profile.id).eq("status", "active"), 100),
    list(client, "receipts", "id,receipt_number,file_path,issued_at", (q) => q.eq("owner_id", profile.id).order("issued_at", { ascending: false }), 50),
    list(client, "payments", "id,amount_kes,status,purpose,paid_at,created_at", (q) => q.eq("payer_id", profile.id).order("created_at", { ascending: false }), 50),
  ]);
  const courseIds = [...new Set([...enrolments.map((x) => String(x.course_id)), ...certificates.map((x) => String(x.course_id))])];
  const productIds = [...new Set(entitlements.map((x) => String(x.product_id)).filter(Boolean))];
  const [courses, products, progress] = await Promise.all([inList(client, "courses", "id,title", "id", courseIds), inList(client, "products", "id,title", "id", productIds), list(client, "lesson_progress", "id,lesson_id,completed_at", (q) => q.eq("student_id", profile.id), 500)]);
  const [courseLessons, modules] = await Promise.all([
    Promise.resolve([] as Row[]),
    inList(client, "course_modules", "id,course_id", "course_id", courseIds),
  ]);
  const lessonRows = modules.length ? await inList(client, "course_lessons", "id,module_id", "module_id", modules.map((x) => String(x.id)), 500) : courseLessons;
  const completedIds = new Set(progress.filter((x) => x.completed_at).map((x) => String(x.lesson_id)));
  const modulesByCourse = new Map<string, Set<string>>();
  for (const module of modules) modulesByCourse.set(String(module.course_id), new Set([...(modulesByCourse.get(String(module.course_id)) ?? []), String(module.id)]));
  const courseRecords = enrolments.map((enrol) => { const courseId = String(enrol.course_id); const lessonIds = lessonRows.filter((l) => modulesByCourse.get(courseId)?.has(String(l.module_id))).map((l) => String(l.id)); const done = lessonIds.filter((l) => completedIds.has(l)).length; return { title: courses.find((c) => String(c.id) === courseId)?.title ?? "Enrolled course", detail: `${text(enrol.status)} · ${done} of ${lessonIds.length} lessons completed`, meta: enrol.expires_at ? `Access until ${date(enrol.expires_at)}` : "No expiry recorded", href: "/guest/courses" }; });
  const records: PortalRecord[] = [
    ...certificates.map((x) => ({ title: `Certificate ${text(x.certificate_code)}`, detail: courses.find((c) => String(c.id) === String(x.course_id))?.title ?? "Course certificate", meta: `Issued ${date(x.issued_at)}${x.score != null ? ` · score ${x.score}` : ""}` })),
    ...entitlements.map((x) => ({ title: products.find((p) => String(p.id) === String(x.product_id))?.title ?? "Purchased project", detail: x.ends_at ? `Access until ${date(x.ends_at)}` : "Active entitlement", href: "/guest/library" })),
    ...receipts.map((x) => ({ title: `Receipt ${text(x.receipt_number)}`, detail: `Issued ${date(x.issued_at)}`, meta: x.file_path ? "Receipt file exists; secure download is not configured here" : "No receipt file is attached" })),
    ...payments.map((x) => ({ title: `${text(x.purpose)} payment`, detail: `${kes(x.amount_kes)} · ${text(x.status)}`, meta: x.paid_at ? `Paid ${date(x.paid_at)}` : date(x.created_at) })),
  ];
  return { stats: [{ label: "Courses", value: String(enrolments.length) }, { label: "Certificates", value: String(certificates.length) }, { label: "Purchased projects", value: String(entitlements.length) }], subjects: [], scores: [], programs: courseRecords, upcoming: [], goals: [], records, attendance: { present: 0, absent: 0, late: 0, excused: 0, total: 0 } };
}

export async function readSection(client: SupabaseClient, profile: CurrentProfile, role: "student" | "parent" | "teacher" | "guest", section: string): Promise<{ records: PortalRecord[]; note?: string }> {
  const id = profile.id;
  const rowsToRecords = (items: Row[], titleField: string, detail: (x: Row) => string, meta: (x: Row) => string): PortalRecord[] => items.map((x) => ({ title: text(x[titleField]), detail: detail(x), meta: meta(x) }));
  const empty = { records: [] as PortalRecord[] };
  if (role === "student") {
    const [enrolments, courses, entitlements, payments, submissions, quizAttempts, memberships, channels] = await Promise.all([
      list(client, "enrolments", "class_id,status,ends_at,lessons_remaining", (q) => q.eq("student_id", id).in("status", ["active", "completed"]), 100),
      list(client, "course_enrolments", "course_id,status,expires_at", (q) => q.eq("student_id", id).in("status", ["active", "completed"]), 100),
      list(client, "entitlements", "product_id,status,ends_at", (q) => q.eq("profile_id", id).eq("status", "active"), 100),
      list(client, "payments", "amount_kes,status,purpose,paid_at,created_at", (q) => q.eq("payer_id", id).order("created_at", { ascending: false }), 50),
      list(client, "homework_submissions", "title,due_at,submitted_at,score,feedback", (q) => q.eq("student_id", id).order("due_at", { ascending: true }), 100),
      list(client, "quiz_attempts", "quiz_id,score,started_at,submitted_at", (q) => q.eq("student_id", id).order("started_at", { ascending: false }), 100),
      list(client, "chat_group_members", "group_id,joined_at", (q) => q.eq("profile_id", id), 50),
      list(client, "community_members", "channel_id,joined_at", (q) => q.eq("profile_id", id), 50),
    ]);
    const classIds = enrolments.map((x) => String(x.class_id));
    const [classRows, lessons, courseRows, products, receipts] = await Promise.all([
      inList(client, "classes", "id,title,learning_area_id,teacher_id,schedule,payment_basis,price_kes", "id", classIds),
      classIds.length ? list(client, "lessons", "id,class_id,title,starts_at,ends_at", (q) => q.in("class_id", classIds).order("starts_at", { ascending: true }), 100) : Promise.resolve([]),
      inList(client, "courses", "id,title", "id", courses.map((x) => String(x.course_id))),
      inList(client, "products", "id,title", "id", entitlements.map((x) => String(x.product_id)).filter(Boolean)),
      list(client, "receipts", "receipt_number,file_path,issued_at", (q) => q.eq("owner_id", id).order("issued_at", { ascending: false }), 50),
    ]);
    const classBy = new Map(classRows.map((x) => [String(x.id), x]));
    if (section === "lessons" || section === "calendar") { const attendance = await list(client, "attendance", "lesson_id,status,joined_at", (q) => q.eq("student_id", id), 500); return { records: lessons.map((lesson) => { const mark = attendance.find((entry) => String(entry.lesson_id) === String(lesson.id)); return { title: text(lesson.title), detail: text(classBy.get(String(lesson.class_id))?.title), meta: `${date(lesson.starts_at)}${mark ? ` · attendance: ${text(mark.status)}` : " · attendance not recorded"}` }; }), note: "Only class-member lesson details are loaded; meeting links are not exposed in this view." }; }
    if (section === "quizzes" || section === "homework") return { records: [...rowsToRecords(submissions, "title", (x) => x.score == null ? (x.submitted_at ? "Submitted; awaiting mark" : "Not submitted") : `Score: ${x.score}`, (x) => `${x.due_at ? `Due ${date(x.due_at)}` : "No due date"}${x.feedback ? ` · ${x.feedback}` : ""}`), ...quizAttempts.map((x) => ({ title: "Quiz attempt", detail: x.score == null ? "Score not available" : `Score: ${x.score}`, meta: date(x.submitted_at ?? x.started_at) }))], note: "Quizzes and homework are read-only in this portal view." };
    if (section === "resources") {
      const materials = await list(client, "materials", "id,title,details,mime_type,created_at", (q) => q.order("created_at", { ascending: false }), 100);
      return { records: rowsToRecords(materials, "title", (x) => text(x.details, text(x.mime_type, "Shared by a teacher")), (x) => date(x.created_at)), note: "Secure file download has no matching endpoint in this application; file links are intentionally not shown." };
    }
    if (section === "groups") {
      const ids = memberships.map((x) => String(x.group_id)); const listGroups = await inList(client, "chat_groups", "id,title,announcement_only,created_at", "id", ids);
      return { records: rowsToRecords(listGroups, "title", (x) => x.announcement_only ? "Announcements only" : "Class group", (x) => date(x.created_at)), note: "Group messages and membership changes are not implemented on this page." };
    }
    if (section === "community") {
      const ids = channels.map((x) => String(x.channel_id)); const items = await inList(client, "community_channels", "id,name,description", "id", ids);
      return { records: rowsToRecords(items, "name", (x) => text(x.description, "Community channel"), () => "Joined channel"), note: "Community access is governed by recorded learner and guardian consent. Posting is not enabled in this view." };
    }
    if (section === "questions") {
      const items = await list(client, "qa_questions", "id,title,body,visibility,created_at", (q) => q.order("created_at", { ascending: false }), 50);
      return { records: rowsToRecords(items, "title", (x) => text(x.body), (x) => `${text(x.visibility)} · ${date(x.created_at)}`), note: "Questions and answers are read-only in this page." };
    }
    if (section === "courses") return { records: courses.map((x) => ({ title: courseRows.find((c) => String(c.id) === String(x.course_id))?.title ?? "Academy course", detail: text(x.status), meta: x.expires_at ? `Expires ${date(x.expires_at)}` : "No expiry recorded" })), note: "Course lessons are available only through authorized course access; lesson progress may be updated by course learning flows." };
    if (section === "library") return { records: entitlements.map((x) => ({ title: products.find((p) => String(p.id) === String(x.product_id))?.title ?? "Purchased project", detail: text(x.status), meta: x.ends_at ? `Access until ${date(x.ends_at)}` : "No expiry recorded" })), note: "Paid project files are served only by an authorized download endpoint, which is not configured here." };
    if (section === "payments") return { records: [...payments.map((x) => ({ title: `${text(x.purpose)} payment`, detail: `${kes(x.amount_kes)} · ${text(x.status)}`, meta: date(x.paid_at ?? x.created_at) })), ...receipts.map((x) => ({ title: `Receipt ${text(x.receipt_number)}`, detail: `Issued ${date(x.issued_at)}`, meta: x.file_path ? "Receipt file exists; secure download is not configured" : "No file attached" }))], note: "Payment processing is not available from this read-only portal page." };
    if (section === "profile") { const detail = await one(client, "student_details", "school,county,goals,community_enabled", (q) => q.eq("profile_id", id)); return { records: [{ title: text(profile.full_name), detail: `${text(detail?.school, "School not listed")} · ${text(detail?.county, "County not listed")}`, meta: `Community access ${detail?.community_enabled === false ? "off" : "on"}` }], note: "Profile edits are not enabled on this page." }; }
  }
  if (role === "parent") {
    const links = await list(client, "parent_student_links", "student_id,relationship,confirmed_at", (q) => q.eq("parent_id", id).not("confirmed_at", "is", null), 100); const childIds = links.map((x) => String(x.student_id));
    if (section === "children") { const profiles = await inList(client, "profiles", "id,full_name", "id", childIds); return { records: profiles.map((p) => ({ title: text(p.full_name), detail: text(links.find((l) => String(l.student_id) === String(p.id))?.relationship, "Linked learner"), href: "/parent/reports" })) }; }
    if (section === "reports") { const items = await list(client, "generated_reports", "report_type,subject_profile_id,file_path,generated_at,expires_at", (q) => q.in("subject_profile_id", childIds).order("generated_at", { ascending: false }), 50); const profiles = await inList(client, "profiles", "id,full_name", "id", childIds); return { records: items.map((x) => ({ title: `${text(x.report_type).replaceAll("_", " ")} report`, detail: profiles.find((p) => String(p.id) === String(x.subject_profile_id))?.full_name ?? "Linked learner", meta: `Generated ${date(x.generated_at)}${x.expires_at ? ` · expires ${date(x.expires_at)}` : ""}` })), note: items.some((x) => x.file_path) ? "A report record exists, but this app has no matching report download endpoint." : "Monthly and term reports appear here only when generated records exist." }; }
    if (section === "payments") { const [receipts, requests, payments] = await Promise.all([list(client, "receipts", "receipt_number,issued_at,file_path", (q) => q.in("owner_id", [id, ...childIds]).order("issued_at", { ascending: false }), 100), childIds.length ? list(client, "payment_requests", "id,description,student_id,amount_kes,status,created_at,expires_at", (q) => q.in("student_id", childIds).order("created_at", { ascending: false }), 50) : Promise.resolve([] as Row[]), list(client, "payments", "amount_kes,status,purpose,paid_at,created_at,payment_request_id", (q) => q.eq("payer_id", id).order("created_at", { ascending: false }), 50)]); return { records: [...requests.map((x) => ({ title: text(x.description), detail: `${kes(x.amount_kes)} · ${text(x.status)}`, meta: x.expires_at ? `Expires ${date(x.expires_at)}` : date(x.created_at) })), ...payments.map((x) => ({ title: `${text(x.purpose)} payment`, detail: `${kes(x.amount_kes)} · ${text(x.status)}`, meta: date(x.paid_at ?? x.created_at) })), ...receipts.map((x) => ({ title: `Receipt ${text(x.receipt_number)}`, detail: date(x.issued_at), meta: x.file_path ? "Secure receipt download is not configured" : "No receipt file attached" }))] }; }
    if (section === "teachers") { const enrolments = childIds.length ? await list(client, "enrolments", "class_id,student_id", (q) => q.in("student_id", childIds).in("status", ["active", "completed"]), 100) : []; const classRows = await inList(client, "classes", "id,title,teacher_id", "id", enrolments.map((x) => String(x.class_id))); const teacherRows = await inList(client, "teacher_details", "profile_id,public_name,public_whatsapp", "profile_id", [...new Set(classRows.map((x) => String(x.teacher_id)))]); return { records: classRows.map((x) => { const t = teacherRows.find((a) => String(a.profile_id) === String(x.teacher_id)); return { title: text(t?.public_name, "Teacher"), detail: text(x.title, "Enrolled class"), meta: "Contact by WhatsApp", href: whatsappHref(t?.public_whatsapp, `Hello, I am contacting you about ${text(x.title, "the class")}.`) ?? undefined }; }) }; }
    if (section === "community") { const details = await one(client, "parent_details", "community_access_control", (q) => q.eq("profile_id", id)); const children = await inList(client, "student_details", "profile_id,community_enabled", "profile_id", childIds); const linkedProfiles = await inList(client, "profiles", "id,full_name", "id", childIds); return { records: [{ title: "Parental community control", detail: details?.community_access_control === false ? "Parent control is disabled" : "Parent control is enabled", meta: `${children.filter((c) => c.community_enabled).length} linked learner(s) currently have learner-level community enabled` }, ...children.map((c) => ({ title: text(linkedProfiles.find((p) => String(p.id) === String(c.profile_id))?.full_name, "Linked learner"), detail: c.community_enabled ? "Learner community setting is on" : "Learner community setting is off", meta: "Guardian consent remains required" }))], note: "Changing these consent controls calls a database function and is not implemented in this read-only page." }; }
    if (section === "profile") return { records: [{ title: text(profile.full_name), detail: "Parent account", meta: "Contact preferences and profile editing are not configured here" }] };
  }
  if (role === "teacher") {
    const classes = await list(client, "classes", "id,title,learning_area_id,grade_id,payment_basis,price_kes,is_active,schedule,lessons_in_bundle", (q) => q.eq("teacher_id", id), 100); const classIds = classes.map((x) => String(x.id));
    if (section === "classes") return { records: classes.map((x) => ({ title: text(x.title), detail: `${kes(x.price_kes)} · ${text(x.payment_basis).replaceAll("_", " ")}${x.lessons_in_bundle ? ` · ${x.lessons_in_bundle} lessons per bundle` : ""}`, meta: `${scheduleText(x.schedule)} · ${x.is_active ? "Active" : "Inactive"}` })), note: "Class and pricing edits are not enabled in this view." };
    if (section === "payments") { const items = await list(client, "payment_requests", "description,amount_kes,status,student_id,expires_at,created_at", (q) => q.eq("teacher_id", id).order("created_at", { ascending: false }), 100); const profiles = await inList(client, "profiles", "id,full_name", "id", [...new Set(items.map((x) => String(x.student_id)).filter(Boolean))]); return { records: items.map((x) => ({ title: text(x.description), detail: `${kes(x.amount_kes)} · ${text(x.status)}`, meta: profiles.find((p) => String(p.id) === String(x.student_id))?.full_name ?? "Learner not linked", tone: x.status === "pending" ? "warn" : "neutral" })), note: "Payment requests can be reviewed here; collection and status changes require the payment flow." }; }
    if (section === "students") {
      const enrolments = classIds.length ? await list(client, "enrolments", "class_id,student_id,status,lessons_remaining,ends_at", (q) => q.in("class_id", classIds), 200) : [];
      const ids = [...new Set(enrolments.map((x) => String(x.student_id)))];
      const [profiles, attendance, scores, homework, notes] = await Promise.all([
        inList(client, "profiles", "id,full_name", "id", ids),
        ids.length ? list(client, "attendance", "student_id,status", (q) => q.in("student_id", ids), 500) : Promise.resolve([] as Row[]),
        classIds.length ? list(client, "scores", "student_id,percentage,score,max_score,assessed_on", (q) => q.in("class_id", classIds).order("assessed_on", { ascending: false }), 200) : Promise.resolve([] as Row[]),
        classIds.length ? list(client, "homework_submissions", "student_id,title,submitted_at,score", (q) => q.in("class_id", classIds), 200) : Promise.resolve([] as Row[]),
        classIds.length ? list(client, "progress_notes", "student_id,note,created_at", (q) => q.in("class_id", classIds).order("created_at", { ascending: false }), 200) : Promise.resolve([] as Row[]),
      ]);
      return { records: ids.map((studentId) => {
        const record = enrolments.find((e) => String(e.student_id) === studentId);
        const person = profiles.find((x) => String(x.id) === studentId);
        const learnerScores = scores.filter((x) => String(x.student_id) === studentId);
        const latest = learnerScores[0];
        const scoreSummary = latest ? (latest.percentage != null ? `${latest.percentage}% on ${date(latest.assessed_on)}` : latest.score != null ? `${latest.score}${latest.max_score != null ? `/${latest.max_score}` : ""} on ${date(latest.assessed_on)}` : "Assessment recorded") : "No assessment scores yet";
        const marks = attendance.filter((x) => String(x.student_id) === studentId);
        return { title: text(person?.full_name, "Learner"), detail: `${text(record?.status)} · ${record?.lessons_remaining == null ? "Lesson balance not tracked" : `${record.lessons_remaining} lessons remaining`}`, meta: `Latest score: ${scoreSummary} · Attendance: ${marks.filter((x) => x.status === "present").length} present, ${marks.filter((x) => x.status === "absent").length} absent, ${marks.filter((x) => x.status === "late").length} late, ${marks.filter((x) => x.status === "excused").length} excused · ${homework.filter((x) => String(x.student_id) === studentId).length} homework record(s) · ${notes.filter((x) => String(x.student_id) === studentId).length} progress note(s)` };
      }) };
    }
    if (section === "materials") { const items = await list(client, "materials", "title,details,mime_type,created_at,file_path", (q) => q.eq("teacher_id", id).order("created_at", { ascending: false }), 100); return { records: items.map((x) => ({ title: text(x.title), detail: text(x.details, text(x.mime_type, "Teaching material")), meta: `${date(x.created_at)} · secure file delivery is not configured` })), note: "Upload and share controls are not implemented on this page." }; }
    if (section === "groups") { const items = await list(client, "chat_groups", "title,class_id,announcement_only,created_at", (q) => q.eq("created_by", id).order("created_at", { ascending: false }), 100); return { records: rowsToRecords(items, "title", (x) => x.announcement_only ? "Announcements only" : "Class discussion group", (x) => date(x.created_at)) }; }
    if (section === "statement") { const [ledger, payouts] = await Promise.all([list(client, "ledger_entries", "entry_type,amount_kes,direction,description,created_at", (q) => q.eq("account_profile_id", id).order("created_at", { ascending: false }), 100), list(client, "payout_requests", "amount_kes,status,requested_at,processed_at,payout_reference", (q) => q.eq("teacher_id", id).order("requested_at", { ascending: false }), 100)]); return { records: [...ledger.map((x) => ({ title: text(x.description, text(x.entry_type)), detail: `${x.direction === "debit" ? "Debit" : "Credit"} · ${kes(x.amount_kes)}`, meta: date(x.created_at) })), ...payouts.map((x) => ({ title: `Payout ${text(x.status)}`, detail: kes(x.amount_kes), meta: `${date(x.requested_at)}${x.payout_reference ? ` · reference ${x.payout_reference}` : ""}` }))] }; }
    if (section === "badge") { const [details, awards, purchases] = await Promise.all([one(client, "teacher_details", "verification_status", (q) => q.eq("profile_id", id)), list(client, "badge_awards", "awarded_at,expires_at,revoked_at", (q) => q.eq("teacher_id", id).order("awarded_at", { ascending: false }), 20), list(client, "badge_purchases", "amount_kes,purchase_type,status,created_at", (q) => q.eq("teacher_id", id).order("created_at", { ascending: false }), 20)]); return { records: [{ title: `Verification: ${text(details?.verification_status, "unverified")}`, detail: "Teacher profile verification status", meta: "Badge award records are separate from verification" }, ...awards.map((x) => ({ title: "Badge award", detail: x.revoked_at ? "Revoked" : "Active", meta: `Awarded ${date(x.awarded_at)}${x.expires_at ? ` · expires ${date(x.expires_at)}` : ""}` })), ...purchases.map((x) => ({ title: `${text(x.purchase_type).replaceAll("_", " ")} badge purchase`, detail: `${kes(x.amount_kes)} · ${text(x.status)}`, meta: date(x.created_at) }))] }; }
    if (section === "profile") { const details = await one(client, "teacher_details", "public_name,bio,verification_status,is_accepting_students", (q) => q.eq("profile_id", id)); return { records: [{ title: text(details?.public_name, text(profile.full_name)), detail: text(details?.bio, "No public profile description"), meta: `Verification ${text(details?.verification_status)} · ${details?.is_accepting_students ? "Accepting learners" : "Not accepting learners"}` }], note: "Profile edits are not enabled on this page." }; }
  }
  if (role === "guest") {
    if (section === "courses") { const enrolments = await list(client, "course_enrolments", "course_id,status,expires_at", (q) => q.eq("student_id", id).in("status", ["active", "completed"]), 100); const courses = await inList(client, "courses", "id,title", "id", enrolments.map((x) => String(x.course_id))); const modules = await inList(client, "course_modules", "id,course_id", "course_id", enrolments.map((x) => String(x.course_id))); const lessons = await inList(client, "course_lessons", "id,module_id", "module_id", modules.map((x) => String(x.id)), 500); const progress = await list(client, "lesson_progress", "lesson_id,completed_at", (q) => q.eq("student_id", id), 500); return { records: enrolments.map((x) => { const m = modules.filter((item) => String(item.course_id) === String(x.course_id)).map((item) => String(item.id)); const lessonIds = lessons.filter((l) => m.includes(String(l.module_id))).map((l) => String(l.id)); const done = lessonIds.filter((lessonId) => progress.some((p) => String(p.lesson_id) === lessonId && p.completed_at)).length; return { title: courses.find((c) => String(c.id) === String(x.course_id))?.title ?? "Course", detail: `${text(x.status)} · ${done}/${lessonIds.length} lessons complete`, meta: x.expires_at ? `Expires ${date(x.expires_at)}` : "No expiry recorded" }; }) }; }
    if (section === "certificates") { const items = await list(client, "certificates", "certificate_code,course_id,file_path,score,issued_at", (q) => q.eq("student_id", id).is("revoked_at", null).order("issued_at", { ascending: false }), 100); const courses = await inList(client, "courses", "id,title", "id", items.map((x) => String(x.course_id))); return { records: items.map((x) => ({ title: text(x.certificate_code), detail: courses.find((c) => String(c.id) === String(x.course_id))?.title ?? "Course certificate", meta: `Issued ${date(x.issued_at)}${x.score != null ? ` · score ${x.score}` : ""}${x.file_path ? " · certificate file has no configured download endpoint" : ""}` })) }; }
    if (section === "library") { const items = await list(client, "entitlements", "product_id,status,ends_at", (q) => q.eq("profile_id", id).eq("status", "active"), 100); const products = await inList(client, "products", "id,title", "id", items.map((x) => String(x.product_id)).filter(Boolean)); return { records: items.map((x) => ({ title: products.find((p) => String(p.id) === String(x.product_id))?.title ?? "Project", detail: text(x.status), meta: x.ends_at ? `Access until ${date(x.ends_at)}` : "No expiry recorded" })), note: "Project file downloads are not configured; no direct storage links are shown." }; }
    if (section === "payments") { const [receipts, payments] = await Promise.all([list(client, "receipts", "receipt_number,file_path,issued_at", (q) => q.eq("owner_id", id).order("issued_at", { ascending: false }), 50), list(client, "payments", "amount_kes,status,purpose,paid_at,created_at", (q) => q.eq("payer_id", id).order("created_at", { ascending: false }), 50)]); return { records: [...payments.map((x) => ({ title: `${text(x.purpose)} payment`, detail: `${kes(x.amount_kes)} · ${text(x.status)}`, meta: date(x.paid_at ?? x.created_at) })), ...receipts.map((x) => ({ title: `Receipt ${text(x.receipt_number)}`, detail: date(x.issued_at), meta: x.file_path ? "Receipt file exists; download endpoint not configured" : "No receipt file attached" }))] }; }
    if (section === "profile") return { records: [{ title: text(profile.full_name), detail: "Guest learner account", meta: "Profile editing is not configured on this page" }] };
  }
  return empty;
}
