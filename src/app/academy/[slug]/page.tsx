import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedAcademyCourse } from "@/lib/data/academy";
import { buildWhatsAppHandoffHref } from "@/lib/whatsapp/handoff";
import { whatsappHref } from "@/lib/whatsapp/links";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

function getCourseResultError(
  result: Awaited<ReturnType<typeof getPublishedAcademyCourse>>
) {
  return result.error;
}

function formatPrice(price: Record<string, unknown> | null): string | null {
  if (!price) return null;
  const base = Number(price.price_kes);
  const sale = Number(price.sale_price_kes);
  const amount = Number.isFinite(sale) && sale > 0 && sale < base ? sale : base;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublishedAcademyCourse(slug);
  if (getCourseResultError(result)) {
    return {
      title: "Course temporarily unavailable",
      robots: { index: false, follow: false },
    };
  }
  if (!result.data)
    return {
      title: "Course not found",
      robots: { index: false, follow: false },
    };
  const { course } = result.data;
  const title = String(course.title);
  const description = String(
    course.description || `Explore the ${title} course at Lexify School.`
  ).slice(0, 155);
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  const path = `/academy/${encodeURIComponent(slug)}`;
  return {
    title,
    description,
    alternates: origin
      ? { canonical: new URL(path, origin).toString() }
      : undefined,
    openGraph: {
      type: "website",
      title: `${title} | Lexify School`,
      description,
      url: origin ? new URL(path, origin).toString() : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Lexify School`,
      description,
    },
  };
}

export default async function AcademyCoursePage({ params }: Props) {
  const { slug } = await params;
  const result = await getPublishedAcademyCourse(slug);
  if (result.error) {
    return (
      <main className="page-content">
        <div className="container">
          <section className="empty-state" role="alert">
            <h1>Course temporarily unavailable</h1>
            <p>
              We could not load this course right now. Please try again later.
            </p>
            <Link className="button button--line" href="/academy">
              Back to Academy
            </Link>
          </section>
        </div>
      </main>
    );
  }
  if (!result.data) notFound();
  const { course, modules, lessons, price, seller } = result.data;
  const currentPrice = formatPrice(price);
  const sellerName = String(seller?.public_name || "the instructor");
  const instructorAssigned = typeof course.instructor_id === "string";
  const inquirySeller = instructorAssigned ? sellerName : "Lexify School";
  const inquiryHref = whatsappHref(
    instructorAssigned
      ? typeof seller?.public_whatsapp === "string"
        ? seller.public_whatsapp
        : null
      : process.env.WHATSAPP_ADMIN_NUMBER,
    `Hello ${inquirySeller}, I found the ${String(course.title)} course on Lexify School and would like to ask about its availability and current price.`
  )
    ? buildWhatsAppHandoffHref("course", String(course.id))
    : null;
  const previewLessonCount = lessons.filter(
    lesson => lesson.is_free_preview === true
  ).length;
  const visibleLessonCount = lessons.length;

  return (
    <main className="page-content">
      <div className="container">
        <p className="breadcrumb">
          <Link href="/academy">Academy</Link> <span aria-hidden="true">/</span>{" "}
          {String(course.title)}
        </p>
        <section className="detail-hero">
          <div>
            <span className="section-kicker">Computer Packages Academy</span>
            <h1>{String(course.title)}</h1>
            <p>
              {String(
                course.description ||
                  "Course details will be confirmed by the instructor."
              )}
            </p>
            <div className="detail-hero__meta">
              {course.level ? <span>{String(course.level)}</span> : null}
              {typeof course.duration_minutes === "number" ? (
                <span>{course.duration_minutes} minutes</span>
              ) : null}
              {previewLessonCount > 0 ? (
                <strong>
                  {previewLessonCount} free preview{" "}
                  {previewLessonCount === 1 ? "lesson" : "lessons"}
                </strong>
              ) : null}
              {visibleLessonCount > previewLessonCount ? (
                <span>
                  {visibleLessonCount - previewLessonCount} additional{" "}
                  {visibleLessonCount - previewLessonCount === 1
                    ? "lesson"
                    : "lessons"}{" "}
                  available to this account
                </span>
              ) : null}
              {currentPrice ? (
                <span>Published price: {currentPrice}</span>
              ) : (
                <span>Price: ask the instructor</span>
              )}
            </div>
            {inquiryHref ? (
              <a
                className="button button--gold"
                href={inquiryHref}
                target="_blank"
                rel="noreferrer"
              >
                Ask {instructorAssigned ? "the instructor" : "Lexify School"} on
                WhatsApp
              </a>
            ) : (
              <p role="status">
                A seller WhatsApp contact is not available for this course. No
                payment or enrolment is started from this page.
              </p>
            )}
          </div>
          <aside className="detail-aside">
            <strong>Published course information</strong>
            <p>
              Free previews and any lessons visible to your current account are
              linked here. Other course content stays protected by course access
              rules; confirm access and final pricing with the instructor.
            </p>
          </aside>
        </section>

        <section className="section-block">
          <div className="section-head">
            <div>
              <span className="section-kicker">Course outline</span>
              <h2 className="section-title">Modules and available lessons</h2>
            </div>
          </div>
          {modules.length ? (
            <div className="module-list">
              {modules.map(module => {
                const moduleLessons = lessons.filter(
                  lesson => String(lesson.module_id) === String(module.id)
                );
                return (
                  <details className="module-item" key={String(module.id)}>
                    <summary>
                      <span>
                        <strong>{String(module.title)}</strong>
                        <small>
                          {moduleLessons.length
                            ? `${moduleLessons.filter(lesson => lesson.is_free_preview === true).length} free preview${moduleLessons.filter(lesson => lesson.is_free_preview === true).length === 1 ? "" : "s"} · ${moduleLessons.length} available ${moduleLessons.length === 1 ? "lesson" : "lessons"}`
                            : "No published lesson is available to this account"}
                        </small>
                      </span>
                      <span aria-hidden="true">+</span>
                    </summary>
                    {module.description ? (
                      <p>{String(module.description)}</p>
                    ) : null}
                    {moduleLessons.length ? (
                      <ol>
                        {moduleLessons.map(lesson => (
                          <li key={String(lesson.id)}>
                            <Link
                              href={`/academy/${encodeURIComponent(String(course.code).toLowerCase())}/lessons/${encodeURIComponent(String(lesson.id))}`}
                            >
                              {String(lesson.title)}
                              {typeof lesson.estimated_minutes === "number"
                                ? ` · ${lesson.estimated_minutes} min`
                                : ""}
                            </Link>
                            <span className="preview-pill">
                              {lesson.is_free_preview === true
                                ? "Free preview"
                                : "Available to your account"}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <h2>Course outline coming soon</h2>
              <p>
                This published course does not have a released module outline
                yet.
              </p>
            </div>
          )}
        </section>
        <p className="disclaimer">
          Course availability and pricing are confirmed by the instructor. This
          page does not take payment, create enrolment, or grant full-course
          access.
        </p>
      </div>
    </main>
  );
}
