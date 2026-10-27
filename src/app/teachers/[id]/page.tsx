import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeacherProfile } from "@/lib/data/public-catalogue";
import { whatsappHref } from "@/lib/whatsapp/links";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
const money = (amount: unknown) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(Number(amount) || 0);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const record = await getTeacherProfile(id);
  if (!record) return { title: "Teacher profile not found", robots: { index: false, follow: false } };
  const name = String(record.teacher.public_name || "Lexify teacher");
  const description = String(record.teacher.bio || `View ${name}'s published Lexify School teaching profile and class options.`).slice(0, 155);
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  const path = `/teachers/${encodeURIComponent(id)}`;
  return {
    title: `${name} | Teacher Profile`, description,
    alternates: origin ? { canonical: new URL(path, origin).toString() } : undefined,
    openGraph: { type: "profile", title: `${name} | Lexify School`, description, url: origin ? new URL(path, origin).toString() : undefined, images: record.teacher.public_avatar_url ? [{ url: String(record.teacher.public_avatar_url) }] : undefined },
    twitter: { card: "summary_large_image", title: `${name} | Lexify School`, description, images: record.teacher.public_avatar_url ? [String(record.teacher.public_avatar_url)] : undefined },
  };
}

export default async function TeacherProfilePage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const record = await getTeacherProfile(id);
  if (!record) notFound();
  const { teacher, subjects, classes } = record;
  const name = String(teacher.public_name || "Lexify teacher");
  const chat = whatsappHref(typeof teacher.public_whatsapp === "string" ? teacher.public_whatsapp : null, "Hello, I found your teacher profile on Lexify School and would like to ask about your classes.");
  return <main className="page-content"><div className="container">
    <p className="breadcrumb"><Link href="/teachers">Teachers</Link> <span aria-hidden="true">/</span> Profile</p>
    <section className="profile-hero">
      {teacher.public_avatar_url ? <img src={String(teacher.public_avatar_url)} alt={`${name} profile`} width={120} height={120} /> : <div className="profile-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</div>}
      <div><div className="teacher-card__top"><h1>{name}</h1>{teacher.verification_status === "verified" ? <span className="verified-pill">Verified teacher</span> : <span className="neutral-pill">Not verified</span>}</div>
        <p>{teacher.bio ? String(teacher.bio) : "This teacher has not added a public biography yet."}</p>
        <p className="muted">{typeof teacher.experience_years === "number" ? `${teacher.experience_years} years of experience` : "Experience not listed"}</p>
        <div className="profile-hero__actions">{chat ? <a className="button button--gold" href={chat} target="_blank" rel="noopener noreferrer">Contact on WhatsApp</a> : <Link className="button button--gold" href={`/login?next=${encodeURIComponent(`/teachers/${id}`)}`}>Sign in to contact</Link>}<Link className="button button--line" href="/signup/student">Find a class</Link></div>
      </div>
    </section>
    <section className="section-block"><div className="section-head"><div><span className="section-kicker">Learning areas</span><h2 className="section-title">Subjects and grades</h2></div></div>
      {subjects.length ? <div className="subject-grid">{subjects.map((subject, index) => <article className="subject-summary" key={`${String(subject.id)}-${index}`}><span className="subject-summary__icon" style={{ backgroundColor: `${String(subject.accent_color || "#1e3a8a")}18`, color: String(subject.accent_color || "#1e3a8a") }} aria-hidden="true">{subject.illustration_url ? <img src={String(subject.illustration_url)} alt="" /> : <span>{String(subject.icon_name || "📘").slice(0, 1)}</span>}</span><strong>{String(subject.title || "Learning area")}</strong><span>{subject.grade && typeof subject.grade === "object" ? String((subject.grade as Record<string, unknown>).name || "Grade") : "Grade not listed"}</span></article>)}</div> : <p className="empty-inline">This teacher has not published learning areas yet.</p>}
    </section>
    <section className="section-block"><div className="section-head"><div><span className="section-kicker">Available classes</span><h2 className="section-title">Class options</h2></div></div>
      {classes.length ? <div className="card-grid">{classes.map((classRecord) => <article className="content-card" key={String(classRecord.id)}><h3>{String(classRecord.title || "Class")}</h3><p>{String(classRecord.description || "Class description not provided.")}</p><p className="class-meta">{classRecord.grade && typeof classRecord.grade === "object" ? String((classRecord.grade as Record<string, unknown>).name || "") : ""}{classRecord.area && typeof classRecord.area === "object" ? ` · ${String((classRecord.area as Record<string, unknown>).title || "")}` : ""}</p><p><strong>{money(classRecord.price_kes)}</strong> <span className="muted">per {classRecord.payment_basis === "lesson_bundle" ? "lesson bundle" : String(classRecord.payment_basis || "period")}</span></p><Link className="button button--blue button--small" href={`/login?next=${encodeURIComponent(`/teachers/${id}`)}`}>Enquire about this class</Link></article>)}</div> : <div className="empty-state"><h2>No published classes</h2><p>Contact this teacher directly to ask about upcoming classes.</p></div>}
    </section>
    <p className="disclaimer">Profile availability and any verification status are shown as provided by the platform. Check class details with the teacher before enrolling.</p>
  </div></main>;
}
