import Link from "next/link";
import { PortalEmpty, PortalHeading, PortalRole, RecordList } from "./portal-ui";
import type { CurrentProfile } from "@/lib/auth/guards";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSection } from "./portal-data";
import styles from "./portal.module.css";

const sections: Record<PortalRole, Record<string, { title: string; description: string }>> = {
  student: {
    lessons: { title: "Lessons & calendar", description: "Class lessons and their scheduled dates, visible to your account." }, calendar: { title: "Lessons calendar", description: "Your class lesson schedule." },
    quizzes: { title: "Quizzes & homework", description: "Your recorded quiz attempts and class homework submissions." }, homework: { title: "Homework", description: "Your recorded class homework submissions." }, resources: { title: "Teacher resources", description: "Resources shared with your student account by teachers." },
    groups: { title: "Class groups", description: "Groups where your account has a recorded membership." }, community: { title: "Community", description: "Community channels your account has joined, subject to consent controls." },
    questions: { title: "Questions & answers", description: "Your questions and public questions currently visible to you." }, courses: { title: "Academy: My courses", description: "Your active or completed course enrolments." }, library: { title: "Projects: My library", description: "Project entitlements attached to your account." },
    payments: { title: "Payments & receipts", description: "Payment and receipt records visible to your account." }, profile: { title: "Profile & settings", description: "Profile information currently available to this portal." },
  },
  parent: {
    children: { title: "Linked children", description: "Only confirmed parent–learner links are shown." }, reports: { title: "Learning & reports", description: "Learning records and any generated reports for confirmed linked learners." }, payments: { title: "Payments & receipts", description: "Payment requests relating to linked learners and available receipts." },
    teachers: { title: "Teacher contacts", description: "Teacher contacts for classes in which a confirmed linked learner is enrolled." }, community: { title: "Community controls", description: "View the available parental and learner community-access settings." }, profile: { title: "Profile & settings", description: "Parent account information currently available to this portal." },
  },
  teacher: {
    classes: { title: "Classes & pricing", description: "Your classes, published prices, payment basis and lesson bundles." }, payments: { title: "Payments requested", description: "Payment requests recorded under your teacher account." }, students: { title: "Students & progress", description: "Learners enrolled in your classes and their recorded attendance, assessments and homework." },
    materials: { title: "Teaching materials", description: "Teaching materials you own. Secure file downloads require a configured endpoint." }, groups: { title: "Groups", description: "Groups created under your teacher account." }, statement: { title: "Payout statement", description: "Ledger entries and payout requests visible to your teacher account." },
    badge: { title: "Badge status", description: "Teacher verification, badge awards and badge purchases recorded for your account." }, profile: { title: "Profile & settings", description: "Teacher profile information currently available to this portal." },
  },
  guest: {
    courses: { title: "My courses", description: "Course enrolments and recorded lesson progress." }, certificates: { title: "Certificates", description: "Certificates issued to your account." }, library: { title: "Purchased projects", description: "Active product entitlements attached to your account." }, payments: { title: "Receipts & payments", description: "Payments and receipts visible to your account." }, profile: { title: "Profile", description: "Guest learner account information currently available to this portal." },
  },
};

export async function PortalSection({ role, section, profile, client }: { role: PortalRole; section: string; profile: CurrentProfile; client: SupabaseClient }) {
  const config = sections[role][section];
  if (!config) return <PortalEmpty title="Section not found">This portal section is not available. Choose another item from the portal navigation.</PortalEmpty>;
  const data = await readSection(client, profile, role, section);
  return <>
    <PortalHeading eyebrow={`${role} portal`} title={config.title} description={config.description} />
    {data.note ? <aside className={styles.note} role="note">{data.note}</aside> : null}
    <RecordList records={data.records} emptyTitle={`No ${config.title.toLowerCase()} records yet`} emptyMessage="Nothing is currently available for this section. New records appear here only when they are visible to your account." />
    {role === "parent" && section === "reports" ? <div className={`portal-panel ${styles.actionPanel}`}><h2>Report downloads</h2><p>Monthly and term report generation or download endpoints are not configured yet. No download link is shown until a matching secure endpoint is available.</p><span className={styles.disabledAction} aria-disabled="true">Request / download report — not yet configured</span></div> : null}
    {role === "student" && section === "community" ? <div className={`portal-panel ${styles.actionPanel}`}><h2>Safety & consent</h2><p>Community access is subject to the student community setting, guardian controls and required consent records. This read-only view does not change membership.</p></div> : null}
    {role === "teacher" && section === "materials" ? <div className={`portal-panel ${styles.actionPanel}`}><h2>Material downloads</h2><p>Files are stored privately. No direct storage path is exposed; a secure signed-download route must be configured to retrieve them.</p></div> : null}
    {role === "guest" && section === "library" ? <div className={`portal-panel ${styles.actionPanel}`}><h2>Project downloads</h2><p>Paid project files are private. A secure entitlement-checked download endpoint is not configured here, so no storage link is displayed.</p></div> : null}
    <div className={styles.actions}><Link className="button button--line" href={`/${role}/dashboard`}>Back to overview</Link></div>
  </>;
}
