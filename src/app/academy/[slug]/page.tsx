import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedCourse } from "@/lib/data/public-catalogue";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
const money = (amount: unknown) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(Number(amount) || 0);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublishedCourse(slug);
  if (!result) return { title: "Course not found", robots: { index: false, follow: false } };
  const title = String(result.course.title);
  const description = String(result.course.description || `Explore the ${title} course at Lexify School.`).slice(0, 155);
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  const path = `/academy/${encodeURIComponent(slug)}`;
  return { title, description, alternates: origin ? { canonical: new URL(path, origin).toString() } : undefined, openGraph: { type: "website", title: `${title} | Lexify School`, description, url: origin ? new URL(path, origin).toString() : undefined }, twitter: { card: "summary_large_image", title: `${title} | Lexify School`, description } };
}

export default async function AcademyCoursePage({ params }: Props) {
  const { slug } = await params;
  const result = await getPublishedCourse(slug);
  if (!result) notFound();
  const { course, modules, lessons } = result;
  const price = course.price && typeof course.price === "object" ? course.price as Record<string, unknown> : null;
  const activePrice = price?.sale_price_kes ?? price?.price_kes;
  return <main className="page-content"><div className="container">
    <p className="breadcrumb"><Link href="/academy">Academy</Link> <span aria-hidden="true">/</span> {String(course.title)}</p>
    <section className="detail-hero"><div><span className="section-kicker">Computer Packages Academy</span><h1>{String(course.title)}</h1><p>{String(course.description || "The instructor will add a detailed overview before the course is promoted.")}</p><div className="detail-hero__meta">{course.level ? <span>{String(course.level)}</span> : null}{typeof course.duration_minutes === "number" ? <span>{course.duration_minutes} minutes</span> : null}{course.is_free ? <strong>Free</strong> : activePrice !== undefined && activePrice !== null ? <strong>{money(activePrice)}</strong> : <span>Price not published</span>}</div>
      {course.is_free ? <Link className="button button--gold" href={`/signup/student?next=${encodeURIComponent(`/academy/${slug}`)}`}>Create an account to enrol</Link> : <Link className="button button--gold" href={`/login?next=${encodeURIComponent(`/academy/${slug}`)}`}>Sign in to enrol</Link>}</div>
      <div className="detail-aside"><strong>Structured learning</strong><p>Modules and lesson titles are shown only when the course has been published. Paid lessons and files remain available only to enrolled learners.</p></div></section>
    <section className="section-block"><div className="section-head"><div><span className="section-kicker">Course outline</span><h2 className="section-title">Modules and previews</h2></div></div>
      {modules.length ? <div className="module-list">{modules.map((module) => { const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id); return <details className="module-item" key={String(module.id)}><summary><span><strong>{String(module.title)}</strong><small>{moduleLessons.length ? `${moduleLessons.length} published preview lesson${moduleLessons.length === 1 ? "" : "s"}` : "Sign in or enrol to access available lessons"}</small></span><span aria-hidden="true">+</span></summary>{module.description ? <p>{String(module.description)}</p> : null}{moduleLessons.length ? <ul>{moduleLessons.map((lesson) => <li key={String(lesson.id)}>{String(lesson.title)}{typeof lesson.estimated_minutes === "number" ? ` · ${lesson.estimated_minutes} min` : ""}{lesson.is_free_preview ? <span className="preview-pill">Free preview</span> : null}</li>)}</ul> : null}</details>; })}</div> : <div className="empty-state"><h2>Course outline coming soon</h2><p>The course has a public listing but its module outline is not available yet.</p></div>}
    </section>
    <p className="disclaimer">Course material and outcomes are published by the instructor and platform administrator. Review course details before purchase.</p>
  </div></main>;
}
