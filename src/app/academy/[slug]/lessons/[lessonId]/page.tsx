import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAvailablePublishedLesson } from "@/lib/data/academy";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string; lessonId: string }> };
type ContentBlock = { label: string; text: string; href?: string };

function contentBlocks(content: unknown): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const visit = (value: unknown, label: string, depth: number) => {
    if (depth > 5 || value == null) return;
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) return;
      if (
        /(?:^|_)(?:video|source|lesson|external|reference)?_?url$/i.test(label)
      ) {
        try {
          const parsed = new URL(text);
          if (parsed.protocol === "https:")
            blocks.push({
              label: label.replace(/_/g, " "),
              text,
              href: parsed.toString(),
            });
        } catch {
          // Malformed or non-HTTPS URLs are not rendered as links.
        }
        return;
      }
      if (/(path|file|token|secret|signed|storage|key)/i.test(label)) return;
      blocks.push({ label: label.replace(/[_-]/g, " "), text });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        visit(item, `${label} ${index + 1}`, depth + 1)
      );
      return;
    }
    if (typeof value === "object") {
      for (const [key, child] of Object.entries(
        value as Record<string, unknown>
      )) {
        if (/(path|file|token|secret|signed|storage|key)/i.test(key)) continue;
        visit(child, key, depth + 1);
      }
    }
  };
  visit(content, "Lesson", 0);
  return blocks;
}

function sortPreviewLessons(
  lessons: Record<string, unknown>[],
  modules: Record<string, unknown>[]
) {
  const moduleOrder = new Map(
    modules.map((module, index) => [String(module.id), index])
  );
  return [...lessons].sort((a, b) => {
    const aModule =
      moduleOrder.get(String(a.module_id)) ?? Number.MAX_SAFE_INTEGER;
    const bModule =
      moduleOrder.get(String(b.module_id)) ?? Number.MAX_SAFE_INTEGER;
    if (aModule !== bModule) return aModule - bModule;
    return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, lessonId } = await params;
  const result = await getAvailablePublishedLesson(slug, lessonId);
  if (result.error)
    return {
      title: "Lesson temporarily unavailable",
      robots: { index: false, follow: false },
    };
  if (!result.data)
    return {
      title: "Lesson not found",
      robots: { index: false, follow: false },
    };
  return {
    title: `${String(result.data.lesson.title)} | ${String(result.data.course.title)}`,
    description:
      result.data.lesson.is_free_preview === true
        ? `Free preview lesson from ${String(result.data.course.title)} at Lexify School.`
        : `Published lesson from ${String(result.data.course.title)} at Lexify School.`,
    robots: { index: false, follow: true },
  };
}

export default async function AcademyLessonPage({ params }: Props) {
  const { slug, lessonId } = await params;
  const result = await getAvailablePublishedLesson(slug, lessonId);
  if (result.error) {
    return (
      <main className="page-content">
        <div className="container">
          <section className="empty-state" role="alert">
            <h1>Lesson temporarily unavailable</h1>
            <p>This preview could not be loaded. Please try again later.</p>
            <Link
              className="button button--line"
              href={`/academy/${encodeURIComponent(slug)}`}
            >
              Back to course
            </Link>
          </section>
        </div>
      </main>
    );
  }
  if (!result.data) notFound();
  const { course, module, lesson, modules } = result.data;
  const isFreePreview = lesson.is_free_preview === true;
  const orderedLessons = sortPreviewLessons(result.data.lessons, modules);
  const currentIndex = orderedLessons.findIndex(
    row => String(row.id) === String(lesson.id)
  );
  const previous = currentIndex > 0 ? orderedLessons[currentIndex - 1] : null;
  const next =
    currentIndex >= 0 && currentIndex < orderedLessons.length - 1
      ? orderedLessons[currentIndex + 1]
      : null;
  const blocks = contentBlocks(lesson.content);
  const coursePath = `/academy/${encodeURIComponent(String(course.code).toLowerCase())}`;
  const lessonPath = (row: Record<string, unknown>) =>
    `${coursePath}/lessons/${encodeURIComponent(String(row.id))}`;

  return (
    <main className="page-content">
      <div className="container">
        <p className="breadcrumb">
          <Link href="/academy">Academy</Link> <span aria-hidden="true">/</span>{" "}
          <Link href={coursePath}>{String(course.title)}</Link>{" "}
          <span aria-hidden="true">/</span> {String(lesson.title)}
        </p>
        <section className="detail-hero">
          <div>
            <span className="section-kicker">
              {isFreePreview ? "Free preview lesson" : "Published lesson"}
            </span>
            <h1>{String(lesson.title)}</h1>
            <p>
              {String(module.title)}
              {typeof lesson.estimated_minutes === "number"
                ? ` · ${lesson.estimated_minutes} minutes`
                : ""}
            </p>
            <p>
              {isFreePreview
                ? "This lesson is published and marked as a free preview. Opening it does not enrol you or grant access to other course material."
                : "This published lesson is readable in your current session. Access to other course content remains governed by course permissions."}
            </p>
          </div>
          <aside className="detail-aside">
            <strong>{String(course.title)}</strong>
            <p>Lesson type: {String(lesson.lesson_type).replace(/_/g, " ")}</p>
            <Link href={coursePath}>View course outline</Link>
          </aside>
        </section>

        <article className="section-block">
          <div className="section-head">
            <div>
              <span className="section-kicker">{String(module.title)}</span>
              <h2 className="section-title">Lesson content</h2>
            </div>
          </div>
          {blocks.length ? (
            <div className="module-list">
              {blocks.map((block, index) => (
                <section
                  className="module-item"
                  key={`${block.label}-${index}`}
                >
                  {block.label !== "Lesson" ? <h3>{block.label}</h3> : null}
                  {block.href ? (
                    <p>
                      <a href={block.href} target="_blank" rel="noreferrer">
                        Open published lesson resource
                      </a>
                    </p>
                  ) : (
                    <p style={{ whiteSpace: "pre-wrap" }}>{block.text}</p>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>Preview content not available yet</h2>
              <p>
                This lesson is listed as a free preview, but its readable lesson
                material has not been added.
              </p>
            </div>
          )}
        </article>

        <nav
          aria-label="Free preview lesson navigation"
          className="market-strip"
        >
          <div>
            {previous ? (
              <>
                <span className="section-kicker">Previous preview</span>
                <p>
                  <Link href={lessonPath(previous)}>
                    {String(previous.title)}
                  </Link>
                </p>
              </>
            ) : (
              <p>First available preview lesson</p>
            )}
          </div>
          <div className="market-strip__links">
            <Link className="button button--line" href={coursePath}>
              Course outline
            </Link>
            {next ? (
              <Link className="button button--gold" href={lessonPath(next)}>
                Next preview
              </Link>
            ) : (
              <span>End of available previews</span>
            )}
          </div>
        </nav>
        <p className="disclaimer">
          No payment or enrolment is started here. Ask the instructor about
          access to other course lessons.
        </p>
      </div>
    </main>
  );
}
