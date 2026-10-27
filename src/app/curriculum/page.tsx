import type { Metadata } from "next";
import { getPublicCurriculum } from "@/lib/data/public-catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Curriculum Guide",
  description: "Explore active Kenyan education systems, grades and learning areas listed by Lexify School.",
  openGraph: { type: "website", title: "Curriculum Guide | Lexify School", description: "View the education systems and curriculum records currently available." },
  twitter: { card: "summary_large_image", title: "Curriculum Guide | Lexify School", description: "Explore current education-system records." },
};

export default async function CurriculumPage() {
  const { systems, grades, areas } = await getPublicCurriculum();
  return <>
    <section className="page-hero"><div className="container"><span className="section-kicker">Curriculum guide</span><h1>Curriculum information that adapts with the school year</h1><p>Learning areas, grade availability, pathways and combinations are maintained in the Lexify curriculum catalogue. Administrators can publish updates without changing application code.</p></div></section>
    <main className="page-content"><div className="container">
      <div className="notice notice--warning"><strong>Curriculum note</strong><p>Some mappings, subject codes, assessment bands and combination rules are provisional. Confirm current details against official KICD/KNEC guidance and school requirements before making subject choices.</p></div>
      {systems.length ? <div className="curriculum-systems">{systems.map((system) => {
        const systemGrades = grades.filter((grade) => grade.system_id === system.id);
        const systemAreas = areas.filter((area) => area.system_id === system.id && !area.parent_area_id);
        return <section className="curriculum-system" key={String(system.id)}>
          <div className="section-head"><div><span className="section-kicker">{String(system.code)}</span><h2 className="section-title">{String(system.name)}</h2></div><span className="neutral-pill">{systemGrades.length} active grade{systemGrades.length === 1 ? "" : "s"}</span></div>
          <div className="grade-chips">{systemGrades.map((grade) => <span className="grade-chip" key={String(grade.id)}>{String(grade.name)}</span>)}</div>
          {systemAreas.length ? <div className="curriculum-area-grid">{systemAreas.map((area) => <article className="subject-summary" key={String(area.id)}><span className="subject-summary__icon" style={{ backgroundColor: `${String(area.accent_color || "#1e3a8a")}18`, color: String(area.accent_color || "#1e3a8a") }} aria-hidden="true">{area.illustration_url ? <img src={String(area.illustration_url)} alt="" /> : <span>{String(area.icon_name || "BookOpen").slice(0, 1)}</span>}</span><strong>{String(area.title)}</strong><span>{area.is_core ? "Core" : area.is_optional_activity ? "Optional" : "Elective"}{area.is_examinable ? " · examinable" : ""}</span>{area.description ? <p>{String(area.description)}</p> : null}</article>)}</div> : <p className="muted">No active learning areas have been published for this system.</p>}
        </section>;
      })}</div> : <div className="empty-state"><h2>Curriculum records are being loaded</h2><p>Active education systems and learning areas will appear here after the administrator reviews and publishes the initial curriculum catalogue.</p></div>}
      <div className="content-card"><h2>Choosing learning areas</h2><p>Eligibility and subject combinations depend on the selected education system, grade, pathway, track and learner circumstances. Lexify validates choices against the current rules stored in its curriculum tables. The guide is informational and does not replace official curriculum or school advice.</p><p>Special options, including Kenya Sign Language where applicable, are shown only when the learner meets the recorded eligibility requirement.</p></div>
    </div></main>
  </>;
}
