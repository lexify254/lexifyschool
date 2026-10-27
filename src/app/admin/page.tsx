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
  applyFilter?: (query: any) => any,
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
      <strong className="admin-metric__value">{metric.count === null ? "—" : metric.count.toLocaleString()}</strong>
      <span className="admin-metric__hint">{metric.count === null ? "Unavailable — check data access" : metric.hint}</span>
    </article>
  );
}

const futurePanels = [
  { title: "Users", slug: "users", detail: "Accounts, roles, and account status" },
  { title: "Teachers", slug: "teachers", detail: "Teacher directory and verification workflow" },
  { title: "Transactions", slug: "transactions", detail: "Payments and marketplace activity" },
  { title: "Payouts", slug: "payouts", detail: "Review and process payout requests" },
  { title: "Courses", slug: "courses", detail: "Course catalogue and publication workflow" },
  { title: "Products", slug: "products", detail: "Digital product catalogue and publication" },
  { title: "Moderation", slug: "moderation", detail: "Review reports and moderation actions" },
  { title: "Reports", slug: "reports", detail: "Operational and platform reporting" },
];

export default async function AdminOverviewPage() {
  await requireAdmin();
  const supabase = await getSupabaseServerClient();
  const metrics: Metric[] = supabase
    ? await Promise.all([
        exactCount(supabase, "profiles"),
        exactCount(supabase, "teacher_details", (query) => query.eq("verification_status", "verified").eq("is_accepting_students", true)),
        exactCount(supabase, "teacher_details", (query) => query.eq("verification_status", "pending")),
        exactCount(supabase, "courses", (query) => query.eq("status", "published")),
        exactCount(supabase, "products", (query) => query.eq("status", "published")),
        exactCount(supabase, "payout_requests", (query) => query.eq("status", "requested")),
        exactCount(supabase, "message_reports", (query) => query.eq("status", "open")),
      ]).then(([users, teachers, pendingTeachers, courses, products, payouts, reports]) => [
        { label: "Users", count: users, hint: "All profile records" },
        { label: "Active teachers", count: teachers, hint: "Verified and accepting students" },
        { label: "Pending teacher verification", count: pendingTeachers, hint: "Awaiting verification review" },
        { label: "Published courses", count: courses, hint: "Currently published" },
        { label: "Published products", count: products, hint: "Currently published" },
        { label: "Pending payout requests", count: payouts, hint: "Requested, awaiting processing" },
        { label: "Open moderation reports", count: reports, hint: "Message reports with open status" },
      ] as Metric[])
    : [
        "Users", "Active teachers", "Pending teacher verification", "Published courses", "Published products", "Pending payout requests", "Open moderation reports",
      ].map((label) => ({ label, count: null, hint: "Unavailable" }));

  return (
    <div className="admin-page">
      <header className="admin-heading">
        <div><span className="admin-kicker">Overview</span><h1>Operations at a glance</h1><p>Live counts from the Lexify School database. Missing configuration or RLS errors are shown as unavailable rather than as zero.</p></div>
        <Link className="button button--line button--small" href="/admin/curriculum">Manage curriculum</Link>
      </header>

      <section aria-label="Live platform counts">
        <div className="admin-metrics">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div>
      </section>

      <section aria-labelledby="admin-sections-title">
        <h2 id="admin-sections-title" className="admin-section-title">Administrator sections</h2>
        <p className="section-copy" style={{ marginBottom: 16 }}>These panels are planned but not yet available. The links do not claim to perform management actions.</p>
        <div className="admin-availability">
          {futurePanels.map((panel) => (
            <Link className="admin-availability__card" href={`/admin/${panel.slug}`} key={panel.slug} aria-label={`${panel.title}, not yet available`}>
              <strong>{panel.title}</strong>
              <span>Not yet available</span>
              <p>{panel.detail}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
