"use client";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type LessonType = "video" | "text" | "document" | "practice_file" | "quiz" | "assignment";
export type AdminLesson = { id: string; title: string; lesson_type: LessonType; sort_order: number; estimated_minutes: number | null; is_free_preview: boolean; is_published: boolean };
export type AdminModule = { id: string; title: string; description: string | null; sort_order: number; lessons: AdminLesson[] };
export type AdminCourse = { id: string; code: string; title: string; description: string | null; icon_name: string; accent_color: string; level: string | null; duration_minutes: number | null; status: "draft" | "published" | "archived"; published_at: string | null; modules: AdminModule[] };
type FormRender = (state: { pending: boolean; message: string; ok: boolean }) => ReactNode;
function ApiForm({ url, method = "POST", prepare, children, className = "admin-form", onSaved }: { url: string; method?: string; prepare: (data: FormData) => unknown; children: FormRender; className?: string; onSaved?: () => void }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState(""); const [ok, setOk] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    try {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(prepare(new FormData(event.currentTarget))) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "The change could not be saved.");
      setOk(true); setMessage("Saved."); onSaved?.(); router.refresh();
    } catch (error) { setOk(false); setMessage(error instanceof Error ? error.message : "The change could not be saved."); }
    finally { setPending(false); }
  }
  return <form className={className} onSubmit={submit}>{children({ pending, message, ok })}</form>;
}
function Field({ label, name, defaultValue = "", type = "text", required = false, maxLength, min, max, wide = false }: { label: string; name: string; defaultValue?: string | number; type?: string; required?: boolean; maxLength?: number; min?: number; max?: number; wide?: boolean }) {
  const id = useId();
  return <div className={`admin-field${wide ? " admin-field--wide" : ""}`}><label htmlFor={id}>{label}</label><input id={id} name={name} type={type} defaultValue={defaultValue} required={required} maxLength={maxLength} min={min} max={max} /></div>;
}
function TextArea({ label, name, defaultValue = "", rows = 3 }: { label: string; name: string; defaultValue?: string; rows?: number }) {
  const id = useId();
  return <div className="admin-field admin-field--wide"><label htmlFor={id}>{label}</label><textarea id={id} name={name} defaultValue={defaultValue} rows={rows} /></div>;
}
function Feedback({ state }: { state: { pending: boolean; message: string; ok: boolean } }) { return state.message ? <p className="admin-form-message" data-ok={state.ok ? "true" : "false"} role="status">{state.message}</p> : null; }
function values(data: FormData) { return Object.fromEntries(data.entries()); }
function ActionButton({ url, method, body, children, danger = false }: { url: string; method: string; body?: unknown; children: string; danger?: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState(""); const [ok, setOk] = useState(false);
  async function run() {
    if (method === "DELETE" && !window.confirm("Delete this eligible unpublished record? This cannot be undone.")) return;
    if (method === "PATCH" && !window.confirm("Change this content status?")) return;
    setPending(true); setMessage("");
    try { const response = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "The change could not be completed."); setOk(true); setMessage("Change saved."); router.refresh(); }
    catch (error) { setOk(false); setMessage(error instanceof Error ? error.message : "The change could not be completed."); }
    finally { setPending(false); }
  }
  return <span className="admin-action"><button type="button" className={`admin-submit${danger ? " admin-submit--danger" : " admin-submit--quiet"}`} onClick={run} disabled={pending}>{pending ? "Saving…" : children}</button>{message && <small className="admin-action__message" data-ok={ok ? "true" : "false"} role="status">{message}</small>}</span>;
}
function LessonCard({ lesson }: { lesson: AdminLesson }) {
  const [editing, setEditing] = useState(false);
  const [contentText, setContentText] = useState("");
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!editing || contentText) return;
    let current = true;
    fetch(`/api/admin/lessons/${lesson.id}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Lesson content could not be loaded.");
      return JSON.stringify(body.data.content ?? {}, null, 2);
    }).then((content) => { if (current) { setContentText(content); setLoadError(""); } }).catch((error) => { if (current) setLoadError(error instanceof Error ? error.message : "Lesson content could not be loaded."); });
    return () => { current = false; };
  }, [editing, contentText, lesson.id, retry]);
  const initialContent = contentText || "{}";
  return <article className="admin-content-leaf">
    <div className="admin-record__head"><div><h4>{lesson.title}</h4><p>{lesson.lesson_type} · {lesson.is_published ? "Published" : "Draft"}{lesson.is_free_preview ? " · free preview" : ""}</p></div><div className="admin-course__actions"><button type="button" className="admin-submit admin-submit--quiet" onClick={() => setEditing((value) => !value)}>{editing ? "Close editor" : "Edit lesson"}</button><ActionButton url={`/api/admin/lessons/${lesson.id}`} method="DELETE" danger>Delete draft lesson</ActionButton></div></div>
    {editing && (loadError ? <div className="admin-empty" role="status">{loadError} <button type="button" className="admin-submit admin-submit--quiet" onClick={() => setRetry((value) => value + 1)}>Retry</button></div> : !contentText ? <p className="admin-empty" role="status">Loading lesson content…</p> : <ApiForm url={`/api/admin/lessons/${lesson.id}`} method="PATCH" className="admin-form admin-form--content" prepare={(data) => ({ ...values(data), sort_order: Number(data.get("sort_order")), estimated_minutes: data.get("estimated_minutes") ? Number(data.get("estimated_minutes")) : null, is_free_preview: data.get("is_free_preview") === "on", is_published: data.get("is_published") === "on", content: JSON.parse(String(data.get("content") || "{}")) })}>
      {(state) => <><Field label="Lesson title" name="title" defaultValue={lesson.title} required maxLength={160} /><div className="admin-field"><label htmlFor={`type-${lesson.id}`}>Type</label><select id={`type-${lesson.id}`} name="lesson_type" defaultValue={lesson.lesson_type}>{["video", "text", "document", "practice_file", "quiz", "assignment"].map((type) => <option key={type}>{type}</option>)}</select></div><Field label="Position" name="sort_order" type="number" defaultValue={lesson.sort_order} min={0} max={100000} /><Field label="Minutes" name="estimated_minutes" type="number" defaultValue={lesson.estimated_minutes ?? ""} min={1} max={10080} /><TextArea label="Content JSON" name="content" defaultValue={initialContent} rows={5} /><label className="admin-check"><input type="checkbox" name="is_free_preview" defaultChecked={lesson.is_free_preview} /> Free preview</label><label className="admin-check"><input type="checkbox" name="is_published" defaultChecked={lesson.is_published} /> Published</label><button className="admin-submit" disabled={state.pending}>{state.pending ? "Saving…" : "Save lesson"}</button><Feedback state={state} /></>}
    </ApiForm>)}
  </article>;
}
function ModuleCard({ module }: { module: AdminModule }) {
  return <article className="admin-content-module"><div className="admin-record__head"><div><h3>{module.title}</h3><p>{module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}</p></div><ActionButton url={`/api/admin/modules/${module.id}`} method="DELETE" danger>Delete empty module</ActionButton></div>
    <ApiForm url={`/api/admin/modules/${module.id}`} method="PATCH" className="admin-form admin-form--content" prepare={(data) => ({ ...values(data), sort_order: Number(data.get("sort_order")) })}>
      {(state) => <><Field label="Module title" name="title" defaultValue={module.title} required maxLength={160} /><Field label="Position" name="sort_order" type="number" defaultValue={module.sort_order} min={0} max={100000} /><TextArea label="Description" name="description" defaultValue={module.description ?? ""} /><button className="admin-submit" disabled={state.pending}>{state.pending ? "Saving…" : "Save module"}</button><Feedback state={state} /></>}
    </ApiForm>
    <div className="admin-content-lessons">{module.lessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} />)}{!module.lessons.length && <p className="admin-empty">No lessons yet. Add the first lesson below.</p>}</div>
    <ApiForm url={`/api/admin/modules/${module.id}/lessons`} className="admin-form admin-form--content admin-form--new" prepare={(data) => ({ ...values(data), sort_order: Number(data.get("sort_order") || 0), estimated_minutes: data.get("estimated_minutes") ? Number(data.get("estimated_minutes")) : null, content: {}, is_published: false, is_free_preview: false })}>
      {(state) => <><h4 className="admin-form-title">Add lesson</h4><Field label="Title" name="title" required maxLength={160} /><div className="admin-field"><label htmlFor={`new-type-${module.id}`}>Type</label><select id={`new-type-${module.id}`} name="lesson_type" defaultValue="text">{["video", "text", "document", "practice_file", "quiz", "assignment"].map((type) => <option key={type}>{type}</option>)}</select></div><Field label="Position" name="sort_order" type="number" defaultValue={module.lessons.length} min={0} max={100000} /><Field label="Minutes" name="estimated_minutes" type="number" min={1} max={10080} /><button className="admin-submit" disabled={state.pending}>{state.pending ? "Adding…" : "Add draft lesson"}</button><Feedback state={state} /></>}
    </ApiForm>
  </article>;
}
function CourseCard({ course }: { course: AdminCourse }) {
  return <details className="admin-record admin-course" open={course.status !== "archived"}><summary className="admin-course__summary"><span><strong>{course.title}</strong><small>{course.code} · {course.modules.length} module{course.modules.length === 1 ? "" : "s"}</small></span><span className={`admin-status admin-status--${course.status}`}>{course.status}</span></summary>
    <div className="admin-course__body"><div className="admin-course__actions">{course.status !== "published" && <ActionButton url={`/api/admin/courses/${course.id}/status`} method="PATCH" body={{ status: "published" }}>Publish</ActionButton>}{course.status !== "draft" && <ActionButton url={`/api/admin/courses/${course.id}/status`} method="PATCH" body={{ status: "draft" }}>Return to draft</ActionButton>}{course.status !== "archived" && <ActionButton url={`/api/admin/courses/${course.id}/status`} method="PATCH" body={{ status: "archived" }}>Archive</ActionButton>}<small>Courses are retained; archive rather than delete.</small></div>
      <ApiForm url={`/api/admin/courses/${course.id}`} method="PATCH" className="admin-form admin-form--content" prepare={(data) => ({ ...values(data), duration_minutes: data.get("duration_minutes") ? Number(data.get("duration_minutes")) : null })}>
        {(state) => <><h3 className="admin-form-title">Course details</h3><Field label="Code" name="code" defaultValue={course.code} required maxLength={60} /><Field label="Title" name="title" defaultValue={course.title} required maxLength={160} /><Field label="Level" name="level" defaultValue={course.level ?? ""} maxLength={40} /><Field label="Duration (minutes)" name="duration_minutes" type="number" defaultValue={course.duration_minutes ?? ""} min={1} max={10080} /><Field label="Icon name" name="icon_name" defaultValue={course.icon_name} maxLength={40} /><Field label="Accent color" name="accent_color" type="color" defaultValue={course.accent_color} /><TextArea label="Description" name="description" defaultValue={course.description ?? ""} /><button className="admin-submit" disabled={state.pending}>{state.pending ? "Saving…" : "Save course"}</button><Feedback state={state} /></>}
      </ApiForm>
      <section className="admin-content-modules"><h3 className="admin-section-title">Modules and lessons</h3>{course.modules.map((module) => <ModuleCard key={module.id} module={module} />)}{!course.modules.length && <p className="admin-empty">No modules yet. A course needs a module and a published lesson before it can be published.</p>}
        <ApiForm url={`/api/admin/courses/${course.id}/modules`} className="admin-form admin-form--content admin-form--new" prepare={(data) => ({ ...values(data), sort_order: Number(data.get("sort_order") || 0) })}>
          {(state) => <><h4 className="admin-form-title">Add module</h4><Field label="Title" name="title" required maxLength={160} /><Field label="Position" name="sort_order" type="number" defaultValue={course.modules.length} min={0} max={100000} /><TextArea label="Description" name="description" /><button className="admin-submit" disabled={state.pending}>{state.pending ? "Adding…" : "Add module"}</button><Feedback state={state} /></>}
        </ApiForm>
      </section>
    </div>
  </details>;
}
export function ContentManager({ courses }: { courses: AdminCourse[] }) {
  return <>
    <ApiForm url="/api/admin/courses" className="admin-record admin-form admin-form--content admin-course-create" prepare={(data) => ({ ...values(data), duration_minutes: data.get("duration_minutes") ? Number(data.get("duration_minutes")) : null })}>
      {(state) => <><h2 className="admin-form-title">Create a course draft</h2><Field label="Code" name="code" required maxLength={60} /><Field label="Title" name="title" required maxLength={160} /><Field label="Level" name="level" maxLength={40} /><Field label="Duration (minutes)" name="duration_minutes" type="number" min={1} max={10080} /><Field label="Icon name" name="icon_name" defaultValue="FileText" maxLength={40} /><Field label="Accent color" name="accent_color" type="color" defaultValue="#2563eb" /><TextArea label="Description" name="description" /><button className="admin-submit" disabled={state.pending}>{state.pending ? "Creating…" : "Create draft"}</button><Feedback state={state} /></>}
    </ApiForm>
    <section aria-label="Course content"><h2 className="admin-section-title">Courses <span className="admin-count">{courses.length}</span></h2>{courses.length ? courses.map((course) => <CourseCard key={course.id} course={course} />) : <div className="admin-empty">No course records are available. Create the first course draft above.</div>}</section>
  </>;
}
