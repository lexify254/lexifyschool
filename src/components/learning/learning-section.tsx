"use client";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  LearningPageData,
  LearningRecord,
  LearningRole,
} from "@/lib/data/learning";
import styles from "./learning.module.css";

function ActionForm({
  title,
  action,
  fields,
  defaults = {},
  submitLabel = "Save",
  onSuccess,
}: {
  title: string;
  action: string;
  fields: {
    name: string;
    label: string;
    type?: string;
    required?: boolean;
    options?: { value: string; label: string }[];
    placeholder?: string;
  }[];
  defaults?: Record<string, string>;
  submitLabel?: string;
  onSuccess: () => void;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload: Record<string, string> = { action };
    fields.forEach(
      field => (payload[field.name] = String(form.get(field.name) ?? ""))
    );
    try {
      const response = await fetch("/api/learning", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not save this learning record.");
        return;
      }
      formElement.reset();
      onSuccess();
    } catch {
      setError(
        "The learning service could not be reached. Check your connection and try again."
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <h3>{title}</h3>
      {fields.map(field => (
        <label key={field.name}>
          {field.label}
          {field.options ? (
            <select
              name={field.name}
              required={field.required}
              defaultValue={defaults[field.name] ?? ""}
            >
              <option value="">Choose…</option>
              {field.options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={field.name}
              type={field.type ?? "text"}
              required={field.required}
              placeholder={field.placeholder}
              min={field.type === "number" ? "0" : undefined}
              step={field.type === "number" ? "any" : undefined}
            />
          )}
        </label>
      ))}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <button className="button button--blue" type="submit" disabled={saving}>
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
function ClassOptions({
  classes,
  label = "Class",
}: {
  classes: LearningRecord[];
  label?: string;
}) {
  return [
    { value: "", label: "Choose a class…" },
    ...classes.map(item => ({ value: item.id, label: item.title })),
  ];
}
function LearnerOptions({
  students,
  classId,
}: {
  students: LearningRecord[];
  classId?: string;
}) {
  return students
    .filter(item => !classId || item.classId === classId)
    .map(item => ({
      value: item.id,
      label: `${item.title}${item.detail ? ` · ${item.detail}` : ""}`,
    }));
}

export function LearningSection({
  role,
  section,
  data,
}: {
  role: LearningRole;
  section: string;
  data: LearningPageData;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const classOptions = useMemo(
    () => ClassOptions({ classes: data.classes }).slice(1),
    [data.classes]
  );
  const lessonOptions = useMemo(
    () =>
      data.lessons.map(record => ({
        value: record.lessonId ?? record.id,
        label: `${record.title} · ${record.meta ?? ""}`,
      })),
    [data.lessons]
  );
  const questionOptions = useMemo(
    () =>
      data.records
        .filter(record => record.questionId)
        .map(record => ({ value: record.questionId!, label: record.title })),
    [data.records]
  );
  const studentRecord = role === "student";
  const teacher = role === "teacher";
  const sellerContact = section === "payment" || section === "payments";
  return (
    <>
      <header className={styles.heading}>
        <span>{role} portal</span>
        <h1>{data.title}</h1>
        <p>{data.description}</p>
      </header>
      {data.note ? (
        <aside className={styles.note} role="note">
          {data.note}
        </aside>
      ) : null}
      {sellerContact ? (
        <section className={styles.panel}>
          <h2>Talk to the class seller</h2>
          <p>
            Use the seller’s WhatsApp to ask about availability and current
            arrangements. Lexify records an outbound handoff click only; it does
            not see whether a message is sent or a sale is completed.
          </p>
          {data.whatsappHandoffHref ? (
            <a
              className="button button--blue"
              href={data.whatsappHandoffHref}
              target="_blank"
              rel="noreferrer"
            >
              Continue to seller WhatsApp
            </a>
          ) : (
            <p className={styles.muted}>
              No seller contact link is available for the selected listing.
            </p>
          )}
        </section>
      ) : null}
      {teacher &&
      (section === "classes" ||
        section === "lessons" ||
        section === "calendar") ? (
        <section className={styles.panel}>
          <h2>Schedule a lesson</h2>
          <ActionForm
            title="New class lesson"
            action="createLesson"
            onSuccess={refresh}
            fields={[
              {
                name: "classId",
                label: "Class",
                required: true,
                options: classOptions,
              },
              { name: "title", label: "Lesson title", required: true },
              { name: "description", label: "Description" },
              {
                name: "startsAt",
                label: "Starts",
                type: "datetime-local",
                required: true,
              },
              {
                name: "endsAt",
                label: "Ends (optional)",
                type: "datetime-local",
              },
            ]}
          />
        </section>
      ) : null}
      {teacher &&
      (section === "classes" || section === "students") &&
      data.students.length ? (
        <section className={styles.panel}>
          <h2>Record an assessment</h2>
          <ActionForm
            title="Assessment result"
            action="recordAssessment"
            onSuccess={refresh}
            fields={[
              {
                name: "classId",
                label: "Class",
                required: true,
                options: classOptions,
              },
              {
                name: "studentId",
                label: "Learner",
                required: true,
                options: LearnerOptions({ students: data.students }),
              },
              { name: "assessmentType", label: "Assessment", required: true },
              { name: "score", label: "Score", type: "number", required: true },
              {
                name: "maxScore",
                label: "Maximum score",
                type: "number",
                required: true,
              },
              { name: "comment", label: "Comment" },
            ]}
          />
        </section>
      ) : null}
      {teacher &&
      (section === "classes" || section === "students") &&
      lessonOptions.length &&
      data.students.length ? (
        <section className={styles.panel}>
          <h2>Mark attendance</h2>
          <ActionForm
            title="Attendance record"
            action="markAttendance"
            onSuccess={refresh}
            fields={[
              {
                name: "lessonId",
                label: "Lesson",
                required: true,
                options: lessonOptions,
              },
              {
                name: "studentId",
                label: "Learner",
                required: true,
                options: LearnerOptions({ students: data.students }),
              },
              {
                name: "status",
                label: "Attendance",
                required: true,
                options: ["present", "absent", "late", "excused"].map(
                  value => ({
                    value,
                    label: value[0].toUpperCase() + value.slice(1),
                  })
                ),
              },
              { name: "comment", label: "Comment (optional)" },
            ]}
          />
        </section>
      ) : null}
      {teacher && section === "homework" ? (
        <section className={styles.panel}>
          <h2>Mark learner homework</h2>
          {data.submissions.some(item => item.status === "submitted") ? (
            <ActionForm
              title="Submission mark"
              action="markHomework"
              onSuccess={refresh}
              fields={[
                {
                  name: "submissionId",
                  label: "Submitted homework",
                  required: true,
                  options: data.submissions
                    .filter(item => item.status === "submitted")
                    .map(item => ({
                      value: item.id,
                      label: `${item.title} · ${item.detail ?? "Learner"}`,
                    })),
                },
                {
                  name: "score",
                  label: "Score",
                  type: "number",
                  required: true,
                },
                { name: "feedback", label: "Feedback (optional)" },
              ]}
            />
          ) : (
            <p>No submitted homework is currently available to mark.</p>
          )}
        </section>
      ) : null}
      {teacher && section === "materials" ? (
        <section className={styles.panel}>
          <h2>Add teaching material reference</h2>
          <p>
            Use a file already stored in your private materials bucket; this
            form does not upload files. A selected class receives a share record
            under the database's class-access policy.
          </p>
          <ActionForm
            title="Material details"
            action="addMaterial"
            onSuccess={refresh}
            fields={[
              { name: "title", label: "Title", required: true },
              { name: "details", label: "Description" },
              {
                name: "filePath",
                label: "Private file name or path",
                required: true,
                placeholder: "worksheet.pdf",
              },
              {
                name: "mimeType",
                label: "File type (optional)",
                placeholder: "application/pdf",
              },
              {
                name: "classId",
                label: "Share with class (optional)",
                options: classOptions,
              },
            ]}
          />
        </section>
      ) : null}
      {teacher && section === "questions" && questionOptions.length ? (
        <section className={styles.panel}>
          <h2>Answer a question</h2>
          <ActionForm
            title="Teacher response"
            action="answerQuestion"
            onSuccess={refresh}
            fields={[
              {
                name: "questionId",
                label: "Question",
                required: true,
                options: questionOptions,
              },
              { name: "body", label: "Answer", required: true },
            ]}
          />
        </section>
      ) : null}
      {studentRecord && section === "homework" && classOptions.length ? (
        <section className={styles.panel}>
          <h2>Submit homework</h2>
          <p>
            Text responses are saved as submissions; file uploads are not
            available here.
          </p>
          <ActionForm
            title="Your homework response"
            action="submitHomework"
            onSuccess={refresh}
            fields={[
              {
                name: "classId",
                label: "Class",
                required: true,
                options: classOptions,
              },
              { name: "title", label: "Homework title", required: true },
              {
                name: "instructions",
                label: "Your written response",
                required: true,
              },
              {
                name: "dueAt",
                label: "Due date (optional)",
                type: "datetime-local",
              },
            ]}
            submitLabel="Submit homework"
          />
        </section>
      ) : null}
      {studentRecord && section === "questions" ? (
        <section className={styles.panel}>
          <h2>Ask a learning question</h2>
          <ActionForm
            title="New question"
            action="askQuestion"
            onSuccess={refresh}
            fields={[
              { name: "title", label: "Question title", required: true },
              { name: "body", label: "Question", required: true },
              {
                name: "classId",
                label: "Class (optional)",
                options: classOptions,
              },
            ]}
            submitLabel="Ask question"
          />
        </section>
      ) : null}
      {data.records.length ? (
        <section className={styles.records} aria-live="polite">
          <h2>
            {section === "questions"
              ? "Questions and answers"
              : section === "students"
                ? "Learners in your classes"
                : section === "materials"
                  ? "Your materials"
                  : "Learning records"}
          </h2>
          <ul>
            {data.records.map((record, index) => (
              <li key={`${record.id}-${index}`}>
                <strong>{record.title}</strong>
                {record.detail ? <span>{record.detail}</span> : null}
                {record.meta ? <small>{record.meta}</small> : null}
                {sellerContact &&
                record.classId &&
                !data.whatsappHandoffHref ? (
                  <Link
                    className="button button--line button--small"
                    href={`/${role}/payments?classId=${encodeURIComponent(record.classId)}`}
                  >
                    Contact this seller
                  </Link>
                ) : null}
                {teacher && record.lessonId && data.students.length ? (
                  <div className={styles.inlineAction}>
                    <ActionForm
                      title={`Mark attendance · ${record.title}`}
                      action="markAttendance"
                      onSuccess={refresh}
                      fields={[
                        {
                          name: "lessonId",
                          label: "Lesson",
                          required: true,
                          options: [
                            { value: record.lessonId, label: record.title },
                          ],
                        },
                        {
                          name: "studentId",
                          label: "Learner",
                          required: true,
                          options: LearnerOptions({
                            students: data.students,
                            classId: record.classId,
                          }),
                        },
                        {
                          name: "status",
                          label: "Status",
                          required: true,
                          options: ["present", "absent", "late", "excused"].map(
                            value => ({ value, label: value })
                          ),
                        },
                      ]}
                    />
                  </div>
                ) : null}
                {studentRecord &&
                section === "homework" &&
                !record.detail?.includes("Submitted") &&
                record.classId ? (
                  <div className={styles.inlineAction}>
                    <ActionForm
                      title="Submit this homework"
                      action="submitHomework"
                      onSuccess={refresh}
                      fields={[
                        {
                          name: "classId",
                          label: "Class",
                          required: true,
                          options: [
                            {
                              value: record.classId,
                              label: record.meta ?? "Enrolled class",
                            },
                          ],
                        },
                        {
                          name: "title",
                          label: "Homework title",
                          required: true,
                          placeholder: record.title,
                        },
                        {
                          name: "instructions",
                          label: "Your response",
                          required: true,
                        },
                      ]}
                      submitLabel="Submit response"
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : !sellerContact ? (
        <div className={styles.empty}>
          <h2>No learning records yet</h2>
          <p>
            Nothing is currently visible to your signed-in account in this
            section.
          </p>
        </div>
      ) : null}
      <div className={styles.footer}>
        <Link href={`/${role}/dashboard`} className="button button--line">
          Back to overview
        </Link>
      </div>
    </>
  );
}
