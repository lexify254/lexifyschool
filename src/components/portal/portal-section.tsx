import Link from "next/link";
import {
  PortalEmpty,
  PortalHeading,
  PortalRole,
  RecordList,
} from "./portal-ui";
import type { CurrentProfile } from "@/lib/auth/guards";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSection } from "./portal-data";
import styles from "./portal.module.css";

const sections: Record<
  PortalRole,
  Record<string, { title: string; description: string }>
> = {
  student: {
    lessons: {
      title: "Lessons & calendar",
      description:
        "Class lessons and their scheduled dates, visible to your account.",
    },
    calendar: {
      title: "Lessons calendar",
      description: "Your class lesson schedule.",
    },
    quizzes: {
      title: "Quizzes & homework",
      description:
        "Your recorded quiz attempts and class homework submissions.",
    },
    homework: {
      title: "Homework",
      description: "Your recorded class homework submissions.",
    },
    resources: {
      title: "Teacher resources",
      description: "Resources shared with your student account by teachers.",
    },
    groups: {
      title: "Class groups",
      description: "Groups where your account has a recorded membership.",
    },
    community: {
      title: "Community",
      description:
        "Community channels your account has joined, subject to consent controls.",
    },
    questions: {
      title: "Questions & answers",
      description: "Questions created by your signed-in learner account.",
    },
    courses: {
      title: "Academy: My courses",
      description:
        "Your active or completed course enrolments and recorded lesson progress.",
    },
    library: {
      title: "Learning projects",
      description: "Active project access attached to your account.",
    },
    profile: {
      title: "Profile & settings",
      description: "Profile information currently available to this portal.",
    },
  },
  parent: {
    children: {
      title: "Linked children",
      description: "Only confirmed parent–learner links are shown.",
    },
    reports: {
      title: "Learning & reports",
      description: "Generated learning reports for confirmed linked learners.",
    },
    teachers: {
      title: "Teacher contacts",
      description:
        "Teacher contacts for classes in which a confirmed linked learner is enrolled.",
    },
    community: {
      title: "Community controls",
      description:
        "View the available parental and learner community-access settings.",
    },
    profile: {
      title: "Profile & settings",
      description:
        "Parent account information currently available to this portal.",
    },
  },
  teacher: {
    classes: {
      title: "My classes",
      description:
        "Classes owned by your teacher account, with learning area, grade and schedule details.",
    },
    students: {
      title: "Students & progress",
      description:
        "Learners enrolled in your classes and their recorded attendance, assessments and homework.",
    },
    materials: {
      title: "Teaching materials",
      description:
        "Teaching materials you own. Secure file downloads require a configured endpoint.",
    },
    groups: {
      title: "Groups",
      description: "Groups created under your teacher account.",
    },
    badge: {
      title: "Badge status",
      description:
        "Teacher verification status and badge awards recorded for your account.",
    },
    profile: {
      title: "Profile & settings",
      description:
        "Teacher profile information currently available to this portal.",
    },
  },
  guest: {
    courses: {
      title: "My courses",
      description: "Course enrolments and recorded lesson progress.",
    },
    certificates: {
      title: "Certificates",
      description: "Certificates issued to your account.",
    },
    library: {
      title: "Learning projects",
      description: "Active project access attached to your account.",
    },
    profile: {
      title: "Profile",
      description:
        "Guest learner account information currently available to this portal.",
    },
  },
};

export async function PortalSection({
  role,
  section,
  profile,
  client,
}: {
  role: PortalRole;
  section: string;
  profile: CurrentProfile;
  client: SupabaseClient;
}) {
  const config = sections[role][section];
  if (!config)
    return (
      <PortalEmpty title="Section not found">
        This portal section is not available. Choose another item from the
        portal navigation.
      </PortalEmpty>
    );
  const data = await readSection(client, profile, role, section);
  return (
    <>
      <PortalHeading
        eyebrow={`${role} portal`}
        title={config.title}
        description={config.description}
      />
      {data.note ? (
        <aside className={styles.note} role="note">
          {data.note}
        </aside>
      ) : null}
      <RecordList
        records={data.records}
        emptyTitle={`No ${config.title.toLowerCase()} records yet`}
        emptyMessage="No records are currently visible to your signed-in account for this section. New items appear when they are available under your account access."
      />
      {role === "student" && section === "community" ? (
        <div className={`portal-panel ${styles.actionPanel}`}>
          <h2>Safety & consent</h2>
          <p>
            Community access is subject to the student community setting,
            guardian controls and required consent records. This read-only view
            does not change membership.
          </p>
        </div>
      ) : null}
      {role === "teacher" && section === "materials" ? (
        <div className={`portal-panel ${styles.actionPanel}`}>
          <h2>Material downloads</h2>
          <p>
            Files are stored privately. No direct storage path is exposed; a
            secure signed-download route must be configured to retrieve them.
          </p>
        </div>
      ) : null}
      {role === "guest" && section === "library" ? (
        <div className={`portal-panel ${styles.actionPanel}`}>
          <h2>Project files</h2>
          <p>
            Learning project files are private. No secure entitlement-checked
            download route is configured, so no storage link is displayed.
          </p>
        </div>
      ) : null}
      <div className={styles.actions}>
        <Link className="button button--line" href={`/${role}/dashboard`}>
          Back to overview
        </Link>
      </div>
    </>
  );
}
