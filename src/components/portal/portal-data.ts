import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentProfile } from "@/lib/auth/guards";
import type { PortalRecord } from "./portal-ui";
import { buildWhatsAppHandoffHref } from "@/lib/whatsapp/handoff";
import { whatsappHref } from "@/lib/whatsapp/links";

export type SubjectItem = {
  id: string;
  title: string;
  iconName?: string | null;
  accentColor?: string | null;
  illustrationUrl?: string | null;
  note?: string;
};
export type DashboardData = {
  stats: { label: string; value: string; note?: string }[];
  subjects: SubjectItem[];
  scores: { title: string; detail: string; meta: string }[];
  programs: PortalRecord[];
  upcoming: PortalRecord[];
  goals: string[];
  records: PortalRecord[];
  attendance: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  };
  strongest?: string;
  weakest?: string;
  children?: Row[];
  teachers?: PortalRecord[];
  teacherStudents?: PortalRecord[];
};
type Row = Record<string, any>;
const rows = (value: unknown): Row[] =>
  Array.isArray(value) ? (value as Row[]) : [];
const text = (value: unknown, fallback = "—") =>
  value == null || value === "" ? fallback : String(value);
const date = (value: unknown) => {
  if (!value) return "Date not set";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.valueOf())
    ? String(value)
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle:
          typeof value === "string" && value.includes(":")
            ? "short"
            : undefined,
      }).format(parsed);
};
const scheduleText = (value: unknown) => {
  if (
    !value ||
    (typeof value === "object" &&
      !Array.isArray(value) &&
      !Object.keys(value as object).length)
  )
    return "Schedule not listed";
  let record: unknown = value;
  if (typeof value === "string") {
    try {
      record = JSON.parse(value);
    } catch {
      return value.replace(/https?:\/\/\S+/gi, "[private link omitted]");
    }
  }
  if (Array.isArray(record))
    return (
      record
        .map(part =>
          typeof part === "string" || typeof part === "number"
            ? String(part)
            : ""
        )
        .filter(Boolean)
        .join(" · ") || "Schedule recorded"
    );
  if (typeof record !== "object" || record === null) return "Schedule recorded";
  const entries = Object.entries(record as Record<string, unknown>)
    .filter(([key]) => !/(meeting|link|url|phone|contact)/i.test(key))
    .map(([key, item]) => {
      const valueText = Array.isArray(item)
        ? item
            .filter(x => typeof x === "string" || typeof x === "number")
            .join(", ")
        : typeof item === "string" || typeof item === "number"
          ? String(item)
          : "";
      return valueText
        ? `${key.replaceAll("_", " ")}: ${valueText.replace(/https?:\/\/\S+/gi, "[private link omitted]")}`
        : "";
    })
    .filter(Boolean);
  return entries.length ? entries.join(" · ") : "Schedule recorded";
};
const list = async (
  client: SupabaseClient,
  table: string,
  select: string,
  filters: (q: any) => any,
  limit = 50
) => {
  try {
    const { data, error } = await filters(
      client.from(table).select(select)
    ).limit(limit);
    if (error) return [];
    return rows(data);
  } catch {
    return [];
  }
};
const one = async (
  client: SupabaseClient,
  table: string,
  select: string,
  filters: (q: any) => any
) => {
  try {
    const { data, error } = await filters(
      client.from(table).select(select)
    ).maybeSingle();
    if (error) return null;
    return data as Row | null;
  } catch {
    return null;
  }
};
const inList = (
  client: SupabaseClient,
  table: string,
  select: string,
  column: string,
  ids: string[],
  limit = 100
) =>
  ids.length
    ? list(client, table, select, q => q.in(column, ids), limit)
    : Promise.resolve([] as Row[]);
const ymd = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const attendanceSummary = (items: Row[]) => ({
  present: items.filter(x => x.status === "present").length,
  absent: items.filter(x => x.status === "absent").length,
  late: items.filter(x => x.status === "late").length,
  excused: items.filter(x => x.status === "excused").length,
  total: items.length,
});
const subjectFromArea = (area: Row, note?: string): SubjectItem => ({
  id: String(area.id),
  title: text(area.title),
  iconName: area.icon_name,
  accentColor: area.accent_color,
  illustrationUrl: area.illustration_url,
  note,
});

async function readCourseProgress(
  client: SupabaseClient,
  courseIds: string[],
  studentId: string
) {
  if (!courseIds.length)
    return {
      courses: [] as Row[],
      modules: [] as Row[],
      lessons: [] as Row[],
      completedIds: new Set<string>(),
    };
  const [courses, modules, progress] = await Promise.all([
    inList(client, "courses", "id,title", "id", courseIds),
    inList(client, "course_modules", "id,course_id", "course_id", courseIds),
    list(
      client,
      "lesson_progress",
      "lesson_id,completed_at",
      q => q.eq("student_id", studentId),
      500
    ),
  ]);
  const lessons = modules.length
    ? await inList(
        client,
        "course_lessons",
        "id,module_id",
        "module_id",
        modules.map(x => String(x.id)),
        500
      )
    : [];
  return {
    courses,
    modules,
    lessons,
    completedIds: new Set(
      progress.filter(x => x.completed_at).map(x => String(x.lesson_id))
    ),
  };
}
function courseProgressRecord(
  enrolment: Row,
  courseId: string,
  courseRows: Row[],
  modules: Row[],
  lessons: Row[],
  completedIds: Set<string>,
  href: string
): PortalRecord {
  const moduleIds = new Set(
    modules.filter(x => String(x.course_id) === courseId).map(x => String(x.id))
  );
  const lessonIds = lessons
    .filter(x => moduleIds.has(String(x.module_id)))
    .map(x => String(x.id));
  const completed = lessonIds.filter(id => completedIds.has(id)).length;
  return {
    title:
      courseRows.find(x => String(x.id) === courseId)?.title ??
      "Enrolled course",
    detail: `${text(enrolment.status)} · ${completed} of ${lessonIds.length} lessons completed`,
    meta: enrolment.expires_at
      ? `Access until ${date(enrolment.expires_at)}`
      : "No expiry recorded",
    href,
  };
}

export async function readStudentDashboard(
  client: SupabaseClient,
  profile: CurrentProfile
): Promise<DashboardData> {
  const id = profile.id;
  const [
    detail,
    selections,
    enrolments,
    scores,
    attendanceRows,
    courseEnrolments,
    entitlements,
  ] = await Promise.all([
    one(client, "student_details", "goals,community_enabled", q =>
      q.eq("profile_id", id)
    ),
    list(
      client,
      "student_subjects",
      "id,learning_area_id,selection_type",
      q => q.eq("student_id", id),
      100
    ),
    list(
      client,
      "enrolments",
      "id,class_id,status,starts_at,ends_at,lessons_remaining",
      q => q.eq("student_id", id).eq("status", "active"),
      100
    ),
    list(
      client,
      "scores",
      "id,class_id,learning_area_id,assessment_type,score,max_score,percentage,assessed_on",
      q => q.eq("student_id", id).order("assessed_on", { ascending: false }),
      50
    ),
    list(
      client,
      "attendance",
      "id,lesson_id,status,joined_at",
      q => q.eq("student_id", id),
      500
    ),
    list(
      client,
      "course_enrolments",
      "id,course_id,status,expires_at,enrolled_at",
      q => q.eq("student_id", id).in("status", ["active", "completed"]),
      100
    ),
    list(
      client,
      "entitlements",
      "id,product_id,status,ends_at",
      q => q.eq("profile_id", id).eq("status", "active"),
      100
    ),
  ]);
  const classIds = [...new Set(enrolments.map(x => String(x.class_id)))];
  const [classes, lessons, learningAreas, products, courseData] =
    await Promise.all([
      inList(
        client,
        "classes",
        "id,title,teacher_id,learning_area_id,schedule",
        "id",
        classIds
      ),
      classIds.length
        ? list(
            client,
            "lessons",
            "id,class_id,title,starts_at",
            q =>
              q
                .in("class_id", classIds)
                .gte("starts_at", ymd(-60))
                .order("starts_at", { ascending: true }),
            100
          )
        : Promise.resolve([] as Row[]),
      inList(
        client,
        "learning_areas",
        "id,title,icon_name,accent_color,illustration_url",
        "id",
        [
          ...new Set(
            [...selections, ...scores]
              .map(x => String(x.learning_area_id))
              .filter(Boolean)
          ),
        ]
      ),
      inList(
        client,
        "products",
        "id,title",
        "id",
        entitlements.map(x => String(x.product_id)).filter(Boolean)
      ),
      readCourseProgress(
        client,
        [...new Set(courseEnrolments.map(x => String(x.course_id)))],
        id
      ),
    ]);
  const areaById = new Map(learningAreas.map(x => [String(x.id), x]));
  const areas = selections
    .map(x => areaById.get(String(x.learning_area_id)))
    .filter((x): x is Row => Boolean(x));
  const programs = enrolments.map((enrolment): PortalRecord => {
    const klass = classes.find(
      x => String(x.id) === String(enrolment.class_id)
    );
    const area = klass ? areaById.get(String(klass.learning_area_id)) : null;
    const remaining =
      enrolment.lessons_remaining == null
        ? "Lesson count not tracked"
        : `${enrolment.lessons_remaining} lessons remaining`;
    return {
      title: text(klass?.title, "Tutoring class"),
      detail: text(area?.title, "Learning area not listed"),
      meta: `${scheduleText(klass?.schedule)} · ${remaining} · Active enrolment`,
    };
  });
  const scoreRows = scores.map(score => {
    const area = areaById.get(String(score.learning_area_id));
    const result =
      score.percentage != null
        ? `${Number(score.percentage)}%`
        : score.score != null && score.max_score != null
          ? `${score.score} / ${score.max_score}`
          : "Score not entered";
    return {
      title: text(area?.title, "Assessment"),
      detail: result,
      meta: `${text(score.assessment_type)} · ${date(score.assessed_on)}`,
    };
  });
  const scoreGroups = new Map<string, number[]>();
  for (const score of scores) {
    const area = areaById.get(String(score.learning_area_id));
    const percentage =
      score.percentage != null
        ? Number(score.percentage)
        : Number(score.max_score) > 0 && score.score != null
          ? (100 * Number(score.score)) / Number(score.max_score)
          : null;
    if (area && percentage != null)
      scoreGroups.set(String(area.id), [
        ...(scoreGroups.get(String(area.id)) ?? []),
        percentage,
      ]);
  }
  const averages = [...scoreGroups]
    .map(([areaId, values]) => ({
      area: areaById.get(areaId),
      value: values.reduce((a, b) => a + b, 0) / values.length,
    }))
    .filter(x => x.area)
    .sort((a, b) => b.value - a.value);
  const upcoming = lessons
    .filter(x => new Date(String(x.starts_at)).getTime() >= Date.now())
    .slice(0, 8)
    .map(lesson => ({
      title: text(lesson.title),
      detail: date(lesson.starts_at),
      meta: classes.find(x => String(x.id) === String(lesson.class_id))?.title,
    }));
  const courseRecords = courseEnrolments.map(x =>
    courseProgressRecord(
      x,
      String(x.course_id),
      courseData.courses,
      courseData.modules,
      courseData.lessons,
      courseData.completedIds,
      "/student/courses"
    )
  );
  const projectRecords = entitlements.map(x => ({
    title:
      products.find(p => String(p.id) === String(x.product_id))?.title ??
      "Learning project",
    detail: "Available in your learning library",
    meta: x.ends_at ? `Access until ${date(x.ends_at)}` : "No expiry recorded",
    href: "/student/library",
  }));
  const attendance = attendanceSummary(attendanceRows);
  const records = [...courseRecords, ...projectRecords];
  return {
    stats: [
      {
        label: "Active classes",
        value: String(enrolments.length),
        note: enrolments.length
          ? "Classes linked to your learner account"
          : "No active class enrolments are visible to your account",
      },
      {
        label: "Attendance records",
        value: String(attendance.total),
        note: attendance.total
          ? `${attendance.present} present · ${attendance.absent} absent · ${attendance.late} late · ${attendance.excused} excused`
          : "No attendance has been recorded for your account",
      },
      {
        label: "Assessment records",
        value: String(scores.length),
        note: scores.length
          ? "Teacher-entered assessments"
          : "No assessment results are available yet",
      },
    ],
    subjects: selections
      .map(x => {
        const area = areaById.get(String(x.learning_area_id));
        return area
          ? subjectFromArea(area, text(x.selection_type, "Selected"))
          : null;
      })
      .filter((x): x is SubjectItem => Boolean(x)),
    scores: scoreRows.slice(0, 8),
    programs,
    upcoming,
    goals: detail?.goals
      ? String(detail.goals)
          .split(/[\n,;]+/)
          .map((x: string) => x.trim())
          .filter(Boolean)
      : [],
    records,
    attendance,
    strongest: averages[0]
      ? text(averages[0].area?.title)
      : "Not enough scored assessments yet",
    weakest: averages.length
      ? text(averages[averages.length - 1].area?.title)
      : "Not enough scored assessments yet",
  };
}

export async function readParentDashboard(
  client: SupabaseClient,
  profile: CurrentProfile
): Promise<DashboardData & { children: Row[]; teachers: PortalRecord[] }> {
  const links = await list(
    client,
    "parent_student_links",
    "student_id,relationship,confirmed_at",
    q => q.eq("parent_id", profile.id).not("confirmed_at", "is", null),
    100
  );
  const confirmedLinks = links.filter(link => Boolean(link.confirmed_at));
  const childIds = [
    ...new Set(
      confirmedLinks.map(link => String(link.student_id)).filter(Boolean)
    ),
  ];
  const [
    profiles,
    details,
    subjects,
    courseEnrolments,
    classEnrolments,
    reports,
  ] = await Promise.all([
    inList(client, "profiles", "id,full_name", "id", childIds),
    inList(
      client,
      "student_details",
      "profile_id,goals,community_enabled",
      "profile_id",
      childIds
    ),
    inList(
      client,
      "student_subjects",
      "id,student_id,learning_area_id,selection_type",
      "student_id",
      childIds
    ),
    inList(
      client,
      "course_enrolments",
      "id,student_id,course_id,status,expires_at",
      "student_id",
      childIds
    ),
    childIds.length
      ? list(
          client,
          "enrolments",
          "id,class_id,student_id,status,lessons_remaining",
          q => q.in("student_id", childIds).eq("status", "active"),
          150
        )
      : Promise.resolve([] as Row[]),
    childIds.length
      ? list(
          client,
          "generated_reports",
          "id,subject_profile_id,report_type,file_path,generated_at,expires_at",
          q =>
            q
              .in("subject_profile_id", childIds)
              .order("generated_at", { ascending: false }),
          50
        )
      : Promise.resolve([] as Row[]),
  ]);
  const confirmedIdSet = new Set(childIds);
  const safeCourseEnrolments = courseEnrolments.filter(
    x =>
      confirmedIdSet.has(String(x.student_id)) &&
      ["active", "completed"].includes(String(x.status))
  );
  const safeClassEnrolments = classEnrolments.filter(x =>
    confirmedIdSet.has(String(x.student_id))
  );
  const [areas, courses, classes] = await Promise.all([
    inList(
      client,
      "learning_areas",
      "id,title,icon_name,accent_color,illustration_url",
      "id",
      [...new Set(subjects.map(x => String(x.learning_area_id)))]
    ),
    inList(client, "courses", "id,title", "id", [
      ...new Set(safeCourseEnrolments.map(x => String(x.course_id))),
    ]),
    inList(
      client,
      "classes",
      "id,title,teacher_id,learning_area_id,schedule",
      "id",
      [...new Set(safeClassEnrolments.map(x => String(x.class_id)))]
    ),
  ]);
  const teacherIds = [
    ...new Set(classes.map(x => String(x.teacher_id)).filter(Boolean)),
  ];
  const teachersRows = await inList(
    client,
    "teacher_details",
    "profile_id,public_name,public_whatsapp",
    "profile_id",
    teacherIds
  );
  const profileById = new Map(profiles.map(x => [String(x.id), x]));
  const detailById = new Map(details.map(x => [String(x.profile_id), x]));
  const areaById = new Map(areas.map(x => [String(x.id), x]));
  const children = childIds.map(childId => {
    const linkedClasses = safeClassEnrolments
      .filter(x => String(x.student_id) === childId)
      .map(enrolment =>
        classes.find(x => String(x.id) === String(enrolment.class_id))
      )
      .filter((x): x is Row => Boolean(x));
    const linkedCourses = safeCourseEnrolments
      .filter(x => String(x.student_id) === childId)
      .map(
        enrolment =>
          courses.find(x => String(x.id) === String(enrolment.course_id))?.title
      )
      .filter(Boolean);
    return {
      id: childId,
      name: text(profileById.get(childId)?.full_name, "Linked learner"),
      relationship: text(
        confirmedLinks.find(x => String(x.student_id) === childId)
          ?.relationship,
        "Child or learner"
      ),
      goals: text(detailById.get(childId)?.goals, "No learning goals provided"),
      communityEnabled: detailById.get(childId)?.community_enabled !== false,
      subjects: subjects
        .filter(x => String(x.student_id) === childId)
        .map(x => areaById.get(String(x.learning_area_id)))
        .filter((x): x is Row => Boolean(x))
        .map(x => subjectFromArea(x)),
      classes: [...new Set(linkedClasses.map(x => text(x.title)))],
      courses: linkedCourses as string[],
    };
  });
  const contacts = new Map<string, PortalRecord>();
  for (const klass of classes) {
    const teacher = teachersRows.find(
      x => String(x.profile_id) === String(klass.teacher_id)
    );
    const key = `${klass.id}:${klass.teacher_id}`;
    const validContact = whatsappHref(
      teacher?.public_whatsapp,
      `Hello, I am contacting you about ${text(klass.title, "the class")} for a linked learner.`
    );
    const href = validContact
      ? (buildWhatsAppHandoffHref("class", String(klass.id)) ?? undefined)
      : undefined;
    contacts.set(key, {
      title: text(teacher?.public_name, "Teacher"),
      detail: text(klass.title, "Enrolled class"),
      meta: href
        ? "Contact via WhatsApp"
        : "WhatsApp contact is not available for this class",
      href: href ?? undefined,
    });
  }
  const records = reports
    .filter(x => confirmedIdSet.has(String(x.subject_profile_id)))
    .map(report => ({
      title: `${text(report.report_type).replaceAll("_", " ")} report`,
      detail:
        profileById.get(String(report.subject_profile_id))?.full_name ??
        "Linked learner",
      meta: `Generated ${date(report.generated_at)}${report.expires_at ? ` · expires ${date(report.expires_at)}` : ""}${report.file_path ? " · report file is recorded; secure download is not available here" : ""}`,
    }));
  return {
    stats: [
      {
        label: "Confirmed linked learners",
        value: String(children.length),
        note: children.length
          ? "Only confirmed guardian links are shown"
          : "No confirmed learner links are visible to your account",
      },
      {
        label: "Active learner classes",
        value: String(safeClassEnrolments.length),
      },
      {
        label: "Course enrolments",
        value: String(safeCourseEnrolments.length),
      },
      {
        label: "Learning reports",
        value: String(records.length),
        note: records.length
          ? "Generated reports for confirmed linked learners"
          : "Reports appear when records are generated for confirmed learners",
      },
    ],
    subjects: [],
    scores: [],
    programs: [],
    upcoming: [],
    goals: [],
    records,
    attendance: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
    children,
    teachers: [...contacts.values()],
  };
}

export async function readTeacherDashboard(
  client: SupabaseClient,
  profile: CurrentProfile
): Promise<DashboardData> {
  const classes = await list(
    client,
    "classes",
    "id,title,learning_area_id,grade_id,is_active,schedule",
    q => q.eq("teacher_id", profile.id),
    100
  );
  const classIds = classes.map(x => String(x.id));
  const [enrolments, classLessons, areas, grades] = await Promise.all([
    classIds.length
      ? list(
          client,
          "enrolments",
          "id,class_id,student_id,status,lessons_remaining",
          q => q.in("class_id", classIds).in("status", ["active", "completed"]),
          200
        )
      : Promise.resolve([] as Row[]),
    classIds.length
      ? list(
          client,
          "lessons",
          "id,class_id,title,starts_at",
          q =>
            q.in("class_id", classIds).order("starts_at", { ascending: true }),
          500
        )
      : Promise.resolve([] as Row[]),
    inList(
      client,
      "learning_areas",
      "id,title,icon_name,accent_color,illustration_url",
      "id",
      classes.map(x => String(x.learning_area_id))
    ),
    inList(
      client,
      "grades",
      "id,name",
      "id",
      classes.map(x => String(x.grade_id))
    ),
  ]);
  const lessonIds = classLessons.map(x => String(x.id));
  const studentIds = [...new Set(enrolments.map(x => String(x.student_id)))];
  const [attendanceRows, assessmentRows, homeworkRows, studentProfiles] =
    await Promise.all([
      lessonIds.length
        ? list(
            client,
            "attendance",
            "id,lesson_id,student_id,status",
            q => q.in("lesson_id", lessonIds),
            500
          )
        : Promise.resolve([] as Row[]),
      classIds.length
        ? list(
            client,
            "scores",
            "id,class_id,student_id,percentage,score,max_score,assessed_on",
            q =>
              q
                .in("class_id", classIds)
                .order("assessed_on", { ascending: false }),
            200
          )
        : Promise.resolve([] as Row[]),
      classIds.length
        ? list(
            client,
            "homework_submissions",
            "id,class_id,student_id,title,submitted_at,score",
            q => q.in("class_id", classIds),
            200
          )
        : Promise.resolve([] as Row[]),
      inList(client, "profiles", "id,full_name", "id", studentIds),
    ]);
  const areaById = new Map(areas.map(x => [String(x.id), x]));
  const gradeById = new Map(grades.map(x => [String(x.id), x]));
  const profileById = new Map(studentProfiles.map(x => [String(x.id), x]));
  const classesById = new Map(classes.map(x => [String(x.id), x]));
  const attendance = attendanceSummary(attendanceRows);
  const programs = classes.map(
    (klass): PortalRecord => ({
      title: text(klass.title),
      detail:
        [
          areaById.get(String(klass.learning_area_id))?.title,
          gradeById.get(String(klass.grade_id))?.name,
        ]
          .filter(Boolean)
          .join(" · ") || "Class details not available",
      meta: `${scheduleText(klass.schedule)} · ${klass.is_active ? "Active" : "Inactive"}`,
    })
  );
  const studentRecords = studentIds.map((studentId): PortalRecord => {
    const ownEnrolments = enrolments.filter(
      x => String(x.student_id) === studentId
    );
    const learnerScores = assessmentRows.filter(
      x => String(x.student_id) === studentId
    );
    const latest = learnerScores[0];
    const scoreSummary = latest
      ? latest.percentage != null
        ? `${latest.percentage}% on ${date(latest.assessed_on)}`
        : latest.score != null
          ? `${latest.score}${latest.max_score != null ? `/${latest.max_score}` : ""} on ${date(latest.assessed_on)}`
          : "Assessment recorded"
      : "No assessment scores yet";
    const learnerClassIds = new Set(ownEnrolments.map(x => String(x.class_id)));
    const learnerLessonIds = new Set(
      classLessons
        .filter(x => learnerClassIds.has(String(x.class_id)))
        .map(x => String(x.id))
    );
    const learnerAttendance = attendanceRows.filter(
      x =>
        String(x.student_id) === studentId &&
        learnerLessonIds.has(String(x.lesson_id))
    );
    const summary = attendanceSummary(learnerAttendance);
    const completedHomework = homeworkRows.filter(
      x => String(x.student_id) === studentId && x.submitted_at
    ).length;
    return {
      title: text(profileById.get(studentId)?.full_name, "Learner"),
      detail:
        ownEnrolments
          .map(x => text(classesById.get(String(x.class_id))?.title, "Class"))
          .join(", ") || "Enrolled class",
      meta: `Latest assessment: ${scoreSummary} · Attendance: ${summary.present} present, ${summary.absent} absent, ${summary.late} late, ${summary.excused} excused · ${completedHomework} homework submission(s)`,
    };
  });
  const upcoming = classLessons
    .filter(x => new Date(String(x.starts_at)).getTime() >= Date.now())
    .slice(0, 8)
    .map(lesson => ({
      title: text(lesson.title),
      detail: date(lesson.starts_at),
      meta: classesById.get(String(lesson.class_id))?.title,
    }));
  const [handoffResult, receiptResult] = await Promise.all([
    (async () => {
      try {
        return await (client as any).rpc("get_whatsapp_handoff_total_count");
      } catch {
        return { data: null, error: true };
      }
    })(),
    (async () => {
      try {
        return await client
          .from("seller_receipts")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", profile.id);
      } catch {
        return { count: null, error: true };
      }
    })(),
  ]);
  const handoffCount =
    !handoffResult?.error &&
    handoffResult?.data != null &&
    Number.isFinite(Number(handoffResult.data))
      ? Number(handoffResult.data)
      : null;
  const receiptCount =
    !receiptResult?.error && typeof receiptResult?.count === "number"
      ? receiptResult.count
      : null;
  return {
    stats: [
      {
        label: "Classes",
        value: String(classes.length),
        note: "Classes owned by your signed-in teacher account",
      },
      {
        label: "Active learner enrolments",
        value: String(enrolments.filter(x => x.status === "active").length),
      },
      { label: "Upcoming lessons", value: String(upcoming.length) },
      {
        label: "Attendance records",
        value: String(attendance.total),
        note: attendance.total
          ? `${attendance.present} present · ${attendance.absent} absent · ${attendance.late} late · ${attendance.excused} excused`
          : "No attendance has been recorded in your classes",
      },
      { label: "Assessment records", value: String(assessmentRows.length) },
      {
        label: "Homework submissions",
        value: String(homeworkRows.filter(x => Boolean(x.submitted_at)).length),
      },
      {
        label: "WhatsApp handoff clicks",
        value: handoffCount === null ? "—" : String(handoffCount),
        note: "Outbound clicks only; not messages, unique people, or sales",
      },
      {
        label: "Seller-issued receipts",
        value: receiptCount === null ? "—" : String(receiptCount),
        note: "Records you manually issued after an external sale",
      },
    ],
    subjects: classes
      .map(x => areaById.get(String(x.learning_area_id)))
      .filter((x): x is Row => Boolean(x))
      .map(x => subjectFromArea(x)),
    scores: studentRecords.map(x => ({
      title: x.title,
      detail: x.detail ?? "Learner progress",
      meta: x.meta ?? "Progress records are visible in class records",
    })),
    programs,
    upcoming,
    goals: [],
    records: [],
    attendance,
    teacherStudents: studentRecords,
  };
}

export async function readGuestDashboard(
  client: SupabaseClient,
  profile: CurrentProfile
): Promise<DashboardData> {
  const [courseEnrolments, certificates, entitlements] = await Promise.all([
    list(
      client,
      "course_enrolments",
      "id,course_id,status,enrolled_at,expires_at",
      q => q.eq("student_id", profile.id).in("status", ["active", "completed"]),
      100
    ),
    list(
      client,
      "certificates",
      "id,certificate_code,course_id,file_path,score,issued_at",
      q =>
        q
          .eq("student_id", profile.id)
          .is("revoked_at", null)
          .order("issued_at", { ascending: false }),
      50
    ),
    list(
      client,
      "entitlements",
      "id,product_id,status,ends_at",
      q => q.eq("profile_id", profile.id).eq("status", "active"),
      100
    ),
  ]);
  const courseIds = [
    ...new Set([
      ...courseEnrolments.map(x => String(x.course_id)),
      ...certificates.map(x => String(x.course_id)),
    ]),
  ];
  const productIds = [
    ...new Set(entitlements.map(x => String(x.product_id)).filter(Boolean)),
  ];
  const [courseData, products] = await Promise.all([
    readCourseProgress(
      client,
      [...new Set(courseEnrolments.map(x => String(x.course_id)))],
      profile.id
    ),
    inList(client, "products", "id,title", "id", productIds),
  ]);
  const enrolledRecords = courseEnrolments.map(x =>
    courseProgressRecord(
      x,
      String(x.course_id),
      courseData.courses,
      courseData.modules,
      courseData.lessons,
      courseData.completedIds,
      "/guest/courses"
    )
  );
  const certificateRecords = certificates.map(x => ({
    title: `Certificate ${text(x.certificate_code)}`,
    detail:
      courseData.courses.find(c => String(c.id) === String(x.course_id))
        ?.title ?? "Course certificate",
    meta: `Issued ${date(x.issued_at)}${x.score != null ? ` · score ${x.score}` : ""}${x.file_path ? " · secure download is not available here" : ""}`,
    href: "/guest/certificates",
  }));
  const projectRecords = entitlements.map(x => ({
    title:
      products.find(p => String(p.id) === String(x.product_id))?.title ??
      "Learning project",
    detail: "Available in your learning library",
    meta: x.ends_at ? `Access until ${date(x.ends_at)}` : "No expiry recorded",
    href: "/guest/library",
  }));
  return {
    stats: [
      {
        label: "Courses",
        value: String(courseEnrolments.length),
        note: courseEnrolments.length
          ? "Active or completed courses visible to your account"
          : "No course enrolments are visible to your account",
      },
      { label: "Certificates", value: String(certificates.length) },
      { label: "Learning projects", value: String(entitlements.length) },
    ],
    subjects: [],
    scores: [],
    programs: enrolledRecords,
    upcoming: [],
    goals: [],
    records: [...certificateRecords, ...projectRecords],
    attendance: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
  };
}

export async function readSection(
  client: SupabaseClient,
  profile: CurrentProfile,
  role: "student" | "parent" | "teacher" | "guest",
  section: string
): Promise<{ records: PortalRecord[]; note?: string }> {
  const id = profile.id;
  const rowsToRecords = (
    items: Row[],
    titleField: string,
    detail: (x: Row) => string,
    meta: (x: Row) => string
  ): PortalRecord[] =>
    items.map(x => ({
      title: text(x[titleField]),
      detail: detail(x),
      meta: meta(x),
    }));
  const empty = { records: [] as PortalRecord[] };
  if (role === "student") {
    if (["lessons", "calendar"].includes(section)) {
      const enrolments = await list(
        client,
        "enrolments",
        "class_id",
        q => q.eq("student_id", id).in("status", ["active", "completed"]),
        100
      );
      const classIds = [...new Set(enrolments.map(x => String(x.class_id)))];
      const [classes, attendance] = await Promise.all([
        inList(client, "classes", "id,title", "id", classIds),
        list(
          client,
          "attendance",
          "lesson_id,status,joined_at",
          q => q.eq("student_id", id),
          500
        ),
      ]);
      const lessons = classIds.length
        ? await list(
            client,
            "lessons",
            "id,class_id,title,starts_at",
            q =>
              q
                .in("class_id", classIds)
                .order("starts_at", { ascending: true }),
            100
          )
        : [];
      return {
        records: lessons.map(lesson => {
          const marked = attendance.find(
            entry => String(entry.lesson_id) === String(lesson.id)
          );
          return {
            title: text(lesson.title),
            detail: text(
              classes.find(x => String(x.id) === String(lesson.class_id))?.title
            ),
            meta: `${date(lesson.starts_at)}${marked ? ` · attendance: ${text(marked.status)}` : " · attendance not recorded"}`,
          };
        }),
        note: "Only class lessons linked to your learner account are shown. Private meeting links are omitted.",
      };
    }
    if (["quizzes", "homework"].includes(section)) {
      const [submissions, attempts] = await Promise.all([
        list(
          client,
          "homework_submissions",
          "title,due_at,submitted_at,score,feedback",
          q => q.eq("student_id", id).order("due_at", { ascending: true }),
          100
        ),
        list(
          client,
          "quiz_attempts",
          "quiz_id,score,started_at,submitted_at",
          q => q.eq("student_id", id).order("started_at", { ascending: false }),
          100
        ),
      ]);
      return {
        records: [
          ...rowsToRecords(
            submissions,
            "title",
            x =>
              x.score == null
                ? x.submitted_at
                  ? "Submitted; awaiting mark"
                  : "Not submitted"
                : `Score: ${x.score}`,
            x =>
              `${x.due_at ? `Due ${date(x.due_at)}` : "No due date"}${x.feedback ? ` · ${x.feedback}` : ""}`
          ),
          ...attempts.map(x => ({
            title: "Quiz attempt",
            detail:
              x.score == null ? "Score not available" : `Score: ${x.score}`,
            meta: date(x.submitted_at ?? x.started_at),
          })),
        ],
        note: "Only your submitted or assigned learning records are shown.",
      };
    }
    if (section === "resources") {
      const [enrolments, directShares] = await Promise.all([
        list(
          client,
          "enrolments",
          "class_id",
          q => q.eq("student_id", id).in("status", ["active", "completed"]),
          100
        ),
        list(
          client,
          "material_shares",
          "material_id,class_id,student_id",
          q => q.eq("student_id", id),
          100
        ),
      ]);
      const classIds = [...new Set(enrolments.map(x => String(x.class_id)))];
      const classShares = classIds.length
        ? await list(
            client,
            "material_shares",
            "material_id,class_id,student_id",
            q => q.in("class_id", classIds),
            100
          )
        : [];
      const materialIds = [
        ...new Set(
          [...directShares, ...classShares]
            .map(x => String(x.material_id))
            .filter(Boolean)
        ),
      ];
      const materials = await inList(
        client,
        "materials",
        "id,title,details,mime_type,created_at",
        "id",
        materialIds
      );
      return {
        records: rowsToRecords(
          materials,
          "title",
          x => text(x.details, text(x.mime_type, "Shared learning resource")),
          x => date(x.created_at)
        ),
        note: "Only resources explicitly shared with your account or active classes are listed. Secure file download is not configured here.",
      };
    }
    if (section === "groups") {
      const memberships = await list(
        client,
        "chat_group_members",
        "group_id",
        q => q.eq("profile_id", id),
        50
      );
      const groups = await inList(
        client,
        "chat_groups",
        "id,title,announcement_only,created_at",
        "id",
        memberships.map(x => String(x.group_id))
      );
      return {
        records: rowsToRecords(
          groups,
          "title",
          x => (x.announcement_only ? "Announcements only" : "Class group"),
          x => date(x.created_at)
        ),
        note: "Only groups with a recorded membership for your account are shown.",
      };
    }
    if (section === "community") {
      const memberships = await list(
        client,
        "community_members",
        "channel_id",
        q => q.eq("profile_id", id),
        50
      );
      const channels = await inList(
        client,
        "community_channels",
        "id,name,description",
        "id",
        memberships.map(x => String(x.channel_id))
      );
      return {
        records: rowsToRecords(
          channels,
          "name",
          x => text(x.description, "Community channel"),
          () => "Joined channel"
        ),
        note: "Community access depends on recorded learner and guardian consent. Posting is not enabled here.",
      };
    }
    if (section === "questions") {
      const items = await list(
        client,
        "qa_questions",
        "id,title,body,visibility,created_at",
        q => q.eq("asker_id", id).order("created_at", { ascending: false }),
        50
      );
      return {
        records: rowsToRecords(
          items,
          "title",
          x => text(x.body),
          x => `${text(x.visibility)} · ${date(x.created_at)}`
        ),
        note: "Only questions created by your account are shown.",
      };
    }
    if (section === "courses") {
      const enrolments = await list(
        client,
        "course_enrolments",
        "course_id,status,expires_at",
        q => q.eq("student_id", id).in("status", ["active", "completed"]),
        100
      );
      const progress = await readCourseProgress(
        client,
        [...new Set(enrolments.map(x => String(x.course_id)))],
        id
      );
      return {
        records: enrolments.map(x =>
          courseProgressRecord(
            x,
            String(x.course_id),
            progress.courses,
            progress.modules,
            progress.lessons,
            progress.completedIds,
            "/student/courses"
          )
        ),
        note: "Course progress is calculated from lesson completion records visible to your account.",
      };
    }
    if (section === "library") {
      const entitlements = await list(
        client,
        "entitlements",
        "product_id,status,ends_at",
        q => q.eq("profile_id", id).eq("status", "active"),
        100
      );
      const products = await inList(
        client,
        "products",
        "id,title",
        "id",
        entitlements.map(x => String(x.product_id)).filter(Boolean)
      );
      return {
        records: entitlements.map(x => ({
          title:
            products.find(p => String(p.id) === String(x.product_id))?.title ??
            "Learning project",
          detail: text(x.status),
          meta: x.ends_at
            ? `Access until ${date(x.ends_at)}`
            : "No expiry recorded",
        })),
        note: "Only active project access attached to your learner account is shown.",
      };
    }
    if (section === "profile") {
      const detail = await one(
        client,
        "student_details",
        "school,county,goals,community_enabled",
        q => q.eq("profile_id", id)
      );
      return {
        records: [
          {
            title: text(profile.full_name),
            detail: `${text(detail?.school, "School not listed")} · ${text(detail?.county, "County not listed")}`,
            meta: `Community access ${detail?.community_enabled === false ? "off" : "on"}`,
          },
        ],
        note: "Profile edits are not enabled on this page.",
      };
    }
  }
  if (role === "parent") {
    const links = await list(
      client,
      "parent_student_links",
      "student_id,relationship,confirmed_at",
      q => q.eq("parent_id", id).not("confirmed_at", "is", null),
      100
    );
    const confirmed = links.filter(x => Boolean(x.confirmed_at));
    const childIds = [
      ...new Set(confirmed.map(x => String(x.student_id)).filter(Boolean)),
    ];
    if (section === "children") {
      const profiles = await inList(
        client,
        "profiles",
        "id,full_name",
        "id",
        childIds
      );
      return {
        records: profiles.map(person => ({
          title: text(person.full_name),
          detail: text(
            confirmed.find(x => String(x.student_id) === String(person.id))
              ?.relationship,
            "Linked learner"
          ),
          href: "/parent/reports",
        })),
        note: "Only confirmed parent–learner links are shown.",
      };
    }
    if (section === "reports") {
      const reports = childIds.length
        ? await list(
            client,
            "generated_reports",
            "report_type,subject_profile_id,file_path,generated_at,expires_at",
            q =>
              q
                .in("subject_profile_id", childIds)
                .order("generated_at", { ascending: false }),
            50
          )
        : [];
      const profiles = await inList(
        client,
        "profiles",
        "id,full_name",
        "id",
        childIds
      );
      return {
        records: reports
          .filter(x => childIds.includes(String(x.subject_profile_id)))
          .map(report => ({
            title: `${text(report.report_type).replaceAll("_", " ")} report`,
            detail:
              profiles.find(
                p => String(p.id) === String(report.subject_profile_id)
              )?.full_name ?? "Linked learner",
            meta: `Generated ${date(report.generated_at)}${report.expires_at ? ` · expires ${date(report.expires_at)}` : ""}${report.file_path ? " · report file exists; secure download is not available here" : ""}`,
          })),
        note: "Reports are listed only for confirmed linked learners. A secure report download endpoint is not available here.",
      };
    }
    if (section === "teachers") {
      const enrolments = childIds.length
        ? await list(
            client,
            "enrolments",
            "class_id,student_id",
            q => q.in("student_id", childIds).eq("status", "active"),
            100
          )
        : [];
      const classes = await inList(
        client,
        "classes",
        "id,title,teacher_id",
        "id",
        [...new Set(enrolments.map(x => String(x.class_id)))]
      );
      const teachers = await inList(
        client,
        "teacher_details",
        "profile_id,public_name,public_whatsapp",
        "profile_id",
        [...new Set(classes.map(x => String(x.teacher_id)).filter(Boolean))]
      );
      const records = classes.map(klass => {
        const teacher = teachers.find(
          x => String(x.profile_id) === String(klass.teacher_id)
        );
        const validContact = whatsappHref(
          teacher?.public_whatsapp,
          `Hello, I am contacting you about ${text(klass.title, "the class")} for a linked learner.`
        );
        const contact = validContact
          ? (buildWhatsAppHandoffHref("class", String(klass.id)) ?? undefined)
          : undefined;
        return {
          title: text(teacher?.public_name, "Teacher"),
          detail: text(klass.title, "Enrolled class"),
          meta: contact
            ? "Contact via WhatsApp"
            : "WhatsApp contact is not available for this class",
          href: contact ?? undefined,
        };
      });
      return {
        records,
        note: "Teacher contacts are limited to active classes of confirmed linked learners. Contact numbers are not displayed.",
      };
    }
    if (section === "community") {
      const [parentDetails, studentDetails, profiles] = await Promise.all([
        one(client, "parent_details", "community_access_control", q =>
          q.eq("profile_id", id)
        ),
        inList(
          client,
          "student_details",
          "profile_id,community_enabled",
          "profile_id",
          childIds
        ),
        inList(client, "profiles", "id,full_name", "id", childIds),
      ]);
      return {
        records: [
          {
            title: "Parental community control",
            detail:
              parentDetails?.community_access_control === false
                ? "Parent control is disabled"
                : "Parent control is enabled",
            meta: `${studentDetails.filter(x => x.community_enabled).length} confirmed linked learner(s) have learner-level community enabled`,
          },
          ...studentDetails.map(x => ({
            title: text(
              profiles.find(p => String(p.id) === String(x.profile_id))
                ?.full_name,
              "Linked learner"
            ),
            detail: x.community_enabled
              ? "Learner community setting is on"
              : "Learner community setting is off",
            meta: "Guardian consent remains required",
          })),
        ],
        note: "These settings are read-only in this view.",
      };
    }
    if (section === "profile")
      return {
        records: [
          {
            title: text(profile.full_name),
            detail: "Parent account",
            meta: "Contact preferences and profile editing are not configured here",
          },
        ],
      };
  }
  if (role === "teacher") {
    const classes = await list(
      client,
      "classes",
      "id,title,learning_area_id,grade_id,is_active,schedule",
      q => q.eq("teacher_id", id),
      100
    );
    const classIds = classes.map(x => String(x.id));
    if (section === "classes") {
      const [areas, grades] = await Promise.all([
        inList(
          client,
          "learning_areas",
          "id,title",
          "id",
          classes.map(x => String(x.learning_area_id))
        ),
        inList(
          client,
          "grades",
          "id,name",
          "id",
          classes.map(x => String(x.grade_id))
        ),
      ]);
      return {
        records: classes.map(klass => ({
          title: text(klass.title),
          detail:
            [
              areas.find(x => String(x.id) === String(klass.learning_area_id))
                ?.title,
              grades.find(x => String(x.id) === String(klass.grade_id))?.name,
            ]
              .filter(Boolean)
              .join(" · ") || "Class details not available",
          meta: `${scheduleText(klass.schedule)} · ${klass.is_active ? "Active" : "Inactive"}`,
        })),
        note: "Only classes owned by your signed-in teacher account are listed.",
      };
    }
    if (section === "students") {
      const enrolments = classIds.length
        ? await list(
            client,
            "enrolments",
            "class_id,student_id,status",
            q =>
              q.in("class_id", classIds).in("status", ["active", "completed"]),
            200
          )
        : [];
      const studentIds = [
        ...new Set(enrolments.map(x => String(x.student_id))),
      ];
      const lessons = classIds.length
        ? await list(
            client,
            "lessons",
            "id,class_id",
            q => q.in("class_id", classIds),
            500
          )
        : [];
      const lessonIds = lessons.map(x => String(x.id));
      const [profiles, attendance, scores, homework] = await Promise.all([
        inList(client, "profiles", "id,full_name", "id", studentIds),
        lessonIds.length
          ? list(
              client,
              "attendance",
              "id,lesson_id,student_id,status",
              q => q.in("lesson_id", lessonIds),
              500
            )
          : Promise.resolve([] as Row[]),
        classIds.length
          ? list(
              client,
              "scores",
              "class_id,student_id,percentage,score,max_score,assessed_on",
              q =>
                q
                  .in("class_id", classIds)
                  .order("assessed_on", { ascending: false }),
              200
            )
          : Promise.resolve([] as Row[]),
        classIds.length
          ? list(
              client,
              "homework_submissions",
              "class_id,student_id,title,submitted_at,score",
              q => q.in("class_id", classIds),
              200
            )
          : Promise.resolve([] as Row[]),
      ]);
      return {
        records: studentIds.map(studentId => {
          const ownClasses = new Set(
            enrolments
              .filter(x => String(x.student_id) === studentId)
              .map(x => String(x.class_id))
          );
          const ownLessonIds = new Set(
            lessons
              .filter(x => ownClasses.has(String(x.class_id)))
              .map(x => String(x.id))
          );
          const ownAttendance = attendance.filter(
            x =>
              String(x.student_id) === studentId &&
              ownLessonIds.has(String(x.lesson_id))
          );
          const ownScores = scores.filter(
            x => String(x.student_id) === studentId
          );
          const latest = ownScores[0];
          const latestScore = latest
            ? latest.percentage != null
              ? `${latest.percentage}%`
              : latest.score != null
                ? `${latest.score}${latest.max_score != null ? `/${latest.max_score}` : ""}`
                : "Assessment recorded"
            : "No assessment results yet";
          return {
            title: text(
              profiles.find(x => String(x.id) === studentId)?.full_name,
              "Learner"
            ),
            detail: [...ownClasses]
              .map(classId =>
                text(
                  classes.find(x => String(x.id) === classId)?.title,
                  "Class"
                )
              )
              .join(", "),
            meta: `Latest assessment: ${latestScore}${latest ? ` · ${date(latest.assessed_on)}` : ""} · ${attendanceSummary(ownAttendance).present} present · ${homework.filter(x => String(x.student_id) === studentId && x.submitted_at).length} homework submission(s)`,
          };
        }),
      };
    }
    if (section === "materials") {
      const materials = await list(
        client,
        "materials",
        "title,details,mime_type,created_at",
        q => q.eq("teacher_id", id).order("created_at", { ascending: false }),
        100
      );
      return {
        records: rowsToRecords(
          materials,
          "title",
          x => text(x.details, text(x.mime_type, "Teaching material")),
          x => `${date(x.created_at)} · secure file download is not configured`
        ),
        note: "Only materials owned by your account are listed.",
      };
    }
    if (section === "groups") {
      const groups = await list(
        client,
        "chat_groups",
        "title,class_id,announcement_only,created_at",
        q => q.eq("created_by", id).order("created_at", { ascending: false }),
        100
      );
      return {
        records: rowsToRecords(
          groups,
          "title",
          x =>
            x.announcement_only
              ? "Announcements only"
              : "Class discussion group",
          x => date(x.created_at)
        ),
      };
    }
    if (section === "badge") {
      const [details, awards] = await Promise.all([
        one(client, "teacher_details", "verification_status", q =>
          q.eq("profile_id", id)
        ),
        list(
          client,
          "badge_awards",
          "awarded_at,expires_at,revoked_at",
          q => q.eq("teacher_id", id).order("awarded_at", { ascending: false }),
          20
        ),
      ]);
      return {
        records: [
          {
            title: `Verification: ${text(details?.verification_status, "unverified")}`,
            detail: "Teacher profile verification status",
            meta: "Verification and badge awards are separate records",
          },
          ...awards.map(x => ({
            title: "Badge award",
            detail: x.revoked_at ? "Revoked" : "Active",
            meta: `Awarded ${date(x.awarded_at)}${x.expires_at ? ` · expires ${date(x.expires_at)}` : ""}`,
          })),
        ],
      };
    }
    if (section === "profile") {
      const details = await one(
        client,
        "teacher_details",
        "public_name,bio,verification_status,is_accepting_students",
        q => q.eq("profile_id", id)
      );
      return {
        records: [
          {
            title: text(details?.public_name, text(profile.full_name)),
            detail: text(details?.bio, "No public profile description"),
            meta: `Verification ${text(details?.verification_status)} · ${details?.is_accepting_students ? "Accepting learners" : "Not accepting learners"}`,
          },
        ],
        note: "Profile edits are not enabled on this page.",
      };
    }
  }
  if (role === "guest") {
    if (section === "courses") {
      const enrolments = await list(
        client,
        "course_enrolments",
        "course_id,status,expires_at",
        q => q.eq("student_id", id).in("status", ["active", "completed"]),
        100
      );
      const progress = await readCourseProgress(
        client,
        [...new Set(enrolments.map(x => String(x.course_id)))],
        id
      );
      return {
        records: enrolments.map(x =>
          courseProgressRecord(
            x,
            String(x.course_id),
            progress.courses,
            progress.modules,
            progress.lessons,
            progress.completedIds,
            "/guest/courses"
          )
        ),
        note: "Progress is calculated from lesson completions attached to your guest learner account.",
      };
    }
    if (section === "certificates") {
      const certificates = await list(
        client,
        "certificates",
        "certificate_code,course_id,file_path,score,issued_at",
        q =>
          q
            .eq("student_id", id)
            .is("revoked_at", null)
            .order("issued_at", { ascending: false }),
        100
      );
      const courses = await inList(client, "courses", "id,title", "id", [
        ...new Set(certificates.map(x => String(x.course_id))),
      ]);
      return {
        records: certificates.map(x => ({
          title: text(x.certificate_code),
          detail:
            courses.find(c => String(c.id) === String(x.course_id))?.title ??
            "Course certificate",
          meta: `Issued ${date(x.issued_at)}${x.score != null ? ` · score ${x.score}` : ""}${x.file_path ? " · secure download is not available here" : ""}`,
        })),
      };
    }
    if (section === "library") {
      const entitlements = await list(
        client,
        "entitlements",
        "product_id,status,ends_at",
        q => q.eq("profile_id", id).eq("status", "active"),
        100
      );
      const products = await inList(
        client,
        "products",
        "id,title",
        "id",
        entitlements.map(x => String(x.product_id)).filter(Boolean)
      );
      return {
        records: entitlements.map(x => ({
          title:
            products.find(p => String(p.id) === String(x.product_id))?.title ??
            "Learning project",
          detail: text(x.status),
          meta: x.ends_at
            ? `Access until ${date(x.ends_at)}`
            : "No expiry recorded",
        })),
        note: "Only active learning project access attached to your account is shown. Project files have no secure download route here.",
      };
    }
    if (section === "profile")
      return {
        records: [
          {
            title: text(profile.full_name),
            detail: "Guest learner account",
            meta: "Profile editing is not configured on this page",
          },
        ],
      };
  }
  return empty;
}
