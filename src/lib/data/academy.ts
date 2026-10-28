import { getSupabaseServerClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

type ReadResult<T> = { data: T; error: false } | { data: null; error: true };

export type AcademyFilters = { q?: string; level?: string };
export type AcademyCourse = Row & { preview_count: number };
export type AcademyCourseDetail = {
  course: Row;
  modules: Row[];
  lessons: Row[];
  price: Row | null;
  seller: Row | null;
};
export type AcademyLessonDetail = {
  course: Row;
  module: Row;
  lesson: Row;
  modules: Row[];
  lessons: Row[];
};

function readFailed(context: string, error: { code?: string } | null) {
  if (error)
    console.error(
      `[Lexify] ${context} read failed (${error.code ?? "query"}).`
    );
}

function cleanSearch(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .slice(0, 80);
}

function isReleased(row: Row): boolean {
  if (!row.release_at) return true;
  const timestamp = Date.parse(String(row.release_at));
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function currentPrice(rows: Row[]): Row | null {
  const now = Date.now();
  const active = rows.filter(row => {
    const starts = row.starts_at ? Date.parse(String(row.starts_at)) : NaN;
    const ends = row.ends_at ? Date.parse(String(row.ends_at)) : NaN;
    return (
      (!Number.isFinite(starts) || starts <= now) &&
      (!Number.isFinite(ends) || ends > now)
    );
  });
  return active[0] ?? null;
}

async function publishedLessonsForModules(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  moduleIds: string[],
  freePreviewOnly = true
) {
  if (!moduleIds.length) return { data: [] as Row[], error: null };
  const now = new Date().toISOString();
  let query = supabase
    .from("course_lessons")
    .select(
      "id,module_id,title,lesson_type,sort_order,estimated_minutes,is_free_preview,release_at,content"
    )
    .in("module_id", moduleIds)
    .eq("is_published", true)
    .or(`release_at.is.null,release_at.lte.${now}`)
    .order("sort_order", { ascending: true })
    .limit(500);
  if (freePreviewOnly) query = query.eq("is_free_preview", true);
  return query;
}

export async function listPublishedAcademyCourses(
  filters: AcademyFilters = {}
): Promise<ReadResult<AcademyCourse[]>> {
  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase) return { data: null, error: true };
    let query = supabase
      .from("courses")
      .select(
        "id,code,title,description,icon_name,accent_color,level,duration_minutes,is_free,instructor_id,published_at"
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(60);
    const q = filters.q ? cleanSearch(filters.q) : "";
    if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    if (filters.level) query = query.eq("level", filters.level);
    const { data: courses, error } = await query;
    readFailed("academy catalogue", error);
    if (error) return { data: null, error: true };

    const courseRows = (courses ?? []) as Row[];
    const courseIds = courseRows.map(course => String(course.id));
    if (!courseIds.length) return { data: [], error: false };
    const { data: modules, error: moduleError } = await supabase
      .from("course_modules")
      .select("id,course_id,release_at")
      .in("course_id", courseIds)
      .limit(500);
    readFailed("academy catalogue modules", moduleError);
    if (moduleError) return { data: null, error: true };
    const releasedModules = ((modules ?? []) as Row[]).filter(isReleased);
    const moduleIds = releasedModules.map(module => String(module.id));
    const { data: lessons, error: lessonError } =
      await publishedLessonsForModules(supabase, moduleIds);
    readFailed("academy catalogue previews", lessonError);
    if (lessonError) return { data: null, error: true };
    const moduleCourse = new Map(
      releasedModules.map(module => [
        String(module.id),
        String(module.course_id),
      ])
    );
    const previewCounts = new Map<string, number>();
    for (const lesson of (lessons ?? []) as Row[]) {
      const courseId = moduleCourse.get(String(lesson.module_id));
      if (courseId)
        previewCounts.set(courseId, (previewCounts.get(courseId) ?? 0) + 1);
    }
    return {
      data: courseRows.map(course => ({
        ...course,
        preview_count: previewCounts.get(String(course.id)) ?? 0,
      })) as AcademyCourse[],
      error: false,
    };
  } catch {
    return { data: null, error: true };
  }
}

export async function getPublishedAcademyCourse(
  code: string
): Promise<ReadResult<AcademyCourseDetail | null>> {
  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase) return { data: null, error: true };
    const { data: course, error } = await supabase
      .from("courses")
      .select(
        "id,code,title,description,icon_name,accent_color,level,duration_minutes,is_free,instructor_id,published_at"
      )
      .eq("code", code.toUpperCase())
      .eq("status", "published")
      .maybeSingle();
    readFailed("academy course", error);
    if (error) return { data: null, error: true };
    if (!course) return { data: null, error: false };

    const now = new Date().toISOString();
    const [moduleResult, priceResult] = await Promise.all([
      supabase
        .from("course_modules")
        .select("id,title,description,sort_order,release_at")
        .eq("course_id", course.id)
        .or(`release_at.is.null,release_at.lte.${now}`)
        .order("sort_order", { ascending: true })
        .limit(80),
      supabase
        .from("course_prices")
        .select(
          "price_kes,sale_price_kes,starts_at,ends_at,access_days,created_at"
        )
        .eq("course_id", course.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    readFailed("academy modules", moduleResult.error);
    readFailed("academy prices", priceResult.error);
    if (moduleResult.error || priceResult.error)
      return { data: null, error: true };
    const modules = (moduleResult.data ?? []) as Row[];
    const { data: lessons, error: lessonError } =
      await publishedLessonsForModules(
        supabase,
        modules.map(module => String(module.id)),
        false
      );
    readFailed("academy published lessons", lessonError);
    if (lessonError) return { data: null, error: true };

    let seller: Row | null = null;
    if (course.instructor_id) {
      const { data, error: sellerError } = await supabase
        .from("teacher_details")
        .select("profile_id,public_name,public_whatsapp")
        .eq("profile_id", course.instructor_id)
        .maybeSingle();
      readFailed("academy instructor contact", sellerError);
      if (!sellerError) seller = data as Row | null;
    }
    return {
      data: {
        course: course as Row,
        modules,
        lessons: (lessons ?? []) as Row[],
        price: currentPrice((priceResult.data ?? []) as Row[]),
        seller,
      },
      error: false,
    };
  } catch {
    return { data: null, error: true };
  }
}

export async function getAvailablePublishedLesson(
  code: string,
  lessonId: string
): Promise<ReadResult<AcademyLessonDetail | null>> {
  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase) return { data: null, error: true };
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id,code,title,is_free")
      .eq("code", code.toUpperCase())
      .eq("status", "published")
      .maybeSingle();
    readFailed("academy preview course", courseError);
    if (courseError) return { data: null, error: true };
    if (!course) return { data: null, error: false };

    const { data: modules, error: modulesError } = await supabase
      .from("course_modules")
      .select("id,title,description,sort_order,release_at")
      .eq("course_id", course.id)
      .or(`release_at.is.null,release_at.lte.${new Date().toISOString()}`)
      .order("sort_order", { ascending: true })
      .limit(80);
    readFailed("academy preview modules", modulesError);
    if (modulesError) return { data: null, error: true };
    const moduleRows = (modules ?? []) as Row[];
    const moduleIds = moduleRows.map(row => String(row.id));
    if (!moduleIds.length) return { data: null, error: false };
    const { data: lesson, error: lessonError } = await supabase
      .from("course_lessons")
      .select(
        "id,module_id,title,lesson_type,sort_order,estimated_minutes,is_free_preview,is_published,release_at,content"
      )
      .eq("id", lessonId)
      .in("module_id", moduleIds)
      .eq("is_published", true)
      .or(`release_at.is.null,release_at.lte.${new Date().toISOString()}`)
      .maybeSingle();
    readFailed("academy published lesson", lessonError);
    if (lessonError) return { data: null, error: true };
    if (!lesson) return { data: null, error: false };
    const selectedModule = moduleRows.find(
      row => String(row.id) === String(lesson.module_id)
    );
    if (!selectedModule) return { data: null, error: false };
    const { data: allLessons, error: allLessonsError } =
      await publishedLessonsForModules(supabase, moduleIds, false);
    readFailed("academy lesson navigation", allLessonsError);
    if (allLessonsError) return { data: null, error: true };
    const lessons = (allLessons ?? []) as Row[];
    return {
      data: {
        course: course as Row,
        module: selectedModule,
        lesson: lesson as Row,
        modules: moduleRows,
        lessons,
      },
      error: false,
    };
  } catch {
    return { data: null, error: true };
  }
}
