import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Clock3, MonitorPlay } from "lucide-react";
import { listPublishedCourses } from "@/lib/data/public-catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Computer Packages Academy",
  description: "Explore published Computer Packages Academy courses for digital and practical computer skills.",
  openGraph: { type: "website", title: "Computer Packages Academy | Lexify School", description: "Learn practical digital skills through structured online courses." },
  twitter: { card: "summary_large_image", title: "Computer Packages Academy | Lexify School", description: "Explore published computer learning courses." },
};

export default async function AcademyPage() {
  const courses = await listPublishedCourses();
  return <>
    <section className="page-hero"><div className="container"><span className="section-kicker">Computer Packages Academy</span><h1>Practical computer skills, taught step by step</h1><p>Browse courses published by Lexify School administrators. Course content and prices appear only after they have been reviewed and published.</p></div></section>
    <main className="page-content"><div className="container">
      <div className="market-strip"><div><h3>Learn by doing</h3><p>Courses can include video lessons, written guides, practice files, quizzes and assignments. Enrolled learners see materials available to their account.</p></div><div className="market-strip__links"><Link className="button button--gold" href="/signup/student">Create a learner account</Link></div></div>
      <div className="catalogue-heading"><h2>Published courses</h2><p>{courses.length} currently available</p></div>
      {courses.length ? <div className="card-grid">{courses.map((course) => <article className="catalogue-card" key={String(course.id)}><div className="catalogue-card__icon"><BookOpen size={25} aria-hidden="true" /></div><p className="eyebrow">{course.level ? String(course.level) : "Computer Packages"}</p><h3>{String(course.title)}</h3><p>{String(course.description || "Course overview will be provided by the instructor.")}</p><div className="catalogue-card__meta">{typeof course.duration_minutes === "number" ? <span><Clock3 size={15} aria-hidden="true" /> {course.duration_minutes} minutes</span> : <span><MonitorPlay size={15} aria-hidden="true" /> Self-paced learning</span>}{course.is_free ? <strong>Free</strong> : null}</div><Link className="button button--line button--small" href={`/academy/${encodeURIComponent(String(course.code).toLowerCase())}`}>View course</Link></article>)}</div> : <div className="empty-state"><h2>Courses are being prepared</h2><p>No course is available until an administrator publishes its verified content and pricing. Check back soon or create a learner account to explore the platform.</p><Link className="button button--blue" href="/signup/student">Create a learner account</Link></div>}
    </div></main>
  </>;
}
