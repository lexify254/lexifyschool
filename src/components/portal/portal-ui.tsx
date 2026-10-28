import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleHelp,
  FileText,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  MessageCircle,
  Settings,
  UsersRound,
} from "lucide-react";
import { SubjectCard } from "@/components/subject-card";
import styles from "./portal.module.css";
import type { AppRole, CurrentProfile } from "@/lib/auth/guards";

export type PortalRole = Exclude<AppRole, "admin">;
export type PortalRecord = {
  title: string;
  detail?: string;
  meta?: string;
  href?: string;
  tone?: "good" | "warn" | "neutral";
};

const roleLabels: Record<PortalRole, string> = {
  student: "Student",
  parent: "Parent",
  teacher: "Teacher",
  guest: "Guest learner",
};
const nav: Record<
  PortalRole,
  { title: string; href: string; icon: typeof LayoutDashboard }[]
> = {
  student: [
    { title: "Overview", href: "/student/dashboard", icon: LayoutDashboard },
    {
      title: "Lessons & calendar",
      href: "/student/lessons",
      icon: CalendarDays,
    },
    { title: "Quizzes & homework", href: "/student/quizzes", icon: FileText },
    { title: "Teacher resources", href: "/student/resources", icon: BookOpen },
    { title: "Class groups", href: "/student/groups", icon: UsersRound },
    { title: "Community", href: "/community", icon: MessageCircle },
    {
      title: "Questions & answers",
      href: "/student/questions",
      icon: CircleHelp,
    },
    {
      title: "Academy: My courses",
      href: "/student/courses",
      icon: GraduationCap,
    },
    { title: "Learning projects", href: "/student/library", icon: LibraryBig },
    { title: "Profile & settings", href: "/student/profile", icon: Settings },
  ],
  parent: [
    { title: "Overview", href: "/parent/dashboard", icon: LayoutDashboard },
    { title: "Linked children", href: "/parent/children", icon: UsersRound },
    { title: "Learning & reports", href: "/parent/reports", icon: FileText },
    {
      title: "Teacher contacts",
      href: "/parent/teachers",
      icon: MessageCircle,
    },
    { title: "Community controls", href: "/parent/community", icon: Settings },
    { title: "Profile & settings", href: "/parent/profile", icon: Settings },
  ],
  teacher: [
    { title: "Overview", href: "/teacher/dashboard", icon: LayoutDashboard },
    { title: "My classes", href: "/teacher/classes", icon: BookOpen },
    {
      title: "Students & progress",
      href: "/teacher/students",
      icon: UsersRound,
    },
    { title: "Teaching materials", href: "/teacher/materials", icon: FileText },
    { title: "Groups", href: "/teacher/groups", icon: MessageCircle },
    { title: "Badge status", href: "/teacher/badge", icon: GraduationCap },
    { title: "Profile & settings", href: "/teacher/profile", icon: Settings },
  ],
  guest: [
    { title: "Overview", href: "/guest/dashboard", icon: LayoutDashboard },
    { title: "My courses", href: "/guest/courses", icon: GraduationCap },
    { title: "Certificates", href: "/guest/certificates", icon: FileText },
    { title: "Learning projects", href: "/guest/library", icon: FolderKanban },
    { title: "Profile", href: "/guest/profile", icon: Settings },
  ],
};

export function PortalFrame({
  role,
  profile,
  activeHref,
  children,
}: {
  role: PortalRole;
  profile: CurrentProfile;
  activeHref: string;
  children: React.ReactNode;
}) {
  return (
    <main className="portal-shell">
      <div className="container portal-layout">
        <aside
          className="portal-sidebar"
          aria-label={`${roleLabels[role]} portal navigation`}
        >
          <h2>{roleLabels[role]} portal</h2>
          <nav className="portal-nav">
            {nav[role].map(item => {
              const Icon = item.icon;
              return (
                <Link
                  href={item.href}
                  key={item.href}
                  aria-current={activeHref === item.href ? "page" : undefined}
                >
                  <Icon size={17} aria-hidden="true" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
          <div className={styles.identity}>
            <span>Signed in as</span>
            <strong>{profile.full_name || roleLabels[role]}</strong>
          </div>
        </aside>
        <div className="portal-main">{children}</div>
      </div>
    </main>
  );
}

export function PortalHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="portal-heading">
      <span className="section-kicker">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
export function PortalEmpty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function PortalUnavailable() {
  return (
    <main className="portal-shell">
      <div className="container">
        <section className="empty-state" role="status">
          <h1>Portal temporarily unavailable</h1>
          <p>
            The Supabase backend is not configured for this deployment, so
            private account data cannot be loaded. No placeholder records are
            shown. Please try again when the connection is ready.
          </p>
          <Link className="button button--blue" href="/">
            Return to Lexify School
          </Link>
        </section>
      </div>
    </main>
  );
}
export function StatGrid({
  stats,
}: {
  stats: { label: string; value: string; note?: string }[];
}) {
  return (
    <div className="portal-grid">
      {stats.map(stat => (
        <article className="stat-card" key={stat.label}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          {stat.note ? (
            <small className={styles.statNote}>{stat.note}</small>
          ) : null}
        </article>
      ))}
    </div>
  );
}
export function RecordList({
  records,
  emptyTitle = "Nothing to show yet",
  emptyMessage = "Items will appear here when they are available to your account.",
}: {
  records: PortalRecord[];
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  if (!records.length)
    return <PortalEmpty title={emptyTitle}>{emptyMessage}</PortalEmpty>;
  return (
    <ul className={styles.recordList}>
      {records.map((item, index) => (
        <li className={styles.record} key={`${item.title}-${index}`}>
          <div className={styles.recordBody}>
            <strong>
              {item.href?.startsWith("https://") ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="button button--line button--small"
                >
                  {item.title}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : item.href ? (
                <Link href={item.href}>
                  {item.title}
                  <span className="sr-only"> (open)</span>
                </Link>
              ) : (
                item.title
              )}
            </strong>
            {item.detail ? <span>{item.detail}</span> : null}
            {item.meta ? <small>{item.meta}</small> : null}
          </div>
          {item.tone ? (
            <span
              className={`${styles.status} ${item.tone === "good" ? styles.statusGood : item.tone === "warn" ? styles.statusWarn : ""}`}
            >
              {item.tone === "good"
                ? "Current"
                : item.tone === "warn"
                  ? "Attention"
                  : "Information"}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
export function SubjectGrid({
  subjects,
}: {
  subjects: {
    id: string;
    title: string;
    iconName?: string | null;
    accentColor?: string | null;
    illustrationUrl?: string | null;
    note?: string;
  }[];
}) {
  if (!subjects.length)
    return (
      <PortalEmpty title="No learning areas selected">
        Your selected learning areas will appear here once they are available in
        your learner profile.
      </PortalEmpty>
    );
  return (
    <div className="subject-grid">
      {subjects.map(subject => (
        <SubjectCard
          key={subject.id}
          title={subject.title}
          iconName={subject.iconName}
          accentColor={subject.accentColor}
          illustrationUrl={subject.illustrationUrl}
          note={subject.note}
        />
      ))}
    </div>
  );
}
export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="portal-panel">
      <div className={styles.panelHeading}>
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function FormatLink({
  href,
  children,
}: {
  href?: string | null;
  children: React.ReactNode;
}) {
  return href ? (
    <a
      className="button button--line button--small"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
      <ArrowRight size={15} aria-hidden="true" />
    </a>
  ) : (
    <span className={styles.disabledAction} aria-disabled="true">
      {children} — not yet configured
    </span>
  );
}
