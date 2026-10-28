import type { Metadata } from "next";
import { AdminOperationError, listAdminCourses } from "@/lib/admin/operations";
import { ContentManager, type AdminCourse } from "./content-manager";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Content manager" };
export default async function AdminContentPage() {
  let courses: AdminCourse[] = [];
  let error: string | null = null;
  try { courses = (await listAdminCourses()) as AdminCourse[]; }
  catch (cause) { error = cause instanceof AdminOperationError ? cause.message : "Course content could not be loaded. Check administrator database access and reload."; }
  return <div className="admin-page">
    <header className="admin-heading"><div><span className="admin-kicker">Operations · learning library</span><h1>Content manager</h1><p>Create and maintain courses, modules, and lessons. Publication is guarded by content readiness checks; archived content is retained.</p></div></header>
    <aside className="admin-warning"><strong>Content only</strong>This workspace manages learning content and publication status; linked learner records are retained.</aside>
    {error ? <div className="admin-empty" role="status">{error}</div> : <ContentManager courses={courses} />}
  </div>;
}
