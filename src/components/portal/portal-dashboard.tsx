import Link from "next/link";
import type { CurrentProfile } from "@/lib/auth/guards";
import type { PortalRole } from "./portal-ui";
import {
  Panel,
  PortalEmpty,
  PortalHeading,
  RecordList,
  StatGrid,
  SubjectGrid,
} from "./portal-ui";
import {
  readGuestDashboard,
  readParentDashboard,
  readStudentDashboard,
  readTeacherDashboard,
} from "./portal-data";
import type { SupabaseClient } from "@supabase/supabase-js";
import styles from "./portal.module.css";

export async function PortalDashboard({
  role,
  profile,
  client,
}: {
  role: PortalRole;
  profile: CurrentProfile;
  client: SupabaseClient;
}) {
  const heading = (
    <PortalHeading
      eyebrow={`${role} portal`}
      title={`Welcome${profile.full_name ? `, ${profile.full_name}` : ""}`}
      description={
        role === "student"
          ? "Your classes, lessons, attendance and learning progress from records available to your account."
          : role === "parent"
            ? "A learning overview for confirmed linked learners, including classes, courses, reports and teacher contacts."
            : role === "teacher"
              ? "Your classes, enrolled learners, upcoming lessons and recorded learning activity."
              : "Your enrolled courses, lesson progress, certificates and learning projects."
      }
    />
  );

  if (role === "student") {
    const data = await readStudentDashboard(client, profile);
    return (
      <>
        {heading}
        <StatGrid stats={data.stats} />
        <div className={styles.dashboardGrid}>
          <Panel title="My learning areas">
            <SubjectGrid subjects={data.subjects} />
          </Panel>
          <Panel title="Assessment progress">
            {data.scores.length ? (
              <>
                <dl className={styles.strength}>
                  <div>
                    <dt>Highest recent average</dt>
                    <dd>{data.strongest}</dd>
                  </div>
                  <div>
                    <dt>Area to practise</dt>
                    <dd>{data.weakest}</dd>
                  </div>
                </dl>
                <ol className={styles.scoreList}>
                  {data.scores.map((score, index) => (
                    <li key={`${score.title}-${index}`}>
                      <strong>{score.title}</strong>
                      <span>{score.detail}</span>
                      {/^[0-9]+(?:\.[0-9]+)?%$/.test(score.detail) ? (
                        <span className={styles.bar} aria-hidden="true">
                          <i
                            style={{
                              width: `${Math.max(0, Math.min(100, Number(score.detail.slice(0, -1)))).toFixed(1)}%`,
                            }}
                          />
                        </span>
                      ) : null}
                      <small>{score.meta}</small>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <PortalEmpty title="No assessment results yet">
                Teacher-entered assessment results will appear here when they
                are available to your account.
              </PortalEmpty>
            )}
            <Link
              className="button button--line button--small"
              href="/student/quizzes"
            >
              Open quizzes & homework
            </Link>
          </Panel>
          <Panel title="Attendance summary">
            <p className={styles.muted}>
              {data.attendance.total
                ? `${data.attendance.present} present · ${data.attendance.absent} absent · ${data.attendance.late} late · ${data.attendance.excused} excused`
                : "No attendance records are currently visible for your account."}
            </p>
            <Link
              className="button button--line button--small"
              href="/student/lessons"
            >
              Open lesson calendar
            </Link>
          </Panel>
          <Panel title="Learning goals">
            {data.goals.length ? (
              <ul className={styles.goalList}>
                {data.goals.map((goal, index) => (
                  <li key={`${goal}-${index}`}>{goal}</li>
                ))}
              </ul>
            ) : (
              <PortalEmpty title="No learning goals recorded">
                Goals will appear here when they have been added to your learner
                profile.
              </PortalEmpty>
            )}
          </Panel>
          <Panel
            title="My active classes"
            action={<Link href="/student/lessons">Lessons & calendar</Link>}
          >
            <RecordList
              records={data.programs}
              emptyTitle="No active classes"
              emptyMessage="Active class enrolments visible to your account will appear here."
            />
          </Panel>
          <Panel title="Upcoming lessons">
            <RecordList
              records={data.upcoming}
              emptyTitle="No upcoming lessons"
              emptyMessage="Future lessons for your active classes will appear here when scheduled."
            />
          </Panel>
          <Panel
            title="Courses & learning projects"
            action={<Link href="/student/courses">View courses</Link>}
          >
            <RecordList
              records={data.records}
              emptyTitle="No course or project access yet"
              emptyMessage="Course enrolments and active learning projects visible to your account will appear here."
            />
          </Panel>
        </div>
      </>
    );
  }

  if (role === "parent") {
    const data = await readParentDashboard(client, profile);
    return (
      <>
        {heading}
        <StatGrid stats={data.stats} />
        {data.children?.length ? (
          <div className={styles.childGrid}>
            {data.children.map(child => (
              <section
                className={`portal-panel ${styles.childCard}`}
                key={child.id}
              >
                <div className="portal-panel__heading">
                  <div>
                    <span className="section-kicker">{child.relationship}</span>
                    <h2>{child.name}</h2>
                  </div>
                  <Link
                    className="button button--line button--small"
                    href="/parent/reports"
                  >
                    Learning reports
                  </Link>
                </div>
                <h3>Learning areas</h3>
                <SubjectGrid subjects={child.subjects} />
                <div className={styles.childColumns}>
                  <div>
                    <h3>Current classes</h3>
                    {child.classes.length ? (
                      <ul>
                        {child.classes.map((title: string, index: number) => (
                          <li key={`${title}-${index}`}>{title}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.muted}>
                        No active class enrolments are recorded for this
                        learner.
                      </p>
                    )}
                  </div>
                  <div>
                    <h3>Academy courses</h3>
                    {child.courses.length ? (
                      <ul>
                        {child.courses.map((title: string, index: number) => (
                          <li key={`${title}-${index}`}>{title}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.muted}>
                        No active or completed course enrolments are recorded.
                      </p>
                    )}
                  </div>
                  <div>
                    <h3>Learning goals</h3>
                    <p className={styles.muted}>{child.goals}</p>
                  </div>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <PortalEmpty title="No confirmed learners linked">
            Only confirmed parent–learner links are shown. No learner
            information is available until a link is confirmed.
          </PortalEmpty>
        )}
        <div className={styles.dashboardGrid}>
          <Panel
            title="Learning reports"
            action={<Link href="/parent/reports">View reports</Link>}
          >
            <RecordList
              records={data.records}
              emptyTitle="No reports available yet"
              emptyMessage="Reports for confirmed linked learners will appear here when generated."
            />
            {data.records.some(record =>
              record.meta?.includes("secure download is not available")
            ) ? (
              <p className={styles.muted}>
                A report record exists, but secure report download is not
                configured here.
              </p>
            ) : null}
          </Panel>
          <Panel
            title="Teacher contacts"
            action={<Link href="/parent/teachers">View contacts</Link>}
          >
            <RecordList
              records={data.teachers ?? []}
              emptyTitle="No active class contacts"
              emptyMessage="Teacher contacts for active classes of confirmed linked learners will appear here when available."
            />
          </Panel>
          <Panel
            title="Community controls"
            action={<Link href="/parent/community">Review controls</Link>}
          >
            <p className={styles.muted}>
              Community participation remains subject to recorded guardian
              consent and each learner’s settings.
            </p>
          </Panel>
        </div>
      </>
    );
  }

  if (role === "teacher") {
    const data = await readTeacherDashboard(client, profile);
    return (
      <>
        {heading}
        <StatGrid stats={data.stats} />
        <div className={styles.dashboardGrid}>
          <Panel
            title="My classes"
            action={<Link href="/teacher/classes">View class records</Link>}
          >
            <RecordList
              records={data.programs}
              emptyTitle="No classes listed"
              emptyMessage="Classes owned by your teacher account will appear here."
            />
          </Panel>
          <Panel title="Upcoming lessons">
            <RecordList
              records={data.upcoming}
              emptyTitle="No upcoming lessons"
              emptyMessage="Scheduled future lessons from your classes will appear here."
            />
          </Panel>
          <Panel
            title="Learner progress"
            action={<Link href="/teacher/students">Open student records</Link>}
          >
            <RecordList
              records={data.teacherStudents ?? []}
              emptyTitle="No enrolled learners yet"
              emptyMessage="Learners enrolled in your classes will appear here with recorded learning activity."
            />
          </Panel>
          <Panel title="Attendance & learning activity">
            <p className={styles.muted}>
              {data.attendance.total
                ? `${data.attendance.present} present · ${data.attendance.absent} absent · ${data.attendance.late} late · ${data.attendance.excused} excused across your classes.`
                : "No attendance records are currently visible for your classes."}
            </p>
            <p className={styles.muted}>
              Assessment and homework counts above reflect records from classes
              owned by your teacher account.
            </p>
            <Link
              className="button button--line button--small"
              href="/teacher/students"
            >
              Review class progress
            </Link>
          </Panel>
        </div>
        <Panel title="Teaching learning areas">
          <SubjectGrid subjects={data.subjects} />
        </Panel>
      </>
    );
  }

  const data = await readGuestDashboard(client, profile);
  return (
    <>
      {heading}
      <StatGrid stats={data.stats} />
      <div className={styles.dashboardGrid}>
        <Panel
          title="My courses"
          action={<Link href="/guest/courses">View courses</Link>}
        >
          <RecordList
            records={data.programs}
            emptyTitle="No course enrolments"
            emptyMessage="Active or completed courses visible to your account will appear here."
          />
        </Panel>
        <Panel title="Certificates & learning projects">
          <RecordList
            records={data.records}
            emptyTitle="No certificates or projects yet"
            emptyMessage="Certificates and active learning projects attached to your account will appear here."
          />
        </Panel>
        <Panel title="Explore more learning">
          <p className={styles.muted}>
            Browse available Academy courses and learning options.
          </p>
          <div className="portal-actions">
            <Link className="button button--line" href="/academy">
              Explore Academy
            </Link>
            <Link className="button button--line" href="/guest/profile">
              View profile
            </Link>
          </div>
        </Panel>
      </div>
    </>
  );
}
