import type { Metadata } from "next";
import Link from "next/link";
import { listTeachers, getPublicCurriculum } from "@/lib/data/public-catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Browse Teachers",
  description: "Find Lexify School teachers by learning area, grade and available class options.",
  openGraph: { type: "website", title: "Browse Teachers | Lexify School", description: "Explore teacher profiles and available learning support." },
  twitter: { card: "summary_large_image", title: "Browse Teachers | Lexify School", description: "Explore teacher profiles and available learning support." },
};

type Search = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function TeachersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const { systems, grades, areas } = await getPublicCurriculum();
  const q = first(params.q) ?? "";
  const subjectId = first(params.subject) ?? "";
  const gradeId = first(params.grade) ?? "";
  const price = Number(first(params.maxPrice) ?? "");
  const paymentBasis = first(params.payment) ?? "";
  const verified = first(params.verified) === "on";
  const teachers = await listTeachers({ q, subjectId, gradeId, maxPrice: Number.isFinite(price) && price > 0 ? price : undefined, paymentBasis, verified });

  return (
    <>
      <section className="page-hero"><div className="container"><span className="section-kicker">Teacher marketplace</span><h1>Find a teacher who fits your learning goals</h1><p>Browse published teacher profiles, learning areas and available class options. Unverified profiles are clearly marked; ratings appear only when there are published reviews.</p></div></section>
      <main className="page-content"><div className="container">
        <form action="/teachers" className="filter-panel" method="get" aria-label="Filter teachers">
          <label className="filter-control"><span>Search teacher name</span><input name="q" defaultValue={q} placeholder="Search by public profile name" maxLength={80} /></label>
          <label className="filter-control"><span>Learning area</span><select name="subject" defaultValue={subjectId}><option value="">All learning areas</option>{areas.map((area) => <option key={String(area.id)} value={String(area.id)}>{String(area.title)}</option>)}</select></label>
          <label className="filter-control"><span>Grade</span><select name="grade" defaultValue={gradeId}><option value="">All grades</option>{systems.map((system) => <optgroup key={String(system.id)} label={String(system.name)}>{grades.filter((grade) => grade.system_id === system.id).map((grade) => <option key={String(grade.id)} value={String(grade.id)}>{String(grade.name)}</option>)}</optgroup>)}</select></label>
          <label className="filter-control"><span>Maximum listed price (KES)</span><input name="maxPrice" type="number" min="1" step="50" defaultValue={price || ""} placeholder="Any" /></label>
          <label className="filter-control"><span>Payment option</span><select name="payment" defaultValue={paymentBasis}><option value="">Any payment option</option><option value="lesson_bundle">Per lesson bundle</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
          <label className="filter-check"><input name="verified" type="checkbox" defaultChecked={verified} /><span>Verified profiles only</span></label>
          <button className="button button--blue" type="submit">Apply filters</button>
          <Link className="button button--line" href="/teachers">Clear</Link>
        </form>
        <div className="catalogue-heading"><h2>{teachers.length} {teachers.length === 1 ? "teacher" : "teachers"}</h2><p>Only currently accepting, public profiles are listed.</p></div>
        {teachers.length ? <div className="teacher-grid">{teachers.map((teacher) => {
          const id = String(teacher.profile_id);
          const name = String(teacher.public_name || "Lexify teacher");
          return <article className="teacher-card" key={id}>
            {teacher.public_avatar_url ? <img className="teacher-card__avatar" src={String(teacher.public_avatar_url)} alt={`${name} profile`} loading="lazy" /> : <div className="teacher-card__avatar teacher-card__avatar--initial" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</div>}
            <div className="teacher-card__body"><div className="teacher-card__top"><h3>{name}</h3>{teacher.verification_status === "verified" ? <span className="verified-pill">Verified</span> : <span className="neutral-pill">Not verified</span>}</div>
              <p>{teacher.bio ? String(teacher.bio) : "This teacher has not added a public bio yet."}</p>
              <div className="teacher-card__meta">{typeof teacher.experience_years === "number" ? `${teacher.experience_years} years of experience` : "Experience not listed"}</div>
              <Link className="button button--line button--small" href={`/teachers/${encodeURIComponent(id)}`}>View profile</Link>
            </div>
          </article>;
        })}</div> : <div className="empty-state"><h2>No matching teachers yet</h2><p>Try adjusting the filters. New profiles appear after a teacher publishes their information and starts accepting students.</p><Link className="button button--line" href="/signup/teacher">Create a teacher account</Link></div>}
      </div></main>
    </>
  );
}
