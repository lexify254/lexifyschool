import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentProfile } from "@/lib/auth/guards";
import { buildWhatsAppHandoffHref } from "@/lib/whatsapp/handoff";
import { whatsappHref } from "@/lib/whatsapp/links";

export type LearningRole = "student" | "parent" | "teacher" | "guest";
export type LearningRecord = {
  id: string;
  title: string;
  detail?: string;
  meta?: string;
  classId?: string;
  studentId?: string;
  lessonId?: string;
  questionId?: string;
  status?: string;
};
export type LearningPageData = {
  title: string;
  description: string;
  records: LearningRecord[];
  classes: LearningRecord[];
  students: LearningRecord[];
  lessons: LearningRecord[];
  submissions: LearningRecord[];
  note?: string;
  whatsappHandoffHref?: string;
};
type Row = Record<string, any>;
const asRows = (value: unknown): Row[] =>
  Array.isArray(value) ? (value as Row[]) : [];
const message = (error: unknown) =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Unknown database error";
async function rows(
  client: SupabaseClient,
  table: string,
  select: string,
  configure: (query: any) => any,
  limit = 100
): Promise<Row[]> {
  const result = await configure(client.from(table).select(select)).limit(
    limit
  );
  if (result.error) throw new Error(`${table}: ${message(result.error)}`);
  return asRows(result.data);
}
const readableDate = (value: unknown) => {
  if (!value) return "Date not set";
  const date = new Date(String(value));
  return Number.isNaN(date.valueOf())
    ? String(value)
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: String(value).includes(":") ? "short" : undefined,
      }).format(date);
};
const text = (value: unknown, fallback = "—") =>
  value == null || value === "" ? fallback : String(value);
const sectionMeta: Record<
  LearningRole,
  Record<string, { title: string; description: string }>
> = {
  student: {
    lessons: {
      title: "Lessons & calendar",
      description: "Your class schedule, attendance and learning activities.",
    },
    calendar: {
      title: "Lessons calendar",
      description: "Scheduled lessons for your enrolled classes.",
    },
    homework: {
      title: "Homework",
      description: "Review assignments and submit your work.",
    },
    quizzes: {
      title: "Assessment & homework",
      description: "Your class homework, assessment results and quiz records.",
    },
    questions: {
      title: "Questions & answers",
      description:
        "Ask about class learning and read responses you can access.",
    },
    resources: {
      title: "Teacher materials",
      description: "Materials shared with your enrolled classes.",
    },
    payments: {
      title: "Contact the seller",
      description:
        "Ask the class seller about availability and payment arrangements directly.",
    },
    payment: {
      title: "Contact the seller",
      description:
        "Ask the class seller about availability and payment arrangements directly.",
    },
  },
  parent: {
    reports: {
      title: "Learning & reports",
      description:
        "Lessons, attendance, homework and results for linked learners.",
    },
    children: {
      title: "Linked children learning",
      description:
        "Class schedules and progress for confirmed linked learners.",
    },
    payments: {
      title: "Contact the seller",
      description:
        "Ask the class seller about availability and payment arrangements directly.",
    },
    payment: {
      title: "Contact the seller",
      description:
        "Ask the class seller about availability and payment arrangements directly.",
    },
  },
  teacher: {
    classes: {
      title: "My classes",
      description:
        "Manage lessons, attendance and assessment records for classes you teach.",
    },
    homework: {
      title: "Homework marking",
      description: "Review and mark submissions from learners in your classes.",
    },
    students: {
      title: "Students & progress",
      description:
        "Review attendance, assessment and submitted homework in your classes.",
    },
    materials: {
      title: "Teaching materials",
      description:
        "Manage material references and review materials shared with your learners.",
    },
    questions: {
      title: "Class questions & answers",
      description: "Answer learner questions and follow class discussion.",
    },
    lessons: {
      title: "Lessons & calendar",
      description: "Schedule lessons and record attendance for your classes.",
    },
    calendar: {
      title: "Lessons calendar",
      description: "Schedule and review lessons for your classes.",
    },
    payments: {
      title: "Contact the seller",
      description:
        "Contact the teacher directly about class availability and arrangements.",
    },
    payment: {
      title: "Contact the seller",
      description:
        "Contact the teacher directly about class availability and arrangements.",
    },
  },
  guest: {
    payments: {
      title: "Contact the seller",
      description:
        "Ask the class seller about availability and payment arrangements directly.",
    },
    payment: {
      title: "Contact the seller",
      description:
        "Ask the class seller about availability and payment arrangements directly.",
    },
  },
};
export function supportsLearningSection(role: LearningRole, section: string) {
  return Boolean(sectionMeta[role][section]);
}

export async function readLearningSection(
  client: SupabaseClient,
  profile: CurrentProfile,
  role: LearningRole,
  section: string,
  classId?: string
): Promise<LearningPageData> {
  const meta = sectionMeta[role][section];
  if (!meta)
    throw new Error(
      "This learning section is not available for this account role."
    );
  const page: LearningPageData = {
    ...meta,
    records: [],
    classes: [],
    students: [],
    lessons: [],
    submissions: [],
  };
  const ownedClasses =
    role === "teacher"
      ? await rows(
          client,
          "classes",
          "id,title,learning_area_id,grade_id,is_active",
          q => q.eq("teacher_id", profile.id)
        )
      : [];
  const classIds =
    role === "teacher" ? ownedClasses.map(x => String(x.id)) : [];
  if (role === "teacher")
    page.classes = ownedClasses.map(x => ({
      id: String(x.id),
      title: text(x.title),
      detail: `Class ID ${x.id}`,
    }));

  if (
    role === "teacher" &&
    [
      "classes",
      "lessons",
      "calendar",
      "students",
      "homework",
      "questions",
    ].includes(section)
  ) {
    const lessons = classIds.length
      ? await rows(
          client,
          "lessons",
          "id,class_id,title,description,starts_at,ends_at",
          q =>
            q.in("class_id", classIds).order("starts_at", { ascending: true }),
          300
        )
      : [];
    const className = new Map(
      ownedClasses.map(x => [String(x.id), text(x.title)])
    );
    page.lessons = lessons.map(x => ({
      id: String(x.id),
      title: text(x.title),
      detail: className.get(String(x.class_id)),
      meta: `${readableDate(x.starts_at)}${x.ends_at ? ` – ${readableDate(x.ends_at)}` : ""}`,
      classId: String(x.class_id),
      lessonId: String(x.id),
    }));
    page.records =
      section === "classes"
        ? ownedClasses.map(x => ({
            id: String(x.id),
            title: text(x.title),
            detail: `Class ID ${x.id}`,
            meta: "Active class",
            classId: String(x.id),
          }))
        : page.lessons;
    if (classIds.length) {
      const enrolments = await rows(
        client,
        "enrolments",
        "class_id,student_id,status",
        q => q.in("class_id", classIds).in("status", ["active", "completed"]),
        300
      );
      const students = [...new Set(enrolments.map(x => String(x.student_id)))];
      const profiles = students.length
        ? await rows(
            client,
            "profiles",
            "id,full_name",
            q => q.in("id", students),
            300
          )
        : [];
      page.students = enrolments.map(x => ({
        id: String(x.student_id),
        title: text(
          profiles.find(p => String(p.id) === String(x.student_id))?.full_name,
          "Learner"
        ),
        detail: className.get(String(x.class_id)),
        classId: String(x.class_id),
        studentId: String(x.student_id),
      }));
      if (["students", "classes", "homework"].includes(section)) {
        const attendance = lessons.length
          ? await rows(
              client,
              "attendance",
              "lesson_id,student_id,status",
              q =>
                q.in(
                  "lesson_id",
                  lessons.map(x => String(x.id))
                ),
              500
            )
          : [];
        const scores = await rows(
          client,
          "scores",
          "class_id,student_id,assessment_type,score,max_score,percentage,assessed_on",
          q =>
            q
              .in("class_id", classIds)
              .order("assessed_on", { ascending: false }),
          500
        );
        const homework = await rows(
          client,
          "homework_submissions",
          "id,class_id,student_id,title,submitted_at,due_at,score,feedback",
          q =>
            q
              .in("class_id", classIds)
              .order("created_at", { ascending: false }),
          500
        );
        page.submissions = homework.map(item => ({
          id: String(item.id),
          title: text(item.title),
          detail: `${text(profiles.find(person => String(person.id) === String(item.student_id))?.full_name, "Learner")} · ${className.get(String(item.class_id)) ?? "Class"} · ${item.submitted_at ? "Submitted" : "Not submitted"}${item.score != null ? ` · Score ${item.score}` : ""}`,
          meta: `${item.due_at ? `Due ${readableDate(item.due_at)}` : "No due date"}${item.feedback ? ` · ${item.feedback}` : ""}`,
          classId: String(item.class_id),
          studentId: String(item.student_id),
          status: item.submitted_at ? "submitted" : "pending",
        }));
        const studentSummaries = page.students.map(s => {
          const st = attendance.filter(a => String(a.student_id) === s.id);
          const latest = scores.find(a => String(a.student_id) === s.id);
          const submitted = homework.filter(
            a => String(a.student_id) === s.id && a.submitted_at
          ).length;
          return {
            ...s,
            meta: `${st.filter(a => a.status === "present").length} present · ${st.filter(a => a.status === "absent").length} absent · ${latest ? `Latest: ${latest.percentage ?? latest.score ?? "recorded"}${latest.percentage != null ? "%" : ""}` : "No assessment yet"} · ${submitted} homework submission(s)`,
          };
        });
        if (section === "students") page.records = studentSummaries;
        if (section === "homework") page.records = page.submissions;
        page.note =
          "Only records visible through your teacher account and the database row-level security policies are shown.";
      }
    }
    if (section === "questions" && classIds.length) {
      const questions = await rows(
        client,
        "qa_questions",
        "id,title,body,class_id,created_at",
        q =>
          q.in("class_id", classIds).order("created_at", { ascending: false }),
        100
      );
      const answers = questions.length
        ? await rows(
            client,
            "qa_answers",
            "question_id,body,author_id,created_at",
            q =>
              q
                .in(
                  "question_id",
                  questions.map(x => String(x.id))
                )
                .order("created_at", { ascending: true }),
            250
          )
        : [];
      page.records = questions.map(q => ({
        id: String(q.id),
        title: text(q.title),
        detail: `${text(q.body)}${answers
          .filter(a => String(a.question_id) === String(q.id))
          .map(a => `\nAnswer: ${a.body}`)
          .join("")}`,
        meta: `${className.get(String(q.class_id))} · ${answers.filter(a => String(a.question_id) === String(q.id)).length} answer(s)`,
        classId: String(q.class_id),
        questionId: String(q.id),
      }));
    }
    page.note ??=
      "Teaching material files require a private storage upload; references can be recorded below. Homework creation is not available because the current database policy permits teacher marking but not teacher inserts.";
  }

  if (role === "student" || role === "parent") {
    let studentIds = [profile.id];
    if (role === "parent") {
      const links = await rows(
        client,
        "parent_student_links",
        "student_id,confirmed_at",
        q => q.eq("parent_id", profile.id).not("confirmed_at", "is", null),
        100
      );
      studentIds = links.map(x => String(x.student_id));
    }
    const enrolments = studentIds.length
      ? await rows(
          client,
          "enrolments",
          "id,class_id,student_id,status",
          q =>
            q
              .in("student_id", studentIds)
              .in("status", ["active", "completed"]),
          300
        )
      : [];
    const allowedClassIds = [
      ...new Set(enrolments.map(x => String(x.class_id))),
    ];
    const classes = allowedClassIds.length
      ? await rows(
          client,
          "classes",
          "id,title,teacher_id",
          q => q.in("id", allowedClassIds),
          150
        )
      : [];
    const className = new Map(classes.map(x => [String(x.id), text(x.title)]));
    page.classes = classes.map(x => ({
      id: String(x.id),
      title: text(x.title),
      classId: String(x.id),
    }));
    if (
      [
        "lessons",
        "calendar",
        "reports",
        "children",
        "classes",
        "homework",
        "quizzes",
      ].includes(section)
    ) {
      const lessons = allowedClassIds.length
        ? await rows(
            client,
            "lessons",
            "id,class_id,title,description,starts_at,ends_at",
            q =>
              q
                .in("class_id", allowedClassIds)
                .order("starts_at", { ascending: true }),
            300
          )
        : [];
      const lessonIds = lessons.map(x => String(x.id));
      const attendance =
        lessonIds.length && studentIds.length
          ? await rows(
              client,
              "attendance",
              "lesson_id,student_id,status",
              q => q.in("lesson_id", lessonIds).in("student_id", studentIds),
              500
            )
          : [];
      const homework = studentIds.length
        ? await rows(
            client,
            "homework_submissions",
            "id,class_id,student_id,title,instructions,due_at,submitted_at,score,feedback",
            q =>
              q
                .in("student_id", studentIds)
                .order("due_at", { ascending: true }),
            300
          )
        : [];
      const scores = studentIds.length
        ? await rows(
            client,
            "scores",
            "id,class_id,student_id,assessment_type,score,max_score,percentage,assessed_on,comment",
            q =>
              q
                .in("student_id", studentIds)
                .order("assessed_on", { ascending: false }),
            300
          )
        : [];
      const quizAttempts =
        studentIds.length && section === "quizzes"
          ? await rows(
              client,
              "quiz_attempts",
              "id,quiz_id,student_id,score,started_at,submitted_at",
              q =>
                q
                  .in("student_id", studentIds)
                  .order("started_at", { ascending: false }),
              200
            )
          : [];
      if (["homework", "quizzes"].includes(section)) {
        page.records = [
          ...homework.map(x => ({
            id: String(x.id),
            title: text(x.title),
            detail: `${text(x.instructions, "No instructions provided")} · ${x.submitted_at ? "Submitted" : "Not submitted"}${x.score != null ? ` · Score ${x.score}` : ""}`,
            meta: x.due_at
              ? `Due ${readableDate(x.due_at)}${x.feedback ? ` · ${x.feedback}` : ""}`
              : text(x.feedback, "No due date recorded"),
            classId: String(x.class_id),
            studentId: String(x.student_id),
          })),
          ...scores.map(x => ({
            id: String(x.id),
            title: text(x.assessment_type, "Assessment"),
            detail: `${text(x.score)}${x.max_score ? ` / ${x.max_score}` : ""}${x.percentage != null ? ` · ${x.percentage}%` : ""}`,
            meta: `${className.get(String(x.class_id)) ?? "Class"} · ${readableDate(x.assessed_on)}${x.comment ? ` · ${x.comment}` : ""}`,
            classId: String(x.class_id),
            studentId: String(x.student_id),
          })),
          ...quizAttempts.map(x => ({
            id: String(x.id),
            title: "Quiz attempt",
            detail: x.score == null ? "Score not recorded" : `Score ${x.score}`,
            meta: readableDate(x.submitted_at ?? x.started_at),
          })),
        ];
        page.note =
          "Homework rows can be submitted by learners enrolled in the class. The existing schema does not expose a separate teacher-created assignment table.";
      } else {
        page.records = lessons.map(x => {
          const marks = attendance.filter(
            a => String(a.lesson_id) === String(x.id)
          );
          return {
            id: String(x.id),
            title: text(x.title),
            detail: `${className.get(String(x.class_id))}${x.description ? ` · ${x.description}` : ""}`,
            meta: `${readableDate(x.starts_at)}${marks.length ? ` · attendance: ${marks.map(a => `${a.status}`).join(", ")}` : " · attendance not recorded"}`,
            classId: String(x.class_id),
            lessonId: String(x.id),
          };
        });
        if (section === "reports" || section === "children")
          page.records = [
            ...studentIds
              .filter(x => x !== profile.id)
              .map(id => ({
                id,
                title: "Linked learner",
                detail: `${enrolments.filter(e => String(e.student_id) === id).length} active or completed class enrolment(s)`,
                studentId: id,
              })),
            ...lessons.map(x => ({
              id: String(x.id),
              title: text(x.title),
              detail: `${className.get(String(x.class_id)) ?? "Class"} · ${readableDate(x.starts_at)}`,
              meta: (() => {
                const marks = attendance.filter(
                  a => String(a.lesson_id) === String(x.id)
                );
                return marks.length
                  ? `${marks.length} attendance mark(s): ${marks.map(a => a.status).join(", ")}`
                  : "Attendance not recorded";
              })(),
              classId: String(x.class_id),
              lessonId: String(x.id),
            })),
            ...scores.map(x => ({
              id: String(x.id),
              title: text(x.assessment_type, "Assessment"),
              detail: `${text(x.score)}${x.max_score ? ` / ${x.max_score}` : ""}${x.percentage != null ? ` · ${x.percentage}%` : ""}`,
              meta: `${className.get(String(x.class_id)) ?? "Class"} · ${readableDate(x.assessed_on)}${x.comment ? ` · ${x.comment}` : ""}`,
              classId: String(x.class_id),
              studentId: String(x.student_id),
            })),
            ...homework.map(x => ({
              id: String(x.id),
              title: text(x.title),
              detail: `${x.submitted_at ? "Submitted" : "Not submitted"}${x.score != null ? ` · Score ${x.score}` : ""}`,
              meta: className.get(String(x.class_id)),
              classId: String(x.class_id),
              studentId: String(x.student_id),
            })),
          ];
      }
    }
    if (section === "questions") {
      const ownQuestions = await rows(
        client,
        "qa_questions",
        "id,title,body,class_id,created_at",
        q =>
          q
            .in("asker_id", studentIds)
            .order("created_at", { ascending: false }),
        100
      );
      const classQuestions = allowedClassIds.length
        ? await rows(
            client,
            "qa_questions",
            "id,title,body,class_id,created_at",
            q =>
              q
                .in("class_id", allowedClassIds)
                .order("created_at", { ascending: false }),
            100
          )
        : [];
      const questions = [
        ...new Map(
          [...ownQuestions, ...classQuestions].map(q => [String(q.id), q])
        ).values(),
      ];
      const answers = questions.length
        ? await rows(
            client,
            "qa_answers",
            "question_id,body,created_at",
            q =>
              q
                .in(
                  "question_id",
                  questions.map(x => String(x.id))
                )
                .order("created_at", { ascending: true }),
            200
          )
        : [];
      page.records = questions.map(q => ({
        id: String(q.id),
        title: text(q.title),
        detail: `${text(q.body)}${answers
          .filter(a => String(a.question_id) === String(q.id))
          .map(a => `\nAnswer: ${a.body}`)
          .join("")}`,
        meta: `${q.class_id ? (className.get(String(q.class_id)) ?? "Class question") : "General question"} · ${readableDate(q.created_at)}`,
        classId: q.class_id ? String(q.class_id) : undefined,
        questionId: String(q.id),
      }));
    }
    if (section === "resources") {
      const shares = studentIds.length
        ? await rows(
            client,
            "material_shares",
            "material_id,class_id,student_id",
            q => q.in("student_id", studentIds),
            100
          )
        : [];
      const classShares = allowedClassIds.length
        ? await rows(
            client,
            "material_shares",
            "material_id,class_id,student_id",
            q => q.in("class_id", allowedClassIds),
            100
          )
        : [];
      const ids = [
        ...new Set([...shares, ...classShares].map(x => String(x.material_id))),
      ];
      const materials = ids.length
        ? await rows(
            client,
            "materials",
            "id,title,details,mime_type,created_at",
            q => q.in("id", ids),
            100
          )
        : [];
      page.records = materials.map(x => ({
        id: String(x.id),
        title: text(x.title),
        detail: text(x.details, text(x.mime_type, "Shared material")),
        meta: readableDate(x.created_at),
      }));
      page.note =
        "Private file download is not exposed in this portal; only shared material metadata is listed.";
    }
  }

  if (role === "teacher" && section === "materials") {
    const materials = await rows(
      client,
      "materials",
      "id,title,details,mime_type,created_at,file_path",
      q =>
        q
          .eq("teacher_id", profile.id)
          .order("created_at", { ascending: false }),
      100
    );
    page.records = materials.map(x => ({
      id: String(x.id),
      title: text(x.title),
      detail: text(x.details, text(x.mime_type, "Teaching material")),
      meta: `Added ${readableDate(x.created_at)} · private file reference stored`,
    }));
  }
  if (role === "teacher" && ["students", "classes"].includes(section)) {
    const classIds = ownedClasses.map(x => String(x.id));
    if (classIds.length) {
      const lessons = await rows(
        client,
        "lessons",
        "id,class_id,title,starts_at",
        q => q.in("class_id", classIds),
        300
      );
      const ids = lessons.map(x => String(x.id));
      const attendance = ids.length
        ? await rows(
            client,
            "attendance",
            "lesson_id,student_id,status",
            q => q.in("lesson_id", ids),
            500
          )
        : [];
      if (section === "students")
        page.records = page.students.map(s => ({
          ...s,
          detail: `${s.detail ?? "Class"} · ${attendance.filter(a => String(a.student_id) === s.id && a.status === "present").length} present mark(s)`,
        }));
    }
  }

  if (role === "teacher" && section === "questions" && !page.records.length)
    page.note =
      "Class questions visible to your teacher account will appear here.";
  if (["payment", "payments"].includes(section)) {
    const target = classId
      ? await rows(
          client,
          "classes",
          "id,title,teacher_id,is_published",
          q => q.eq("id", classId),
          1
        )
      : await rows(
          client,
          "classes",
          "id,title,teacher_id,is_published",
          q => q.eq("is_published", true).eq("is_active", true),
          100
        );
    const classRow = target[0];
    if (!classId && target.length) {
      page.records = target.map(klass => ({
        id: String(klass.id),
        title: text(klass.title),
        detail: "Published class listing",
        classId: String(klass.id),
      }));
      page.note =
        "Choose a published class to open a direct WhatsApp inquiry with its seller. This page does not take payments or create transactions.";
    } else if (
      classRow &&
      (classRow.is_published ||
        (role === "teacher" && classRow.teacher_id === profile.id))
    ) {
      const seller = await rows(
        client,
        "teacher_details",
        "profile_id,public_name,public_whatsapp",
        q => q.eq("profile_id", String(classRow.teacher_id)),
        1
      );
      const validContact = whatsappHref(
        seller[0]?.public_whatsapp,
        `Hello, I am enquiring about ${text(classRow.title, "your class")}. Please share availability and current class arrangements.`
      );
      page.whatsappHandoffHref = validContact
        ? (buildWhatsAppHandoffHref("class", String(classRow.id)) ?? undefined)
        : undefined;
      page.note =
        "The link records an aggregate WhatsApp handoff click. Lexify School does not see whether a message is sent or whether a sale is completed.";
      page.records = [
        {
          id: String(classRow.id),
          title: text(classRow.title),
          detail: text(seller[0]?.public_name, "Class seller"),
          meta: page.whatsappHandoffHref
            ? "Seller WhatsApp is available"
            : "Seller WhatsApp is not available",
        },
      ];
    } else {
      page.note =
        "Choose a published class listing to contact its seller. This page does not take payments or create transactions.";
    }
  }
  return page;
}
