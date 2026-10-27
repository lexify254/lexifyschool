import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GradeEditor, LearningAreaEditor, SystemEditor } from "./editor-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Curriculum manager" };

type CurriculumRow = Record<string, unknown> & { id: string };
function text(row: CurriculumRow, key: string, fallback = ""): string {
  const value = row[key];
  return typeof value === "string" ? value : fallback;
}
function dateValue(row: CurriculumRow, key: string): string {
  const date = text(row, key);
  return date ? date.slice(0, 10) : "";
}
function asActive(row: CurriculumRow): boolean {
  return row.is_active === true;
}

export default async function AdminCurriculumPage() {
  await requireAdmin();
  const supabase = await getSupabaseServerClient();
  const [systemsResult, gradesResult, areasResult] = supabase
    ? await Promise.all([
        supabase.from("education_systems").select("id,code,name,is_active,starts_on,ends_on").order("name"),
        supabase.from("grades").select("id,system_id,code,name,level_order,is_active,starts_on,ends_on").order("level_order"),
        supabase.from("learning_areas").select("id,system_id,title,description,icon_name,accent_color,sort_order").order("sort_order"),
      ])
    : [null, null, null];
  const hasConnection = !!supabase;
  const systems = (systemsResult?.data ?? []) as unknown as CurriculumRow[];
  const grades = (gradesResult?.data ?? []) as unknown as CurriculumRow[];
  const areas = (areasResult?.data ?? []) as unknown as CurriculumRow[];
  const systemsError = !hasConnection || !!systemsResult?.error;
  const gradesError = !hasConnection || !!gradesResult?.error;
  const areasError = !hasConnection || !!areasResult?.error;

  return (
    <div className="admin-page">
      <header className="admin-heading">
        <div><span className="admin-kicker">Catalogue configuration</span><h1>Curriculum manager</h1><p>Maintain system and grade availability dates and refine learning-area presentation.</p></div>
      </header>
      <aside className="admin-warning"><strong>Official curriculum verification required</strong>Seed curriculum assumptions and mappings are provisional. Verify all systems, grades, learning areas, codes, and dates against current official KICD/KNEC guidance before relying on or publishing them.</aside>

      {systemsError && <div className="admin-empty" role="status">Education systems could not be loaded. Check the database connection and administrator RLS access, then reload.</div>}
      {!systemsError && systems.length === 0 && <div className="admin-empty">No education-system records are available yet. This editor does not create seed records.</div>}

      {systems.map((system) => {
        const systemId = String(system.id);
        const systemGrades = grades.filter((grade) => text(grade, "system_id") === systemId);
        const systemAreas = areas.filter((area) => text(area, "system_id") === systemId);
        return (
          <section className="admin-record" key={systemId} aria-labelledby={`system-${systemId}`}>
            <div className="admin-record__head"><div><h2 id={`system-${systemId}`}>{text(system, "name", "Unnamed education system")}</h2><p>{text(system, "code")} · {systemGrades.length} grade record{systemGrades.length === 1 ? "" : "s"} · {systemAreas.length} learning area{systemAreas.length === 1 ? "" : "s"}</p></div><span className="neutral-pill">{asActive(system) ? "Active" : "Inactive"}</span></div>
            <div className="admin-record__body">
              <h3>System availability</h3>
              <SystemEditor id={systemId} startsOn={dateValue(system, "starts_on")} endsOn={dateValue(system, "ends_on")} isActive={asActive(system)} />
            </div>
            <div className="admin-subsection">
              <h3 className="admin-section-title">Grades</h3>
              {gradesError ? <div className="admin-empty">Grades could not be loaded. Grade editing is unavailable until the data query succeeds.</div> : systemGrades.length === 0 ? <div className="admin-empty">No grades are configured for this system.</div> : systemGrades.map((grade) => {
                const gradeId = String(grade.id);
                return <article className="admin-record" key={gradeId}>
                  <div className="admin-record__head"><div><h3>{text(grade, "name", "Unnamed grade")}</h3><p>{text(grade, "code")}</p></div><span className="neutral-pill">{asActive(grade) ? "Active" : "Inactive"}</span></div>
                  <div className="admin-record__body"><GradeEditor id={gradeId} startsOn={dateValue(grade, "starts_on")} endsOn={dateValue(grade, "ends_on")} isActive={asActive(grade)} /></div>
                </article>;
              })}
            </div>
            <div className="admin-subsection">
              <h3 className="admin-section-title">Learning areas</h3>
              {areasError ? <div className="admin-empty">Learning areas could not be loaded. Area editing is unavailable until the data query succeeds.</div> : systemAreas.length === 0 ? <div className="admin-empty">No learning areas are configured for this system.</div> : systemAreas.map((area) => {
                const areaId = String(area.id);
                const color = text(area, "accent_color", "#2563EB");
                return <article className="admin-record" key={areaId}>
                  <div className="admin-record__head"><div><h3><i className="admin-color-swatch" style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#2563eb" }} aria-hidden="true" />{text(area, "title", "Untitled learning area")}</h3><p>Icon: {text(area, "icon_name", "BookOpen")}</p></div></div>
                  <div className="admin-record__body"><LearningAreaEditor id={areaId} title={text(area, "title")} iconName={text(area, "icon_name", "BookOpen")} accentColor={color} description={text(area, "description")} /></div>
                </article>;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
