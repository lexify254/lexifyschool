import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasLearningReportContent,
  isUsableIssuedCertificate,
  resolveRequestedStudentId,
} from "./policy";
import type { CertificateDocument, LearningReportDocument } from "./documents";
import { isAccountSuspended } from "@/lib/auth/suspension";

type Row = Record<string, any>;

export class ReportRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ReportRequestError";
  }
}

export type AuthorizedLearner = {
  studentId: string;
  learnerName: string;
};

async function queryRows(
  client: SupabaseClient,
  table: string,
  selection: string,
  configure: (query: any) => any,
  limit: number
): Promise<Row[]> {
  const { data, error } = await configure(
    client.from(table).select(selection)
  ).limit(limit);
  if (error) throw new Error(`Could not read ${table} records.`);
  return Array.isArray(data) ? (data as Row[]) : [];
}

function safeText(value: unknown): string | null {
  if (value == null) return null;
  const result = String(value).trim();
  return result || null;
}

function numericText(value: unknown): string | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : null;
}

export async function authorizeLearner(
  client: SupabaseClient,
  requestedStudentId?: string | null
): Promise<AuthorizedLearner> {
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user)
    throw new ReportRequestError("Sign in to access learning documents.", 401);

  const { data: actor, error: actorError } = await client
    .from("profiles")
    .select("id,role,is_suspended")
    .eq("id", authData.user.id)
    .limit(1)
    .maybeSingle();
  if (actorError || !actor)
    throw new ReportRequestError(
      "Your learner account could not be verified.",
      401
    );
  if (isAccountSuspended(actor))
    throw new ReportRequestError("Account access is suspended.", 403);

  const studentId = resolveRequestedStudentId(
    { id: String(actor.id), role: String(actor.role) },
    requestedStudentId
  );
  if (!studentId) {
    const message =
      actor.role === "parent"
        ? "A linked learner ID is required for parent/guardian requests."
        : "This account cannot access that learner's documents.";
    throw new ReportRequestError(message, actor.role === "parent" ? 400 : 403);
  }

  if (actor.role === "parent") {
    const { data: link, error: linkError } = await client
      .from("parent_student_links")
      .select("student_id,confirmed_at")
      .eq("parent_id", authData.user.id)
      .eq("student_id", studentId)
      .not("confirmed_at", "is", null)
      .limit(1)
      .maybeSingle();
    if (linkError)
      throw new Error("Could not verify the guardian relationship.");
    if (!link || !link.confirmed_at)
      throw new ReportRequestError(
        "That learner is not available to this account.",
        404
      );
  }

  const { data: learner, error: learnerError } = await client
    .from("profiles")
    .select("id,full_name,role")
    .eq("id", studentId)
    .limit(1)
    .maybeSingle();
  if (learnerError) throw new Error("Could not read the learner profile.");
  if (!learner || learner.role !== "student")
    throw new ReportRequestError(
      "That learner is not available to this account.",
      404
    );
  const learnerName = safeText(learner.full_name);
  if (!learnerName)
    throw new ReportRequestError(
      "A learner name is not recorded, so a truthful document cannot be generated.",
      409
    );

  return { studentId, learnerName };
}

export async function readLearningReport(
  client: SupabaseClient,
  learner: AuthorizedLearner,
  generatedAt: string
): Promise<LearningReportDocument> {
  const [enrolments, scoreRows, attendanceRows, curriculumRows] =
    await Promise.all([
      queryRows(
        client,
        "enrolments",
        "class_id,status",
        query =>
          query
            .eq("student_id", learner.studentId)
            .in("status", ["active", "completed"]),
        100
      ),
      queryRows(
        client,
        "scores",
        "class_id,learning_area_id,assessment_type,score,max_score,percentage,assessed_on",
        query =>
          query
            .eq("student_id", learner.studentId)
            .order("assessed_on", { ascending: false }),
        200
      ),
      queryRows(
        client,
        "attendance",
        "lesson_id,status,created_at",
        query =>
          query
            .eq("student_id", learner.studentId)
            .order("created_at", { ascending: false }),
        500
      ),
      queryRows(
        client,
        "student_subjects",
        "learning_area_id,grade_id,selection_type",
        query => query.eq("student_id", learner.studentId),
        100
      ),
    ]);

  const classIds = [...new Set(enrolments.map(row => String(row.class_id)))];
  const classes = classIds.length
    ? await queryRows(
        client,
        "classes",
        "id,title,learning_area_id",
        query => query.in("id", classIds),
        100
      )
    : [];
  const lessonIds = [
    ...new Set(attendanceRows.map(row => String(row.lesson_id))),
  ];
  const lessons = lessonIds.length
    ? await queryRows(
        client,
        "lessons",
        "id,class_id,title,starts_at",
        query => query.in("id", lessonIds),
        500
      )
    : [];
  const areaIds = [
    ...new Set(
      [
        ...curriculumRows.map(row => row.learning_area_id),
        ...scoreRows.map(row => row.learning_area_id),
        ...classes.map(row => row.learning_area_id),
      ]
        .filter(Boolean)
        .map(String)
    ),
  ];
  const areas = areaIds.length
    ? await queryRows(
        client,
        "learning_areas",
        "id,title",
        query => query.in("id", areaIds),
        200
      )
    : [];
  const classById = new Map(classes.map(row => [String(row.id), row]));
  const lessonById = new Map(lessons.map(row => [String(row.id), row]));
  const areaById = new Map(areas.map(row => [String(row.id), row]));

  const attendanceCounts: Record<string, number> = {};
  for (const item of attendanceRows) {
    const status = String(item.status);
    attendanceCounts[status] = (attendanceCounts[status] ?? 0) + 1;
  }

  if (
    !hasLearningReportContent({
      enrolments: enrolments.length,
      scores: scoreRows.length,
      attendance: attendanceRows.length,
      curriculumSelections: curriculumRows.length,
    })
  ) {
    throw new ReportRequestError(
      "No curriculum, enrolment, score, or attendance records are available for this learner yet.",
      409
    );
  }

  const curriculum = curriculumRows.map(row => ({
    title:
      safeText(areaById.get(String(row.learning_area_id))?.title) ??
      "Learning area label unavailable",
    selectionType:
      safeText(row.selection_type) ?? "Selection type not recorded",
  }));
  const reportEnrolments = enrolments.map(row => {
    const klass = classById.get(String(row.class_id));
    return {
      classTitle: safeText(klass?.title) ?? "Class details unavailable",
      status: safeText(row.status) ?? "Status not recorded",
      learningArea:
        safeText(areaById.get(String(klass?.learning_area_id))?.title) ??
        undefined,
    };
  });
  const assessments = scoreRows.map(row => ({
    assessmentType:
      safeText(row.assessment_type) ?? "Assessment type not recorded",
    learningArea:
      safeText(areaById.get(String(row.learning_area_id))?.title) ?? undefined,
    score: numericText(row.score),
    maxScore: numericText(row.max_score),
    percentage: numericText(row.percentage),
    assessedOn: safeText(row.assessed_on),
  }));
  const attendance = attendanceRows.map(row => {
    const lesson = lessonById.get(String(row.lesson_id));
    return {
      status: safeText(row.status) ?? "Status not recorded",
      lessonTitle: safeText(lesson?.title) ?? undefined,
      classTitle:
        safeText(classById.get(String(lesson?.class_id))?.title) ?? undefined,
      startsAt:
        safeText(lesson?.starts_at) ?? safeText(row.created_at) ?? undefined,
    };
  });

  return {
    learnerName: learner.learnerName,
    generatedAt,
    curriculum,
    enrolments: reportEnrolments,
    assessments,
    attendance,
    attendanceCounts,
    recordCounts: {
      enrolments: enrolments.length,
      scores: scoreRows.length,
      attendance: attendanceRows.length,
      curriculumSelections: curriculumRows.length,
    },
  };
}

export async function readIssuedCertificate(
  client: SupabaseClient,
  learner: AuthorizedLearner,
  courseId: string,
  generatedAt: string
): Promise<CertificateDocument> {
  const { data: certificate, error: certificateError } = await client
    .from("certificates")
    .select("certificate_code,course_id,score,issued_at,revoked_at")
    .eq("student_id", learner.studentId)
    .eq("course_id", courseId)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (certificateError)
    throw new Error("Could not read the certificate record.");
  if (!certificate)
    throw new ReportRequestError(
      "No non-revoked issued certificate record exists for this learner and course.",
      404
    );
  if (!isUsableIssuedCertificate(certificate))
    throw new ReportRequestError(
      "The certificate record is incomplete, so a truthful PDF cannot be generated.",
      409
    );

  const { data: course, error: courseError } = await client
    .from("courses")
    .select("id,title")
    .eq("id", courseId)
    .limit(1)
    .maybeSingle();
  if (courseError)
    throw new Error("Could not read the certificate course details.");
  const courseTitle = safeText(course?.title);
  if (!courseTitle)
    throw new ReportRequestError(
      "The course title is not available, so a truthful certificate PDF cannot be generated.",
      409
    );

  return {
    learnerName: learner.learnerName,
    courseTitle,
    certificateCode: String(certificate.certificate_code).trim(),
    issuedAt: String(certificate.issued_at),
    generatedAt,
    score: numericText(certificate.score),
  };
}
