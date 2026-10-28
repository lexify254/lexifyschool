import { getSupabaseServerClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

export type TeacherFilters = {
  q?: string;
  subjectId?: string;
  gradeId?: string;
  verified?: boolean;
  maxPrice?: number;
  pricingBasis?: string;
};

function cleanSearch(value: string): string {
  return value.replace(/[%,()]/g, " ").trim().slice(0, 80);
}

function reportReadError(context: string, error: { code?: string; message?: string } | null) {
  if (error) console.error(`[Lexify] ${context} read failed (${error.code ?? "query"}).`);
}

export async function listTeachers(filters: TeacherFilters = {}): Promise<Row[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let eligibleTeacherIds: string[] | null = null;
  if (filters.subjectId || filters.gradeId || filters.maxPrice || filters.pricingBasis) {
    let classQuery = supabase
      .from("public_class_listings")
      .select("teacher_id,grade_id,learning_area_id,price_kes,pricing_basis")
      .eq("is_published", true)
      .eq("is_active", true)
      .limit(500);
    if (filters.gradeId) classQuery = classQuery.eq("grade_id", filters.gradeId);
    if (filters.subjectId) classQuery = classQuery.eq("learning_area_id", filters.subjectId);
    if (filters.maxPrice) classQuery = classQuery.lte("price_kes", filters.maxPrice);
    if (filters.pricingBasis) classQuery = classQuery.eq("pricing_basis", filters.pricingBasis);
    const { data: classes, error: classError } = await classQuery;
    reportReadError("class filter", classError);
    eligibleTeacherIds = [...new Set((classes ?? []).map((row) => row.teacher_id as string).filter(Boolean))];
    if (eligibleTeacherIds.length === 0) return [];
  }

  let query = supabase
    .from("teacher_details")
    .select("profile_id,public_name,public_avatar_url,bio,experience_years,qualifications,verification_status,is_accepting_students")
    .eq("is_accepting_students", true)
    .order("public_name", { ascending: true })
    .limit(48);
  if (filters.q) query = query.ilike("public_name", `%${cleanSearch(filters.q)}%`);
  if (filters.verified) query = query.eq("verification_status", "verified");
  if (eligibleTeacherIds) query = query.in("profile_id", eligibleTeacherIds);
  const { data, error } = await query;
  reportReadError("teacher catalogue", error);
  return (data ?? []) as Row[];
}

export async function getTeacherProfile(id: string): Promise<{ teacher: Row; subjects: Row[]; classes: Row[] } | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const { data: teacher, error } = await supabase
    .from("teacher_details")
    .select("profile_id,public_name,public_avatar_url,public_whatsapp,bio,experience_years,qualifications,verification_status,is_accepting_students")
    .eq("profile_id", id)
    .eq("is_accepting_students", true)
    .maybeSingle();
  reportReadError("teacher profile", error);
  if (!teacher) return null;

  const { data: teacherSubjects, error: subjectError } = await supabase
    .from("teacher_subjects")
    .select("learning_area_id,grade_id")
    .eq("teacher_id", id)
    .limit(100);
  reportReadError("teacher subjects", subjectError);
  const subjectIds = [...new Set((teacherSubjects ?? []).map((row) => row.learning_area_id as string).filter(Boolean))];
  const gradeIds = [...new Set((teacherSubjects ?? []).map((row) => row.grade_id as string).filter(Boolean))];
  const [areasResult, gradesResult, classesResult] = await Promise.all([
    subjectIds.length ? supabase.from("learning_areas").select("id,title,description,icon_name,accent_color,illustration_url").in("id", subjectIds) : Promise.resolve({ data: [], error: null }),
    gradeIds.length ? supabase.from("grades").select("id,name,code").in("id", gradeIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("public_class_listings").select("id,title,description,grade_id,learning_area_id,pricing_basis,price_kes,lessons_in_bundle,capacity").eq("teacher_id", id).eq("is_published", true).eq("is_active", true).limit(40),
  ]);
  reportReadError("teacher learning areas", areasResult.error);
  reportReadError("teacher grades", gradesResult.error);
  reportReadError("teacher classes", classesResult.error);

  const areas = new Map((areasResult.data ?? []).map((row) => [row.id as string, row]));
  const grades = new Map((gradesResult.data ?? []).map((row) => [row.id as string, row]));
  const subjects = (teacherSubjects ?? []).map((row) => ({
    ...areas.get(row.learning_area_id as string),
    grade: grades.get(row.grade_id as string),
  })).filter((row) => row.title);
  const classes = (classesResult.data ?? []).map((row) => ({
    ...row,
    grade: grades.get(row.grade_id as string),
    area: areas.get(row.learning_area_id as string),
  })) as Row[];
  return { teacher: teacher as Row, subjects: subjects as Row[], classes };
}

export async function listPublishedCourses(): Promise<Row[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("courses")
    .select("id,code,title,description,icon_name,accent_color,level,duration_minutes,is_free,published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(60);
  reportReadError("academy catalogue", error);
  return (data ?? []) as Row[];
}

export async function getPublishedCourse(code: string): Promise<{ course: Row; modules: Row[]; lessons: Row[] } | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const { data: course, error } = await supabase
    .from("courses")
    .select("id,code,title,description,icon_name,accent_color,level,duration_minutes,is_free,published_at")
    .eq("code", code.toUpperCase())
    .eq("status", "published")
    .maybeSingle();
  reportReadError("academy course", error);
  if (!course) return null;
  const { data: modules, error: moduleError } = await supabase
    .from("course_modules")
    .select("id,title,description,sort_order,release_at")
    .eq("course_id", course.id)
    .order("sort_order", { ascending: true })
    .limit(80);
  reportReadError("academy modules", moduleError);
  const moduleIds = (modules ?? []).map((row) => row.id as string);
  let lessons: Row[] = [];
  if (moduleIds.length) {
    const { data, error: lessonError } = await supabase
      .from("course_lessons")
      .select("id,module_id,title,lesson_type,sort_order,estimated_minutes,is_free_preview")
      .in("module_id", moduleIds)
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .limit(200);
    reportReadError("academy lessons", lessonError);
    lessons = (data ?? []) as Row[];
  }
  const { data: price, error: priceError } = await supabase
    .from("course_prices")
    .select("price_kes,sale_price_kes,starts_at,ends_at,access_days")
    .eq("course_id", course.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  reportReadError("academy price", priceError);
  return { course: { ...course, price }, modules: (modules ?? []) as Row[], lessons };
}

export type ProductFilters = { q?: string; software?: string; difficulty?: string; maxPrice?: number; freeOnly?: boolean };

export async function listPublishedProducts(filters: ProductFilters = {}): Promise<Row[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];
  let query = supabase
    .from("products")
    .select("id,code,title,short_description,description,software_name,software_version,file_types,difficulty,price_kes,sale_price_kes,is_free,licence_type,cover_image_url,preview_url,featured")
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);
  if (filters.q) query = query.ilike("title", `%${cleanSearch(filters.q)}%`);
  if (filters.software) query = query.ilike("software_name", `%${cleanSearch(filters.software)}%`);
  if (filters.difficulty) query = query.ilike("difficulty", cleanSearch(filters.difficulty));
  if (filters.maxPrice) query = query.lte("price_kes", filters.maxPrice);
  if (filters.freeOnly) query = query.eq("is_free", true);
  const { data, error } = await query;
  reportReadError("project catalogue", error);
  return (data ?? []) as Row[];
}

export async function getPublishedProduct(code: string): Promise<Row | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("products")
    .select("id,code,title,short_description,description,software_name,software_version,file_types,difficulty,price_kes,sale_price_kes,sale_starts_at,sale_ends_at,is_free,licence_type,download_limit,access_days,cover_image_url,preview_url,featured")
    .eq("code", code.toUpperCase())
    .eq("status", "published")
    .maybeSingle();
  reportReadError("project details", error);
  return (data as Row | null) ?? null;
}

export async function getPublicCurriculum() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { systems: [], grades: [], areas: [] };
  const [systemsResult, gradesResult, areasResult] = await Promise.all([
    supabase.from("education_systems").select("id,code,name,is_active,starts_on,ends_on").eq("is_active", true).order("name"),
    supabase.from("grades").select("id,system_id,code,name,level_order,is_active,starts_on,ends_on").eq("is_active", true).order("level_order"),
    supabase.from("learning_areas").select("id,system_id,code,title,description,icon_name,accent_color,illustration_url,is_core,is_examinable,is_optional_activity,restriction_code,pathway_id,track_id,group_id,parent_area_id,sort_order").eq("is_active", true).order("sort_order"),
  ]);
  reportReadError("education systems", systemsResult.error);
  reportReadError("grades", gradesResult.error);
  reportReadError("learning areas", areasResult.error);
  return { systems: systemsResult.data ?? [], grades: gradesResult.data ?? [], areas: areasResult.data ?? [] };
}
