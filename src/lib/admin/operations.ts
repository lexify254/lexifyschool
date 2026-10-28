import "server-only";
import { requireAdmin } from "@/lib/auth/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export class AdminOperationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminOperationError";
    this.status = status;
  }
}

type JsonObject = Record<string, unknown>;
type CourseInput = {
  code: string;
  title: string;
  description: string | null;
  icon_name: string;
  accent_color: string;
  level: string | null;
  duration_minutes: number | null;
};
type ModuleInput = { title: string; description: string | null; sort_order: number };
type LessonInput = {
  title: string;
  lesson_type: "video" | "text" | "document" | "practice_file" | "quiz" | "assignment";
  content: JsonObject;
  sort_order: number;
  estimated_minutes: number | null;
  is_free_preview: boolean;
  is_published: boolean;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const lessonTypes = new Set(["video", "text", "document", "practice_file", "quiz", "assignment"]);
const courseStatuses = new Set(["draft", "published", "archived"]);

function record(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function stringField(value: unknown, label: string, max: number, required = false): string | null {
  if (value === null || value === undefined) {
    if (required) throw new AdminOperationError(`${label} is required.`);
    return null;
  }
  if (typeof value !== "string") throw new AdminOperationError(`${label} must be text.`);
  const result = value.trim();
  if (result.length > max) throw new AdminOperationError(`${label} must be ${max} characters or fewer.`);
  if (required && !result) throw new AdminOperationError(`${label} is required.`);
  return result || null;
}
function integerField(value: unknown, label: string, min: number, max: number, optional = false): number | null {
  if (value === null || value === undefined || value === "") {
    if (optional) return null;
    throw new AdminOperationError(`${label} is required.`);
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new AdminOperationError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}
function boolField(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new AdminOperationError(`${label} must be true or false.`);
  return value;
}
export function isAdminUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}
export function parseCourseInput(value: unknown): CourseInput {
  if (!record(value)) throw new AdminOperationError("Course details must be an object.");
  const code = stringField(value.code, "Course code", 60, true)!.toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,59}$/.test(code)) {
    throw new AdminOperationError("Course code must be 2–60 letters, numbers, underscores, or hyphens.");
  }
  const title = stringField(value.title, "Title", 160, true)!;
  const description = stringField(value.description, "Description", 5000);
  const iconName = stringField(value.icon_name ?? "FileText", "Icon name", 40, true)!;
  if (!/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(iconName)) throw new AdminOperationError("Icon name must start with a letter and contain only letters or numbers.");
  const accentColor = stringField(value.accent_color ?? "#2563EB", "Accent color", 7, true)!;
  if (!/^#[0-9a-fA-F]{6}$/.test(accentColor)) throw new AdminOperationError("Accent color must be a six-digit hex value.");
  const level = stringField(value.level, "Level", 40);
  const duration = integerField(value.duration_minutes, "Duration", 1, 10080, true);
  return { code, title, description, icon_name: iconName, accent_color: accentColor, level, duration_minutes: duration };
}
export function parseModuleInput(value: unknown): ModuleInput {
  if (!record(value)) throw new AdminOperationError("Module details must be an object.");
  return {
    title: stringField(value.title, "Title", 160, true)!,
    description: stringField(value.description, "Description", 5000),
    sort_order: integerField(value.sort_order ?? 0, "Position", 0, 100000)!,
  };
}
export function parseLessonInput(value: unknown): LessonInput {
  if (!record(value)) throw new AdminOperationError("Lesson details must be an object.");
  const lessonType = value.lesson_type;
  if (typeof lessonType !== "string" || !lessonTypes.has(lessonType)) throw new AdminOperationError("Choose a supported lesson type.");
  const content = value.content ?? {};
  if (!record(content)) throw new AdminOperationError("Lesson content must be a JSON object.");
  let encoded: string;
  try {
    encoded = JSON.stringify(content);
  } catch {
    throw new AdminOperationError("Lesson content must be valid JSON.");
  }
  if (encoded.length > 1000000) throw new AdminOperationError("Lesson content must be no larger than 1 MB.");
  return {
    title: stringField(value.title, "Title", 160, true)!,
    lesson_type: lessonType as LessonInput["lesson_type"],
    content,
    sort_order: integerField(value.sort_order ?? 0, "Position", 0, 100000)!,
    estimated_minutes: integerField(value.estimated_minutes, "Estimated minutes", 1, 10080, true),
    is_free_preview: value.is_free_preview === undefined ? false : boolField(value.is_free_preview, "Free preview"),
    is_published: value.is_published === undefined ? false : boolField(value.is_published, "Published status"),
  };
}
async function client() {
  await requireAdmin();
  const supabase = await getSupabaseServerClient();
  if (!supabase) throw new AdminOperationError("Database connection is not configured.", 503);
  return supabase;
}
function dbFailure(label: string, error: { code?: string } | null): never {
  if (error?.code === "23505") throw new AdminOperationError(`${label} conflicts with an existing record.`, 409);
  if (error?.code === "23503") throw new AdminOperationError(`${label} is still referenced by other records.`, 409);
  if (error?.code === "23514") throw new AdminOperationError(`${label} violates a database constraint.`, 400);
  throw new AdminOperationError(`${label} could not be completed. Check administrator database access and try again.`, 500);
}

export async function listAdminUsers() {
  const supabase = await client();
  const { data, error } = await supabase.from("profiles").select("id,full_name,email,role,is_suspended,created_at").order("created_at", { ascending: false }).limit(100);
  if (error) dbFailure("User list", error);
  return data ?? [];
}
export async function setUserSuspension(id: string, suspended: boolean) {
  const admin = await requireAdmin();
  if (!isAdminUuid(id)) throw new AdminOperationError("That user record could not be identified.");
  if (typeof suspended !== "boolean") throw new AdminOperationError("Suspension status must be true or false.");
  if (id === admin.id) throw new AdminOperationError("You cannot suspend your own administrator account.", 409);
  const supabase = await getSupabaseServerClient();
  if (!supabase) throw new AdminOperationError("Database connection is not configured.", 503);
  const { data: target, error: targetError } = await supabase.from("profiles").select("id,role").eq("id", id).maybeSingle();
  if (targetError) dbFailure("User status", targetError);
  if (!target) throw new AdminOperationError("User was not found.", 404);
  if (target.role === "admin") throw new AdminOperationError("Administrator accounts cannot be suspended here.", 409);
  const { data, error } = await supabase.from("profiles").update({ is_suspended: suspended }).eq("id", id).eq("role", target.role).select("id,is_suspended").maybeSingle();
  if (error) dbFailure("User status update", error);
  if (!data) throw new AdminOperationError("User status was not changed. Reload and try again.", 409);
  return data;
}

export async function listAdminCourses() {
  const supabase = await client();
  const { data: courses, error } = await supabase.from("courses").select("id,code,title,description,icon_name,accent_color,level,duration_minutes,status,created_at,updated_at,published_at").order("updated_at", { ascending: false }).limit(100);
  if (error) dbFailure("Course list", error);
  const courseRows = courses ?? [];
  const ids = courseRows.map((course) => course.id);
  if (!ids.length) return [];
  const { data: modules, error: modulesError } = await supabase.from("course_modules").select("id,course_id,title,description,sort_order,release_at").in("course_id", ids).order("sort_order").limit(300);
  if (modulesError) dbFailure("Module list", modulesError);
  const moduleRows = modules ?? [];
  const moduleIds = moduleRows.map((module) => module.id);
  const { data: lessons, error: lessonsError } = moduleIds.length
    ? await supabase.from("course_lessons").select("id,module_id,title,lesson_type,sort_order,estimated_minutes,is_free_preview,release_at,is_published").in("module_id", moduleIds).order("sort_order").limit(600)
    : { data: [], error: null };
  if (lessonsError) dbFailure("Lesson list", lessonsError);
  return courseRows.map((course) => ({
    ...course,
    modules: moduleRows.filter((module) => module.course_id === course.id).map((module) => ({
      ...module,
      lessons: (lessons ?? []).filter((lesson) => lesson.module_id === module.id),
    })),
  }));
}
export async function getAdminLesson(id: string) {
  const supabase = await client();
  if (!isAdminUuid(id)) throw new AdminOperationError("That lesson record could not be identified.");
  const { data, error } = await supabase.from("course_lessons").select("id,module_id,title,lesson_type,content,sort_order,estimated_minutes,is_free_preview,is_published").eq("id", id).maybeSingle();
  if (error) dbFailure("Lesson content", error);
  if (!data) throw new AdminOperationError("Lesson was not found.", 404);
  return data;
}
export async function createAdminCourse(input: unknown) {
  const supabase = await client();
  const course = parseCourseInput(input);
  const { data, error } = await supabase.from("courses").insert({ ...course, status: "draft" }).select("id,code,title,status").single();
  if (error) dbFailure("Course creation", error);
  return data;
}
export async function updateAdminCourse(id: string, input: unknown) {
  const supabase = await client();
  if (!isAdminUuid(id)) throw new AdminOperationError("That course record could not be identified.");
  const course = parseCourseInput(input);
  const { data, error } = await supabase.from("courses").update({ ...course, updated_at: new Date().toISOString() }).eq("id", id).select("id,code,title,status").maybeSingle();
  if (error) dbFailure("Course update", error);
  if (!data) throw new AdminOperationError("Course was not found.", 404);
  return data;
}
async function coursePublishable(supabase: Awaited<ReturnType<typeof client>>, id: string) {
  const { data: modules, error } = await supabase.from("course_modules").select("id").eq("course_id", id).limit(300);
  if (error) dbFailure("Course publication check", error);
  const moduleIds = (modules ?? []).map((module) => module.id);
  if (!moduleIds.length) return false;
  const { data: lessons, error: lessonError } = await supabase.from("course_lessons").select("id").in("module_id", moduleIds).eq("is_published", true).limit(1);
  if (lessonError) dbFailure("Course publication check", lessonError);
  return (lessons ?? []).length > 0;
}
export async function setAdminCourseStatus(id: string, status: unknown) {
  const supabase = await client();
  if (!isAdminUuid(id)) throw new AdminOperationError("That course record could not be identified.");
  if (typeof status !== "string" || !courseStatuses.has(status)) throw new AdminOperationError("Choose draft, published, or archived.");
  if (status === "published" && !(await coursePublishable(supabase, id))) {
    throw new AdminOperationError("To publish, add at least one module and one published lesson first.", 409);
  }
  const update = { status, updated_at: new Date().toISOString(), ...(status === "published" ? { published_at: new Date().toISOString() } : {}) };
  const { data, error } = await supabase.from("courses").update(update).eq("id", id).select("id,status,published_at").maybeSingle();
  if (error) dbFailure("Course status update", error);
  if (!data) throw new AdminOperationError("Course was not found.", 404);
  return data;
}
export async function deleteEmptyDraftCourse(id: string) {
  await client();
  if (!isAdminUuid(id)) throw new AdminOperationError("That course record could not be identified.");
  throw new AdminOperationError("Course deletion is disabled to preserve linked catalogue and learner records. Archive the course instead.", 409);
}

export async function createAdminModule(courseId: string, input: unknown) {
  const supabase = await client();
  if (!isAdminUuid(courseId)) throw new AdminOperationError("That course record could not be identified.");
  const module = parseModuleInput(input);
  const { data, error } = await supabase.from("course_modules").insert({ ...module, course_id: courseId }).select("id,course_id,title,description,sort_order").single();
  if (error) dbFailure("Module creation", error);
  return data;
}
export async function updateAdminModule(id: string, input: unknown) {
  const supabase = await client();
  if (!isAdminUuid(id)) throw new AdminOperationError("That module record could not be identified.");
  const module = parseModuleInput(input);
  const { data, error } = await supabase.from("course_modules").update(module).eq("id", id).select("id,course_id,title,description,sort_order").maybeSingle();
  if (error) dbFailure("Module update", error);
  if (!data) throw new AdminOperationError("Module was not found.", 404);
  return data;
}
export async function deleteEmptyAdminModule(id: string) {
  const supabase = await client();
  if (!isAdminUuid(id)) throw new AdminOperationError("That module record could not be identified.");
  const { data: lessons, error: lessonError } = await supabase.from("course_lessons").select("id").eq("module_id", id).limit(1);
  if (lessonError) dbFailure("Module delete", lessonError);
  if ((lessons ?? []).length) throw new AdminOperationError("This module contains lessons; remove lesson content separately first.", 409);
  const { data, error } = await supabase.from("course_modules").delete().eq("id", id).select("id").maybeSingle();
  if (error) dbFailure("Module delete", error);
  if (!data) throw new AdminOperationError("Module was not found or could not be deleted.", 404);
  return { deleted: true };
}
export async function createAdminLesson(moduleId: string, input: unknown) {
  const supabase = await client();
  if (!isAdminUuid(moduleId)) throw new AdminOperationError("That module record could not be identified.");
  const lesson = parseLessonInput(input);
  if (lesson.is_published && lesson.lesson_type === "quiz") throw new AdminOperationError("Create quiz lessons as drafts first; configure quiz content before publication.", 409);
  if (lesson.is_published && Object.keys(lesson.content).length === 0) throw new AdminOperationError("Add lesson content before publishing this lesson.", 409);
  const { data, error } = await supabase.from("course_lessons").insert({ ...lesson, module_id: moduleId }).select("id,module_id,title,lesson_type,sort_order,is_published").single();
  if (error) dbFailure("Lesson creation", error);
  return data;
}
export async function updateAdminLesson(id: string, input: unknown) {
  const supabase = await client();
  if (!isAdminUuid(id)) throw new AdminOperationError("That lesson record could not be identified.");
  const lesson = parseLessonInput(input);
  if (lesson.is_published && lesson.lesson_type === "quiz") {
    const { data: quizzes, error: quizError } = await supabase.from("course_quizzes").select("id,questions").eq("lesson_id", id).limit(1);
    if (quizError) dbFailure("Lesson publication check", quizError);
    const questions = quizzes?.[0]?.questions;
    if (!Array.isArray(questions) || questions.length === 0) throw new AdminOperationError("Add at least one quiz question before publishing this lesson.", 409);
  } else if (lesson.is_published && Object.keys(lesson.content).length === 0) {
    throw new AdminOperationError("Add lesson content before publishing this lesson.", 409);
  }
  const { data, error } = await supabase.from("course_lessons").update(lesson).eq("id", id).select("id,module_id,title,lesson_type,sort_order,is_published").maybeSingle();
  if (error) dbFailure("Lesson update", error);
  if (!data) throw new AdminOperationError("Lesson was not found.", 404);
  return data;
}
export async function deleteUnpublishedAdminLesson(id: string) {
  const supabase = await client();
  if (!isAdminUuid(id)) throw new AdminOperationError("That lesson record could not be identified.");
  const { data: lesson, error: lessonError } = await supabase.from("course_lessons").select("id,is_published").eq("id", id).maybeSingle();
  if (lessonError) dbFailure("Lesson delete", lessonError);
  if (!lesson) throw new AdminOperationError("Lesson was not found.", 404);
  if (lesson.is_published) throw new AdminOperationError("Unpublish this lesson before deleting it.", 409);
  const dependencies = await Promise.all([
    supabase.from("lesson_progress").select("id").eq("lesson_id", id).limit(1),
    supabase.from("course_quizzes").select("id").eq("lesson_id", id).limit(1),
    supabase.from("assignments").select("id").eq("lesson_id", id).limit(1),
    supabase.from("course_lesson_questions").select("id").eq("lesson_id", id).limit(1),
    supabase.from("lesson_resources").select("id").eq("lesson_id", id).limit(1),
  ]);
  const dependencyError = dependencies.find(({ error }) => error)?.error;
  if (dependencyError) dbFailure("Lesson dependency check", dependencyError);
  if (dependencies.some(({ data }) => (data ?? []).length > 0)) {
    throw new AdminOperationError("This lesson has learner activity or linked resources. Keep it as an unpublished lesson instead of deleting it.", 409);
  }
  const { data, error } = await supabase.from("course_lessons").delete().eq("id", id).eq("is_published", false).select("id").maybeSingle();
  if (error) dbFailure("Lesson delete", error);
  if (!data) throw new AdminOperationError("Lesson was not deleted. It may still be referenced by activity.", 409);
  return { deleted: true };
}
