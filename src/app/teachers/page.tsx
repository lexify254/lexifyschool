import type { Metadata } from "next";
import Link from "next/link";
import {
  getTeacherFilterOptions,
  listPublicTeachers,
  normalizeTeacherFilters,
} from "@/lib/data/teacher-marketplace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Browse Teachers",
  description:
    "Find Lexify School teachers by learning area, grade and available class options.",
  openGraph: {
    type: "website",
    title: "Browse Teachers | Lexify School",
    description: "Explore teacher profiles and available learning support.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Browse Teachers | Lexify School",
    description: "Explore teacher profiles and available learning support.",
  },
};

type Search = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

function ReadError({ unavailable = false }: { unavailable?: boolean }) {
  return (
    <section className="empty-state" role="alert">
      <h2>Teacher listings are temporarily unavailable</h2>
      <p>
        {unavailable
          ? "The teacher catalogue is not connected right now. Please try again later."
          : "We could not load the teacher catalogue. Your filters have not been treated as an empty result."}
      </p>
      <Link className="button button--line" href="/teachers">
        Try again
      </Link>
    </section>
  );
}

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const rawMaxPrice = Number(first(params.maxPrice) ?? "");
  const filters = normalizeTeacherFilters({
    q: first(params.q),
    subjectId: first(params.subject),
    gradeId: first(params.grade),
    maxPrice: rawMaxPrice,
    pricingBasis: first(params.pricing),
    verified: first(params.verified) === "on",
  });
  const [teacherResult, optionsResult] = await Promise.all([
    listPublicTeachers(filters),
    getTeacherFilterOptions(),
  ]);
  const systems = optionsResult.data?.systems ?? [];
  const grades = optionsResult.data?.grades ?? [];
  const areas = optionsResult.data?.areas ?? [];

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="section-kicker">Teacher marketplace</span>
          <h1>Find a teacher who fits your learning goals</h1>
          <p>
            Browse public profiles and currently published class options.
            Verification is shown separately from availability. Contacting a
            teacher is an enquiry only; it does not confirm a booking or
            payment.
          </p>
        </div>
      </section>
      <main className="page-content">
        <div className="container">
          <form
            action="/teachers"
            className="filter-panel"
            method="get"
            aria-label="Filter teachers"
          >
            <label className="filter-control">
              <span>Search teacher name</span>
              <input
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder="Search by public profile name"
                maxLength={80}
              />
            </label>
            <label className="filter-control">
              <span>Learning area</span>
              <select name="subject" defaultValue={filters.subjectId ?? ""}>
                <option value="">All learning areas</option>
                {areas.map(area => (
                  <option key={String(area.id)} value={String(area.id)}>
                    {String(area.title)}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-control">
              <span>Grade</span>
              <select name="grade" defaultValue={filters.gradeId ?? ""}>
                <option value="">All grades</option>
                {systems.map(system => (
                  <optgroup key={String(system.id)} label={String(system.name)}>
                    {grades
                      .filter(grade => grade.system_id === system.id)
                      .map(grade => (
                        <option key={String(grade.id)} value={String(grade.id)}>
                          {String(grade.name)}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="filter-control">
              <span>Maximum listed price (KES)</span>
              <input
                name="maxPrice"
                type="number"
                min="1"
                step="50"
                defaultValue={filters.maxPrice ?? ""}
                placeholder="Any"
              />
            </label>
            <label className="filter-control">
              <span>Pricing basis</span>
              <select name="pricing" defaultValue={filters.pricingBasis ?? ""}>
                <option value="">Any pricing basis</option>
                <option value="lesson_bundle">Per lesson bundle</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="filter-check">
              <input
                name="verified"
                type="checkbox"
                defaultChecked={filters.verified}
              />
              <span>Verified profiles only</span>
            </label>
            <button className="button button--blue" type="submit">
              Apply filters
            </button>
            <Link className="button button--line" href="/teachers">
              Clear
            </Link>
          </form>

          {optionsResult.error ? (
            <p className="empty-inline" role="status">
              Filter choices could not be loaded. You can still search teacher
              names; please try again later for learning-area and grade filters.
            </p>
          ) : null}

          {teacherResult.error ? (
            <ReadError unavailable={teacherResult.error === "unavailable"} />
          ) : (
            <>
              <div className="catalogue-heading">
                <h2>
                  {teacherResult.data.length}{" "}
                  {teacherResult.data.length === 1 ? "teacher" : "teachers"}
                </h2>
                <p>
                  Only teachers accepting students are shown. Class-based
                  filters match published, active class options.
                </p>
              </div>
              {teacherResult.data.length ? (
                <div className="teacher-grid">
                  {teacherResult.data.map(teacher => {
                    const id = teacher.profile_id;
                    const name = teacher.public_name || "Lexify teacher";
                    return (
                      <article className="teacher-card" key={id}>
                        {teacher.public_avatar_url ? (
                          <img
                            className="teacher-card__avatar"
                            src={teacher.public_avatar_url}
                            alt={`${name} profile`}
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="teacher-card__avatar teacher-card__avatar--initial"
                            aria-hidden="true"
                          >
                            {name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="teacher-card__body">
                          <div className="teacher-card__top">
                            <h3>{name}</h3>
                            {teacher.verification_status === "verified" ? (
                              <span className="verified-pill">Verified</span>
                            ) : (
                              <span className="neutral-pill">Not verified</span>
                            )}
                          </div>
                          <p>
                            {teacher.bio ||
                              "This teacher has not added a public bio yet."}
                          </p>
                          <div className="teacher-card__meta">
                            {typeof teacher.experience_years === "number"
                              ? `${teacher.experience_years} years of experience`
                              : "Experience not listed"}
                          </div>
                          <Link
                            className="button button--line button--small"
                            href={`/teachers/${encodeURIComponent(id)}`}
                          >
                            View profile
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <h2>No matching teachers yet</h2>
                  <p>
                    Try adjusting your filters. Public profiles appear while
                    teachers are accepting students.
                  </p>
                  <Link className="button button--line" href="/teachers">
                    Clear filters
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
