import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubjectCard } from "@/components/subject-card";
import {
  getPublicTeacherProfile,
  isPublicTeacherId,
} from "@/lib/data/teacher-marketplace";
import { buildWhatsAppHandoffHref } from "@/lib/whatsapp/handoff";
import { whatsappHref } from "@/lib/whatsapp/links";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
const money = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);

const enquiryMessage = (name: string, classTitle?: string) =>
  `Hello, I found ${name}'s teacher profile on Lexify School${classTitle ? ` and would like to ask about ${classTitle}` : " and would like to ask about their classes"}.`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isPublicTeacherId(id)) {
    return {
      title: "Teacher profile not found",
      robots: { index: false, follow: false },
    };
  }
  const result = await getPublicTeacherProfile(id);
  if (result.error || !result.data) {
    return {
      title: result.error
        ? "Teacher profile temporarily unavailable"
        : "Teacher profile not found",
      robots: { index: false, follow: false },
    };
  }
  const teacher = result.data.teacher;
  const name = teacher.public_name || "Lexify teacher";
  const description = (
    teacher.bio ||
    `View ${name}'s public Lexify School teaching profile and published class options.`
  ).slice(0, 155);
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  const path = `/teachers/${encodeURIComponent(id)}`;
  const profileUrl = origin ? new URL(path, origin).toString() : undefined;
  return {
    title: `${name} | Teacher Profile`,
    description,
    alternates: profileUrl ? { canonical: profileUrl } : undefined,
    openGraph: {
      type: "profile",
      title: `${name} | Lexify School`,
      description,
      url: profileUrl,
      images: teacher.public_avatar_url
        ? [{ url: teacher.public_avatar_url }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} | Lexify School`,
      description,
      images: teacher.public_avatar_url
        ? [teacher.public_avatar_url]
        : undefined,
    },
  };
}

export default async function TeacherProfilePage({ params }: Props) {
  const { id } = await params;
  if (!isPublicTeacherId(id)) notFound();

  const result = await getPublicTeacherProfile(id);
  if (result.error) {
    return (
      <main className="page-content">
        <div className="container">
          <section className="empty-state" role="alert">
            <h1>Teacher profile temporarily unavailable</h1>
            <p>
              We could not load this public profile. Please try again; a read
              failure is not treated as a missing profile.
            </p>
            <Link
              className="button button--line"
              href={`/teachers/${encodeURIComponent(id)}`}
            >
              Try again
            </Link>
            <Link className="button button--line" href="/teachers">
              Browse teachers
            </Link>
          </section>
        </div>
      </main>
    );
  }
  if (!result.data) notFound();

  const { teacher, subjects, classes } = result.data;
  const name = teacher.public_name || "Lexify teacher";
  const chat = whatsappHref(teacher.public_whatsapp, enquiryMessage(name))
    ? buildWhatsAppHandoffHref("teacher_profile", id)
    : null;

  return (
    <main className="page-content">
      <div className="container">
        <p className="breadcrumb">
          <Link href="/teachers">Teachers</Link>{" "}
          <span aria-hidden="true">/</span> Profile
        </p>
        <section className="profile-hero">
          {teacher.public_avatar_url ? (
            <img
              src={teacher.public_avatar_url}
              alt={`${name} profile`}
              width={120}
              height={120}
            />
          ) : (
            <div className="profile-avatar" aria-hidden="true">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <div className="teacher-card__top">
              <h1>{name}</h1>
              {teacher.verification_status === "verified" ? (
                <span className="verified-pill">Verified teacher</span>
              ) : (
                <span className="neutral-pill">Not verified</span>
              )}
            </div>
            <p>
              {teacher.bio ||
                "This teacher has not added a public biography yet."}
            </p>
            <p className="muted">
              {typeof teacher.experience_years === "number"
                ? `${teacher.experience_years} years of experience`
                : "Experience not listed"}
            </p>
            <div className="profile-hero__actions">
              {chat ? (
                <a
                  className="button button--gold"
                  href={chat}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ask on WhatsApp
                </a>
              ) : (
                <span className="muted">
                  WhatsApp contact is not available for this profile.
                </span>
              )}
              <a className="button button--line" href="#classes">
                View published classes
              </a>
            </div>
            <p className="muted">
              A WhatsApp chat is an enquiry only; it does not confirm a booking
              or payment.
            </p>
          </div>
        </section>

        <section
          className="section-block"
          aria-labelledby="learning-areas-title"
        >
          <div className="section-head">
            <div>
              <span className="section-kicker">Learning areas</span>
              <h2 className="section-title" id="learning-areas-title">
                Subjects and grades
              </h2>
            </div>
          </div>
          {subjects.length ? (
            <div className="subject-grid">
              {subjects.map(subject => (
                <SubjectCard
                  key={subject.id}
                  title={subject.title}
                  iconName={subject.icon_name}
                  accentColor={subject.accent_color}
                  illustrationUrl={subject.illustration_url}
                  tag={
                    subject.grade_name
                      ? `Grade ${subject.grade_name}`
                      : "Grade not listed"
                  }
                  note={
                    subject.grade_name
                      ? `Grade ${subject.grade_name}`
                      : "Grade not listed"
                  }
                />
              ))}
            </div>
          ) : (
            <p className="empty-inline">
              No learning areas are currently shown because this teacher has no
              published class options.
            </p>
          )}
        </section>

        <section
          className="section-block"
          id="classes"
          aria-labelledby="classes-title"
        >
          <div className="section-head">
            <div>
              <span className="section-kicker">Published class options</span>
              <h2 className="section-title" id="classes-title">
                Available classes
              </h2>
            </div>
          </div>
          {classes.length ? (
            <div className="card-grid">
              {classes.map(classRecord => {
                const classChat = whatsappHref(
                  teacher.public_whatsapp,
                  enquiryMessage(name, classRecord.title)
                )
                  ? buildWhatsAppHandoffHref("class", classRecord.id)
                  : null;
                return (
                  <article className="content-card" key={classRecord.id}>
                    <h3>{classRecord.title}</h3>
                    <p>
                      {classRecord.description ||
                        "Class description not provided."}
                    </p>
                    <p className="class-meta">
                      {[classRecord.grade_name, classRecord.area_title]
                        .filter(Boolean)
                        .join(" · ") || "Grade and learning area not listed"}
                    </p>
                    <p>
                      <strong>{money(classRecord.price_kes)}</strong>{" "}
                      <span className="muted">
                        per{" "}
                        {classRecord.pricing_basis === "lesson_bundle"
                          ? "lesson bundle"
                          : classRecord.pricing_basis}
                      </span>
                      {classRecord.pricing_basis === "lesson_bundle" &&
                      classRecord.lessons_in_bundle ? (
                        <span className="muted">
                          {" "}
                          ({classRecord.lessons_in_bundle} lessons)
                        </span>
                      ) : null}
                    </p>
                    {classChat ? (
                      <a
                        className="button button--blue button--small"
                        href={classChat}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ask about this class
                      </a>
                    ) : (
                      <p className="muted">
                        WhatsApp contact is not available for this teacher.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <h2>No published classes</h2>
              <p>
                This teacher has no active, published class options right now.
                Contacting a teacher directly is an enquiry and does not confirm
                a booking or payment.
              </p>
              {chat ? (
                <a
                  className="button button--gold"
                  href={chat}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ask on WhatsApp
                </a>
              ) : null}
            </div>
          )}
        </section>

        <p className="disclaimer">
          Profile availability and verification status are shown as provided by
          the platform. Confirm details directly with the teacher; a chat is not
          a confirmed booking or payment.
        </p>
      </div>
    </main>
  );
}
