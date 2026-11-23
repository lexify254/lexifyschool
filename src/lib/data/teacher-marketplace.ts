import { getSupabaseServerClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

export const TEACHER_SORTS = [
  "name",
  "newest",
  "price_asc",
  "price_desc",
] as const;
export type TeacherSort = (typeof TEACHER_SORTS)[number];
export type TeacherFilters = {
  q?: string;
  subjectId?: string;
  gradeId?: string;
  verified?: boolean;
  maxPrice?: number;
  pricingBasis?: "lesson_bundle" | "weekly" | "monthly";
  sort: TeacherSort;
};
export type TeacherFilterInput = {
  q?: string;
  subjectId?: string;
  gradeId?: string;
  verified?: boolean;
  maxPrice?: number;
  pricingBasis?: string;
  sort?: string;
};
export type PublicReadError = "unavailable" | "failed";
export type PublicReadResult<T> =
  | { data: T; error: null }
  | { data: null; error: PublicReadError };
export type PublicTeacher = {
  profile_id: string;
  public_name: string | null;
  public_avatar_url: string | null;
  public_whatsapp?: string | null;
  bio: string | null;
  experience_years: number | null;
  verification_status: string;
  starting_price_kes: number | null;
  pricing_basis: "lesson_bundle" | "weekly" | "monthly" | null;
  services: string[];
  created_at?: string;
};
export type PublicClass = {
  id: string;
  title: string;
  description: string | null;
  grade_name: string | null;
  area_title: string | null;
  price_kes: number;
  pricing_basis: "lesson_bundle" | "weekly" | "monthly";
  lessons_in_bundle: number | null;
};
export type PublicTeacherSubject = {
  id: string;
  title: string;
  description: string | null;
  icon_name: string | null;
  accent_color: string | null;
  illustration_url: string | null;
  grade_name: string | null;
};
export type PublicTeacherListing = PublicTeacher & {
  subjects: PublicTeacherSubject[];
};
export type TeacherProfile = {
  teacher: PublicTeacher;
  subjects: PublicTeacherSubject[];
  classes: PublicClass[];
};
export type TeacherFilterOptions = {
  systems: Row[];
  grades: Row[];
  areas: Row[];
};

const pricingBases = new Set(["lesson_bundle", "weekly", "monthly"]);
const validSorts = new Set<string>(TEACHER_SORTS);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isPublicTeacherId(value: string): boolean {
  return uuidPattern.test(value);
}
function cleanSearch(value: string | undefined): string | undefined {
  const cleaned = value
    ?.replace(/[%,()_*]/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || undefined;
}
export function normalizeTeacherFilters(
  input: TeacherFilterInput
): TeacherFilters {
  const maxPrice = input.maxPrice;
  return {
    q: cleanSearch(input.q),
    subjectId:
      input.subjectId && isPublicTeacherId(input.subjectId)
        ? input.subjectId
        : undefined,
    gradeId:
      input.gradeId && isPublicTeacherId(input.gradeId)
        ? input.gradeId
        : undefined,
    verified: input.verified === true,
    maxPrice:
      typeof maxPrice === "number" && Number.isFinite(maxPrice) && maxPrice > 0
        ? maxPrice
        : undefined,
    pricingBasis: pricingBases.has(input.pricingBasis ?? "")
      ? (input.pricingBasis as TeacherFilters["pricingBasis"])
      : undefined,
    sort: validSorts.has(input.sort ?? "")
      ? (input.sort as TeacherSort)
      : "name",
  };
}
function readFailed(context: string, error: { code?: string } | null) {
  if (error)
    console.error(
      `[Lexify] Teacher marketplace ${context} read failed (${error.code ?? "query"}).`
    );
}
function unavailable<T>(): PublicReadResult<T> {
  return { data: null, error: "unavailable" };
}
function failed<T>(): PublicReadResult<T> {
  return { data: null, error: "failed" };
}

export async function getTeacherFilterOptions(): Promise<
  PublicReadResult<TeacherFilterOptions>
> {
  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase) return unavailable();
    const [systemsResult, gradesResult, areasResult] = await Promise.all([
      supabase
        .from("education_systems")
        .select("id,name")
        .eq("is_active", true)
        .order("name")
        .limit(30),
      supabase
        .from("grades")
        .select("id,system_id,name,level_order")
        .eq("is_active", true)
        .order("level_order")
        .limit(100),
      supabase
        .from("learning_areas")
        .select("id,title")
        .eq("is_active", true)
        .order("sort_order")
        .limit(200),
    ]);
    readFailed("filter systems", systemsResult.error);
    readFailed("filter grades", gradesResult.error);
    readFailed("filter areas", areasResult.error);
    if (systemsResult.error || gradesResult.error || areasResult.error)
      return failed();
    return {
      data: {
        systems: (systemsResult.data ?? []) as Row[],
        grades: (gradesResult.data ?? []) as Row[],
        areas: (areasResult.data ?? []) as Row[],
      },
      error: null,
    };
  } catch {
    return failed();
  }
}

async function getPublishedClassRows(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  filters?: TeacherFilters,
  teacherId?: string
) {
  let query = supabase
    .from("public_class_listings")
    .select(
      "id,teacher_id,grade_id,learning_area_id,title,description,pricing_basis,price_kes,lessons_in_bundle,is_published,is_active,created_at"
    )
    .eq("is_published", true)
    .eq("is_active", true)
    .limit(1000);
  if (teacherId) query = query.eq("teacher_id", teacherId);
  if (filters?.subjectId)
    query = query.eq("learning_area_id", filters.subjectId);
  if (filters?.gradeId) query = query.eq("grade_id", filters.gradeId);
  if (filters?.maxPrice) query = query.lte("price_kes", filters.maxPrice);
  if (filters?.pricingBasis)
    query = query.eq("pricing_basis", filters.pricingBasis);
  if (teacherId) query = query.order("created_at", { ascending: false });
  return query;
}

async function subjectsForTeachers(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  teacherIds: string[]
): Promise<PublicReadResult<Map<string, PublicTeacherSubject[]>>> {
  if (!teacherIds.length) return { data: new Map(), error: null };
  const { data: pairs, error: pairsError } = await supabase
    .from("teacher_subjects")
    .select("teacher_id,grade_id,learning_area_id")
    .in("teacher_id", teacherIds)
    .order("teacher_id", { ascending: true })
    .order("grade_id", { ascending: true })
    .order("learning_area_id", { ascending: true })
    .limit(1000);
  readFailed("signup teaching subjects", pairsError);
  if (pairsError) return failed();
  const rows = (pairs ?? []) as Row[];
  const gradeIds = [
    ...new Set(
      rows.map(row => String(row.grade_id ?? "")).filter(isPublicTeacherId)
    ),
  ];
  const areaIds = [
    ...new Set(
      rows
        .map(row => String(row.learning_area_id ?? ""))
        .filter(isPublicTeacherId)
    ),
  ];
  const [gradesResult, areasResult] = await Promise.all([
    gradeIds.length
      ? supabase
          .from("grades")
          .select("id,name")
          .in("id", gradeIds)
          .eq("is_active", true)
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
    areaIds.length
      ? supabase
          .from("learning_areas")
          .select(
            "id,title,description,icon_name,accent_color,illustration_url"
          )
          .in("id", areaIds)
          .eq("is_active", true)
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
  ]);
  readFailed("signup teaching grades", gradesResult.error);
  readFailed("signup teaching areas", areasResult.error);
  if (gradesResult.error || areasResult.error) return failed();
  const grades = new Map(
    (gradesResult.data ?? []).map(row => [String(row.id), String(row.name)])
  );
  const areas = new Map(
    (areasResult.data ?? []).map(row => [String(row.id), row as Row])
  );
  const output = new Map<string, PublicTeacherSubject[]>();
  for (const row of rows) {
    const teacherId = String(row.teacher_id ?? "");
    const area = areas.get(String(row.learning_area_id));
    if (!teacherId || !area || typeof area.title !== "string") continue;
    const gradeName = grades.get(String(row.grade_id)) ?? null;
    const key = `${String(row.learning_area_id)}:${String(row.grade_id)}`;
    const current = output.get(teacherId) ?? [];
    if (!current.some(subject => subject.id === key))
      current.push({
        id: key,
        title: area.title,
        description:
          typeof area.description === "string" ? area.description : null,
        icon_name: typeof area.icon_name === "string" ? area.icon_name : null,
        accent_color:
          typeof area.accent_color === "string" ? area.accent_color : null,
        illustration_url:
          typeof area.illustration_url === "string"
            ? area.illustration_url
            : null,
        grade_name: gradeName,
      });
    output.set(teacherId, current);
  }
  return { data: output, error: null };
}

export async function listPublicTeachers(
  input: TeacherFilterInput = {}
): Promise<PublicReadResult<PublicTeacherListing[]>> {
  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase) return unavailable();
    const filters = normalizeTeacherFilters(input);
    const hasSubjectFilter = Boolean(filters.subjectId || filters.gradeId);
    const hasClassFilters = Boolean(
      hasSubjectFilter || filters.maxPrice || filters.pricingBasis
    );
    let eligibleIds: string[] | null = null;
    if (hasClassFilters) {
      const { data: classes, error } = await getPublishedClassRows(
        supabase,
        filters
      );
      readFailed("published class filters", error);
      if (error) return failed();
      const classIds = [
        ...new Set(
          (classes ?? []).map(row => String(row.teacher_id)).filter(Boolean)
        ),
      ];
      let signupIds: string[] = [];
      if (hasSubjectFilter) {
        let subjectQuery = supabase
          .from("teacher_subjects")
          .select("teacher_id")
          .limit(1000);
        if (filters.subjectId)
          subjectQuery = subjectQuery.eq("learning_area_id", filters.subjectId);
        if (filters.gradeId)
          subjectQuery = subjectQuery.eq("grade_id", filters.gradeId);
        const { data: matching, error: subjectError } = await subjectQuery;
        readFailed("signup subject filters", subjectError);
        if (subjectError) return failed();
        signupIds = [
          ...new Set(
            (matching ?? []).map(row => String(row.teacher_id)).filter(Boolean)
          ),
        ];
      }
      if (hasSubjectFilter && (filters.maxPrice || filters.pricingBasis)) {
        const matchingIds = new Set(signupIds);
        eligibleIds = classIds.filter(id => matchingIds.has(id));
      } else if (hasSubjectFilter) {
        eligibleIds = [...new Set([...signupIds, ...classIds])];
      } else {
        eligibleIds = classIds;
      }
      if (!eligibleIds.length) return { data: [], error: null };
    }

    let query = supabase
      .from("teacher_details")
      .select(
        "profile_id,public_name,public_avatar_url,bio,experience_years,verification_status,is_accepting_students,starting_price_kes,pricing_basis,services,created_at"
      )
      .eq("is_accepting_students", true);
    if (filters.sort === "newest") {
      query = query.order("created_at", {
        ascending: false,
        nullsFirst: false,
      });
    } else if (filters.sort === "price_asc" || filters.sort === "price_desc") {
      query = query.order("starting_price_kes", {
        ascending: filters.sort === "price_asc",
        nullsFirst: false,
      });
    } else {
      query = query.order("public_name", {
        ascending: true,
        nullsFirst: false,
      });
    }
    query = query.order("profile_id", { ascending: true }).limit(48);
    if (filters.q) query = query.ilike("public_name", `%${filters.q}%`);
    if (filters.verified) query = query.eq("verification_status", "verified");
    if (eligibleIds) query = query.in("profile_id", eligibleIds);
    const { data, error } = await query;
    readFailed("public teacher profiles", error);
    if (error) return failed();
    const teachers = (data ?? []) as PublicTeacher[];
    const subjectsResult = await subjectsForTeachers(
      supabase,
      teachers.map(teacher => teacher.profile_id)
    );
    if (subjectsResult.error)
      return { data: null, error: subjectsResult.error };
    return {
      data: teachers.map(teacher => ({
        ...teacher,
        subjects: subjectsResult.data.get(teacher.profile_id) ?? [],
      })),
      error: null,
    };
  } catch {
    return failed();
  }
}

export async function getPublicTeacherProfile(
  id: string
): Promise<PublicReadResult<TeacherProfile | null>> {
  try {
    if (!isPublicTeacherId(id)) return { data: null, error: null };
    const supabase = await getSupabaseServerClient();
    if (!supabase) return unavailable();
    const { data: teacher, error: teacherError } = await supabase
      .from("teacher_details")
      .select(
        "profile_id,public_name,public_avatar_url,public_whatsapp,bio,experience_years,verification_status,is_accepting_students,starting_price_kes,pricing_basis,services"
      )
      .eq("profile_id", id)
      .eq("is_accepting_students", true)
      .maybeSingle();
    readFailed("public teacher profile", teacherError);
    if (teacherError) return failed();
    if (!teacher) return { data: null, error: null };
    const [{ data: classRows, error: classError }, subjectsResult] =
      await Promise.all([
        getPublishedClassRows(supabase, undefined, id),
        subjectsForTeachers(supabase, [id]),
      ]);
    readFailed("published teacher classes", classError);
    if (classError || subjectsResult.error) return failed();
    const rows = (classRows ?? []) as Row[];
    const signupSubjects = subjectsResult.data.get(id) ?? [];
    const gradeIds = [
      ...new Set(
        rows.map(row => String(row.grade_id ?? "")).filter(isPublicTeacherId)
      ),
    ];
    const areaIds = [
      ...new Set(
        rows
          .map(row => String(row.learning_area_id ?? ""))
          .filter(isPublicTeacherId)
      ),
    ];
    const [gradesResult, areasResult] = await Promise.all([
      gradeIds.length
        ? supabase
            .from("grades")
            .select("id,name")
            .in("id", gradeIds)
            .eq("is_active", true)
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
      areaIds.length
        ? supabase
            .from("learning_areas")
            .select(
              "id,title,description,icon_name,accent_color,illustration_url"
            )
            .in("id", areaIds)
            .eq("is_active", true)
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
    ]);
    readFailed("public teacher class grades", gradesResult.error);
    readFailed("public teacher class learning areas", areasResult.error);
    if (gradesResult.error || areasResult.error) return failed();
    const grades = new Map(
      (gradesResult.data ?? []).map(row => [String(row.id), String(row.name)])
    );
    const areas = new Map(
      (areasResult.data ?? []).map(row => [String(row.id), row as Row])
    );
    const subjects = [...signupSubjects];
    const classes = rows.map((row): PublicClass => {
      const area = areas.get(String(row.learning_area_id));
      const gradeName = grades.get(String(row.grade_id)) ?? null;
      if (area && typeof area.title === "string") {
        const key = `${String(row.learning_area_id)}:${String(row.grade_id)}`;
        if (!subjects.some(subject => subject.id === key))
          subjects.push({
            id: key,
            title: area.title,
            description:
              typeof area.description === "string" ? area.description : null,
            icon_name:
              typeof area.icon_name === "string" ? area.icon_name : null,
            accent_color:
              typeof area.accent_color === "string" ? area.accent_color : null,
            illustration_url:
              typeof area.illustration_url === "string"
                ? area.illustration_url
                : null,
            grade_name: gradeName,
          });
      }
      return {
        id: String(row.id),
        title: String(row.title || "Class"),
        description:
          typeof row.description === "string" ? row.description : null,
        grade_name: gradeName,
        area_title: typeof area?.title === "string" ? area.title : null,
        price_kes: Number(row.price_kes) || 0,
        pricing_basis: row.pricing_basis as PublicClass["pricing_basis"],
        lessons_in_bundle:
          typeof row.lessons_in_bundle === "number"
            ? row.lessons_in_bundle
            : null,
      };
    });
    return {
      data: { teacher: teacher as PublicTeacher, subjects, classes },
      error: null,
    };
  } catch {
    return failed();
  }
}
