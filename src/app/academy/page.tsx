import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Clock3, MonitorPlay } from "lucide-react";
import {
  listPublishedAcademyCourses,
  type AcademyFilters,
} from "@/lib/data/academy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Computer Packages Academy",
  description:
    "Explore published Computer Packages Academy courses and their available free previews.",
  openGraph: {
    type: "website",
    title: "Computer Packages Academy | Lexify School",
    description:
      "Learn practical digital skills through structured online courses.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Computer Packages Academy | Lexify School",
    description: "Explore published computer learning courses.",
  },
};

type Search = { q?: string | string[]; level?: string | string[] };
const first = (value?: string | string[]) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

export default async function AcademyPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const filters: AcademyFilters = {
    q: first(params.q).trim().slice(0, 80),
    level: first(params.level).trim().slice(0, 50),
  };
  const result = await listPublishedAcademyCourses(filters);
  const courses = result.data ?? [];
  const levels = [
    ...new Set(
      courses.map(course => String(course.level ?? "").trim()).filter(Boolean)
    ),
  ].sort();

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="section-kicker">Computer Packages Academy</span>
          <h1>Practical computer skills, taught step by step</h1>
          <p>
            Browse courses published by Lexify School. Open any available
            preview to read or watch lesson material before deciding whether to
            contact the instructor.
          </p>
        </div>
      </section>
      <main className="page-content">
        <div className="container">
          <div className="market-strip">
            <div>
              <h3>Learn by doing</h3>
              <p>
                Course listings show published outlines and lessons explicitly
                marked as free previews. Other course access and pricing must be
                confirmed with the instructor.
              </p>
            </div>
            <div className="market-strip__links">
              <Link className="button button--gold" href="/signup/student">
                Create a learner account
              </Link>
            </div>
          </div>

          <form
            action="/academy"
            className="filter-panel"
            method="get"
            aria-label="Search and filter Academy courses"
          >
            <label className="filter-control">
              <span>Search courses</span>
              <input
                name="q"
                type="search"
                defaultValue={filters.q}
                maxLength={80}
                placeholder="Title or course description"
              />
            </label>
            <label className="filter-control">
              <span>Course level</span>
              <select name="level" defaultValue={filters.level}>
                <option value="">Any level</option>
                {levels.map(level => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button--blue" type="submit">
              Apply filters
            </button>
            <Link className="button button--line" href="/academy">
              Clear
            </Link>
          </form>

          <div className="catalogue-heading">
            <h2>Published courses</h2>
            <p>
              {result.error
                ? "Catalogue unavailable"
                : `${courses.length} ${courses.length === 1 ? "course" : "courses"} found`}
            </p>
          </div>
          {result.error ? (
            <section className="empty-state" role="alert">
              <h2>Courses could not be loaded</h2>
              <p>
                The published course catalogue is temporarily unavailable.
                Please try again later; this is not an empty result.
              </p>
            </section>
          ) : courses.length ? (
            <div className="card-grid">
              {courses.map(course => (
                <article className="catalogue-card" key={String(course.id)}>
                  <div className="catalogue-card__icon">
                    <BookOpen size={25} aria-hidden="true" />
                  </div>
                  <p className="eyebrow">
                    {course.level ? String(course.level) : "Computer Packages"}
                  </p>
                  <h3>{String(course.title)}</h3>
                  <p>
                    {String(
                      course.description ||
                        "Course details will be confirmed by the instructor."
                    )}
                  </p>
                  <div className="catalogue-card__meta">
                    {typeof course.duration_minutes === "number" ? (
                      <span>
                        <Clock3 size={15} aria-hidden="true" />{" "}
                        {course.duration_minutes} minutes
                      </span>
                    ) : (
                      <span>
                        <MonitorPlay size={15} aria-hidden="true" /> Self-paced
                        learning
                      </span>
                    )}
                    {course.preview_count > 0 ? (
                      <strong>
                        {course.preview_count} free{" "}
                        {course.preview_count === 1 ? "preview" : "previews"}
                      </strong>
                    ) : null}
                  </div>
                  <Link
                    className="button button--line button--small"
                    href={`/academy/${encodeURIComponent(String(course.code).toLowerCase())}`}
                  >
                    View course
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>
                {filters.q || filters.level
                  ? "No courses match these filters"
                  : "No published courses yet"}
              </h2>
              <p>
                {filters.q || filters.level
                  ? "Try a different title, description, or level."
                  : "Courses appear here after they have been published. Check back later for new learning options."}
              </p>
              {filters.q || filters.level ? (
                <Link className="button button--blue" href="/academy">
                  Clear filters
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
