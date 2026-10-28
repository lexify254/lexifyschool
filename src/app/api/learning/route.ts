import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isAccountSuspended } from "@/lib/auth/suspension";

export const dynamic = "force-dynamic";
type ActionBody = Record<string, unknown>;
const validId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
const cleanText = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const fail = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });
function dateValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}
async function currentUser() {
  const client = await getSupabaseServerClient();
  if (!client)
    return { client: null, user: null, role: null, suspended: false };
  const { data: auth, error } = await client.auth.getUser();
  if (error || !auth.user)
    return { client, user: null, role: null, suspended: false };
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id,role,is_suspended")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError || !profile)
    return { client, user: null, role: null, suspended: false };
  return {
    client,
    user: auth.user,
    role: String(profile.role),
    suspended: isAccountSuspended(profile),
  };
}
async function ownedClass(
  client: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  classId: string,
  teacherId: string
) {
  const { data, error } = await client
    .from("classes")
    .select("id,learning_area_id")
    .eq("id", classId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
export async function POST(request: Request) {
  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return fail("Request body must be valid JSON.");
  }
  const context = await currentUser();
  if (!context.client)
    return fail("Learning services are not configured.", 503);
  if (!context.user || !context.role)
    return fail("Sign in to use this learning action.", 401);
  if (context.suspended) return fail("Account access is suspended.", 403);
  const { client, user, role } = context;
  const action = cleanText(body.action, 40);
  try {
    if (action === "createLesson") {
      if (role !== "teacher")
        return fail("Only teachers can schedule lessons.", 403);
      if (!validId(body.classId)) return fail("Choose a valid class.");
      const title = cleanText(body.title, 160),
        startsAt = dateValue(body.startsAt),
        endsAt = body.endsAt ? dateValue(body.endsAt) : null;
      if (!title || !startsAt)
        return fail("Lesson title and a valid start date are required.");
      if (body.endsAt && !endsAt) return fail("End date is invalid.");
      const klass = await ownedClass(client, body.classId, user.id);
      if (!klass)
        return fail(
          "That class is not available to your teacher account.",
          403
        );
      const { data, error } = await client
        .from("lessons")
        .insert({
          class_id: body.classId,
          title,
          description: cleanText(body.description, 1000) || null,
          starts_at: startsAt,
          ends_at: endsAt,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error)
        return fail(`Lesson could not be saved: ${error.message}`, 403);
      return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
    }
    if (action === "markAttendance") {
      if (role !== "teacher")
        return fail("Only teachers can mark attendance.", 403);
      if (
        !validId(body.lessonId) ||
        !validId(body.studentId) ||
        !["present", "absent", "late", "excused"].includes(String(body.status))
      )
        return fail(
          "Lesson, learner, and a valid attendance status are required."
        );
      const { data: lesson, error: lessonError } = await client
        .from("lessons")
        .select("id,class_id")
        .eq("id", body.lessonId)
        .maybeSingle();
      if (lessonError || !lesson)
        return fail("Lesson is unavailable to your account.", 403);
      const klass = await ownedClass(client, String(lesson.class_id), user.id);
      if (!klass)
        return fail("You can only mark learners in classes you teach.", 403);
      const { data: enrolment, error: enrolmentError } = await client
        .from("enrolments")
        .select("id")
        .eq("class_id", lesson.class_id)
        .eq("student_id", body.studentId)
        .in("status", ["active", "completed"])
        .maybeSingle();
      if (enrolmentError || !enrolment)
        return fail("This learner is not enrolled in the lesson's class.", 403);
      const { error } = await client.from("attendance").upsert(
        {
          lesson_id: body.lessonId,
          student_id: body.studentId,
          status: body.status,
          marked_by: user.id,
          comment: cleanText(body.comment, 500) || null,
        },
        { onConflict: "lesson_id,student_id" }
      );
      if (error) return fail(`Attendance was not saved: ${error.message}`, 403);
      return NextResponse.json({ ok: true });
    }
    if (action === "recordAssessment") {
      if (role !== "teacher")
        return fail("Only teachers can record class assessments.", 403);
      if (!validId(body.classId) || !validId(body.studentId))
        return fail("Choose a class and learner.");
      const title = cleanText(body.assessmentType, 100),
        score = Number(body.score),
        maxScore = Number(body.maxScore);
      if (
        !title ||
        !Number.isFinite(score) ||
        !Number.isFinite(maxScore) ||
        score < 0 ||
        maxScore <= 0 ||
        score > maxScore
      )
        return fail(
          "Enter an assessment name and a score from zero up to the maximum score."
        );
      const klass = await ownedClass(client, body.classId, user.id);
      if (!klass)
        return fail(
          "That class is not available to your teacher account.",
          403
        );
      const { data: enrolment, error: enrolError } = await client
        .from("enrolments")
        .select("id")
        .eq("class_id", body.classId)
        .eq("student_id", body.studentId)
        .in("status", ["active", "completed"])
        .maybeSingle();
      if (enrolError || !enrolment)
        return fail("The learner is not enrolled in this class.", 403);
      const { error } = await client.from("scores").insert({
        class_id: body.classId,
        student_id: body.studentId,
        learning_area_id: klass.learning_area_id,
        assessment_type: title,
        score,
        max_score: maxScore,
        percentage: Math.round((score / maxScore) * 10000) / 100,
        comment: cleanText(body.comment, 1000) || null,
        entered_by: user.id,
      });
      if (error) return fail(`Assessment was not saved: ${error.message}`, 403);
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    if (action === "submitHomework") {
      if (role !== "student")
        return fail(
          "Homework submissions are available to learner accounts only.",
          403
        );
      if (!validId(body.classId)) return fail("Choose a valid class.");
      const title = cleanText(body.title, 160),
        instructions = cleanText(body.instructions, 3000);
      if (!title || !instructions)
        return fail("Homework title and your written response are required.");
      const dueAt = body.dueAt ? dateValue(body.dueAt) : null;
      if (body.dueAt && !dueAt) return fail("Due date is invalid.");
      const { data: membership, error: membershipError } = await client
        .from("enrolments")
        .select("id")
        .eq("class_id", body.classId)
        .eq("student_id", user.id)
        .in("status", ["active", "completed"])
        .maybeSingle();
      if (membershipError || !membership)
        return fail("You are not enrolled in this class.", 403);
      const { error } = await client.from("homework_submissions").insert({
        class_id: body.classId,
        student_id: user.id,
        title,
        instructions,
        due_at: dueAt,
        submitted_at: new Date().toISOString(),
      });
      if (error)
        return fail(`Homework could not be submitted: ${error.message}`, 403);
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    if (action === "addMaterial") {
      if (role !== "teacher")
        return fail("Only teachers can add teaching materials.", 403);
      const title = cleanText(body.title, 160);
      let filePath = cleanText(body.filePath, 500);
      if (!title || !filePath)
        return fail(
          "Material title and an existing private file name are required."
        );
      if (!filePath.includes("/")) filePath = `${user.id}/${filePath}`;
      if (
        !filePath.startsWith(`${user.id}/`) ||
        filePath.includes("..") ||
        filePath.startsWith("/")
      )
        return fail(
          "File reference must point to a file in your own private storage folder."
        );
      const classId =
        body.classId == null || body.classId === "" ? null : body.classId;
      if (classId && !validId(classId))
        return fail("Choose a valid class to share this material with.");
      if (classId && !(await ownedClass(client, String(classId), user.id)))
        return fail("You can only share material with a class you teach.", 403);
      const { data: material, error } = await client
        .from("materials")
        .insert({
          teacher_id: user.id,
          title,
          details: cleanText(body.details, 1000) || null,
          file_path: filePath,
          mime_type: cleanText(body.mimeType, 100) || null,
        })
        .select("id")
        .single();
      if (error || !material)
        return fail(
          `Material reference was not saved: ${error?.message ?? "No material ID returned"}`,
          403
        );
      if (classId) {
        const { error: shareError } = await client
          .from("material_shares")
          .insert({ material_id: material.id, class_id: classId });
        if (shareError)
          return fail(
            `Material was recorded but could not be shared: ${shareError.message}`,
            403
          );
      }
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    if (action === "askQuestion") {
      if (role !== "student")
        return fail("Questions can be submitted by student accounts.", 403);
      const title = cleanText(body.title, 160),
        question = cleanText(body.body, 3000);
      if (!title || !question)
        return fail("Question title and message are required.");
      const classId =
        body.classId == null || body.classId === "" ? null : body.classId;
      if (classId && !validId(classId)) return fail("Choose a valid class.");
      if (classId) {
        const { data: enrolment, error } = await client
          .from("enrolments")
          .select("id")
          .eq("class_id", classId)
          .eq("student_id", user.id)
          .in("status", ["active", "completed"])
          .maybeSingle();
        if (error || !enrolment)
          return fail("You are not enrolled in this class.", 403);
      }
      const { error } = await client.from("qa_questions").insert({
        asker_id: user.id,
        title,
        body: question,
        visibility: classId ? "class" : "public",
        class_id: classId,
      });
      if (error)
        return fail(`Question could not be saved: ${error.message}`, 403);
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    if (action === "answerQuestion") {
      if (role !== "teacher")
        return fail("Only teachers can answer class questions.", 403);
      if (!validId(body.questionId)) return fail("Choose a valid question.");
      const answer = cleanText(body.body, 3000);
      if (!answer) return fail("Answer text is required.");
      const { data: question, error: questionError } = await client
        .from("qa_questions")
        .select("id,class_id")
        .eq("id", body.questionId)
        .maybeSingle();
      if (questionError || !question?.class_id)
        return fail("Question is unavailable to your account.", 403);
      const klass = await ownedClass(
        client,
        String(question.class_id),
        user.id
      );
      if (!klass)
        return fail(
          "You can only answer questions for a class you teach.",
          403
        );
      const { error } = await client.from("qa_answers").insert({
        question_id: body.questionId,
        author_id: user.id,
        body: answer,
      });
      if (error)
        return fail(`Answer could not be saved: ${error.message}`, 403);
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    if (action === "markHomework") {
      if (role !== "teacher")
        return fail("Only teachers can mark class homework.", 403);
      if (!validId(body.submissionId))
        return fail("Choose a valid homework submission.");
      const score = Number(body.score);
      if (!Number.isFinite(score) || score < 0)
        return fail("Enter a non-negative score.");
      const { data: submission, error: submissionError } = await client
        .from("homework_submissions")
        .select("id,class_id,submitted_at")
        .eq("id", body.submissionId)
        .not("submitted_at", "is", null)
        .maybeSingle();
      if (submissionError || !submission)
        return fail(
          "Submitted homework is unavailable to your teacher account.",
          403
        );
      if (!(await ownedClass(client, String(submission.class_id), user.id)))
        return fail(
          "You can only mark homework submitted in a class you teach.",
          403
        );
      const { data, error } = await client
        .from("homework_submissions")
        .update({
          score,
          feedback: cleanText(body.feedback, 1000) || null,
          marked_by: user.id,
        })
        .eq("id", body.submissionId)
        .select("id")
        .maybeSingle();
      if (error || !data)
        return fail(
          `Homework mark was not saved: ${error?.message ?? "No submission was updated"}`,
          403
        );
      return NextResponse.json({ ok: true });
    }
    if (action === "createHomework")
      return fail(
        "Teacher assignment creation is not enabled by the current database schema. No homework item was created.",
        409
      );
    return fail("Unknown learning action.");
  } catch (error) {
    return fail(
      `Learning action failed: ${error instanceof Error ? error.message : "Unexpected server error"}`,
      500
    );
  }
}
