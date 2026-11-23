import type { Metadata } from "next";
import Link from "next/link";
import SearchField from "@/components/search/SearchField";
import {
  getTeacherFilterOptions,
  listPublicTeachers,
  normalizeTeacherFilters,
} from "@/lib/data/teacher-marketplace";
import { getSupabaseServerClient } from "@/lib/supabase/server";

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
    sort: first(params.sort),
  });
  const [teacherResult, optionsResult] = await Promise.all([
    listPublicTeachers({ ...filters, verified: false }),
    getTeacherFilterOptions(),
  ]);
  const supabase = await getSupabaseServerClient();
  const teacherRows = teacherResult.data ?? [];
  const ids = teacherRows.map(teacher => teacher.profile_id);
  const activeResult = supabase && ids.length
    ? await supabase.rpc("get_active_teacher_verification_teacher_ids", { target_teacher_ids: ids })
    : { data: [], error: true };
  const activeIds = new Set(((activeResult.data ?? []) as { teacher_id: string }[]).map(row => row.teacher_id));
  const visibleTeachers = teacherRows
    .map(teacher => ({ ...teacher, verification_status: activeIds.has(teacher.profile_id) ? "verified" : "unverified" }))
    .filter(teacher => !filters.verified || teacher.verification_status === "verified");
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
            <SearchField
              id="teacher-search"
              name="q"
              label="Search teacher name"
              defaultValue={filters.q ?? ""}
              placeholder="Search by public profile name"
              maxLength={80}
              className="filter-control"
            />
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
            <label className="filter-control">
              <span>Sort teachers</span>
              <select name="sort" defaultValue={filters.sort}>
                <option value="name">Name A–Z</option>
                <option value="newest">Newest profile</option>
                <option value="price_asc">Lowest listed starting price</option>
                <option value="price_desc">
                  Highest listed starting price
                </option>
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
              Apply filters and sort
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
                  {visibleTeachers.length} {" "}
                  {visibleTeachers.length === 1 ? "teacher" : "teachers"}
                </h2>
                <p>
                  Only teachers accepting students are shown. Subject and grade
                  filters also include the teaching selections recorded during
                  signup. Starting prices are teacher-provided and
                  informational.
                </p>
              </div>
              {visibleTeachers.length ? (
                <div className="teacher-grid">
                  {visibleTeachers.map(teacher => {
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
                          {teacher.subjects.length ? (
                            <p className="teacher-card__subjects">
                              <strong>Teaches:</strong>{" "}
                              {teacher.subjects
                                .map(
                                  subject =>
                                    `${subject.title}${subject.grade_name ? ` · ${subject.grade_name}` : ""}`
                                )
                                .join(" · ")}
                            </p>
                          ) : null}
                          {teacher.services?.includes("tuition") ? (
                            <span className="teacher-service">Tuition</span>
                          ) : null}
                          {teacher.starting_price_kes != null &&
                          Number.isFinite(Number(teacher.starting_price_kes)) &&
                          teacher.pricing_basis ? (
                            <p className="teacher-card__price">
                              <strong>
                                From KES{" "}
                                {new Intl.NumberFormat("en-KE", {
                                  maximumFractionDigits: 0,
                                }).format(Number(teacher.starting_price_kes))}
                              </strong>{" "}
                              <span>
                                per{" "}
                                {teacher.pricing_basis === "lesson_bundle"
                                  ? "lesson bundle"
                                  : teacher.pricing_basis}
                              </span>{" "}
                              <small>Informational price</small>
                            </p>
                          ) : null}
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
