import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin overview" };

type Metric = { label: string; count: number | null; hint: string };

async function exactCount(
  client: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  table: string,
  applyFilter?: (query: any) => any
): Promise<number | null> {
  try {
    let query = client.from(table).select("id", { count: "exact", head: true });
    if (applyFilter) query = applyFilter(query);
    const { count, error } = await query;
    return error || typeof count !== "number" ? null : count;
  } catch {
    return null;
  }
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <article className="admin-metric">
      <span className="admin-metric__label">{metric.label}</span>
      <strong className="admin-metric__value">
        {metric.count === null ? "—" : metric.count.toLocaleString()}
      </strong>
      <span className="admin-metric__hint">
        {metric.count === null
          ? "Unavailable — check data access"
          : metric.hint}
      </span>
    </article>
  );
}

const sections = [
  {
    title: "Users",
    href: "/admin/users",
    detail: "Review account roles and suspend or restore non-admin accounts.",
  },
  {
    title: "Content",
    href: "/admin/content",
    detail:
      "Manage course drafts, modules, lessons, publication, and archive status.",
  },
  {
    title: "Curriculum",
    href: "/admin/curriculum",
    detail:
      "Manage system and grade availability and learning-area presentation.",
  },
  {
    title: "Seller receipts",
    href: "/admin/receipts",
    detail:
      "Review seller-reported receipts for sales completed outside Lexify School.",
  },
];

export default async function AdminOverviewPage() {
  await requireAdmin();
  const supabase = await getSupabaseServerClient();
  const metrics: Metric[] = supabase
    ? await (async () => {
        const [counts, handoffResult] = await Promise.all([
          Promise.all([
            exactCount(supabase, "profiles"),
            exactCount(supabase, "profiles", query =>
              query.eq("is_suspended", true)
            ),
            exactCount(supabase, "courses", query =>
              query.eq("status", "published")
            ),
            exactCount(supabase, "courses", query =>
              query.eq("status", "draft")
            ),
            exactCount(supabase, "education_systems"),
            exactCount(supabase, "grades"),
            exactCount(supabase, "seller_receipts"),
          ]),
          (async () => {
            try {
              return await (supabase as any).rpc(
                "get_whatsapp_handoff_total_count"
              );
            } catch {
              return { data: null, error: true };
            }
          })(),
        ]);
        const labels = [
          "Profile records",
          "Suspended accounts",
          "Published courses",
          "Draft courses",
          "Education systems",
          "Grades",
          "Seller-issued receipts",
        ];
        const hints = [
          "All profiles",
          "Profile status flag",
          "Currently published",
          "Awaiting content",
          "Curriculum systems",
          "Configured grades",
          "Seller-reported external sales; no platform payment processed",
        ];
        const clickValue = handoffResult?.data;
        const handoffCount =
          !handoffResult?.error &&
          clickValue != null &&
          Number.isFinite(Number(clickValue))
            ? Number(clickValue)
            : null;
        return [
          ...counts.map((count, index) => ({
            label: labels[index],
            count,
            hint: hints[index],
          })),
          {
            label: "WhatsApp handoff clicks",
            count: handoffCount,
            hint: "Outbound clicks only; not messages, unique people, or sales",
          },
        ];
      })()
    : [
        "Profile records",
        "Suspended accounts",
        "Published courses",
        "Draft courses",
        "Education systems",
        "Grades",
        "Seller-issued receipts",
        "WhatsApp handoff clicks",
      ].map(label => ({ label, count: null, hint: "Unavailable" }));

  return (
    <div className="admin-page">
      <header className="admin-heading">
        <div>
          <span className="admin-kicker">Overview</span>
          <h1>Operations at a glance</h1>
          <p>
            Operational counts include aggregate WhatsApp handoff clicks and
            seller-reported receipts; Lexify School does not process or verify
            external payments.
          </p>
        </div>
      </header>

      <section aria-label="Live platform counts">
        <div className="admin-metrics">
          {metrics.map(metric => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>

      <section aria-labelledby="admin-sections-title">
        <h2 id="admin-sections-title" className="admin-section-title">
          Management areas
        </h2>
        <div className="admin-availability">
          {sections.map(section => (
            <Link
              className="admin-availability__card"
              href={section.href}
              key={section.href}
            >
              <strong>{section.title}</strong>
              <span className="admin-status admin-status--on">Available</span>
              <p>{section.detail}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
