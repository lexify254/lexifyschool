import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  readLearningSection,
  supportsLearningSection,
  type LearningRole,
} from "@/lib/data/learning";
import { PortalFrame, PortalUnavailable } from "@/components/portal/portal-ui";
import { LearningSection } from "./learning-section";

export async function LearningSectionEntry({
  role,
  section,
  classId,
}: {
  role: LearningRole;
  section: string;
  classId?: string;
}) {
  if (!supportsLearningSection(role, section)) return null;
  const client = await getSupabaseServerClient();
  if (!client) return <PortalUnavailable />;
  const profile = await requireRole(role);
  let data;
  try {
    data = await readLearningSection(client, profile, role, section, classId);
  } catch (error) {
    return (
      <main className="portal-shell">
        <div className="container">
          <section className="empty-state" role="alert">
            <h1>Learning records could not be loaded</h1>
            <p>
              {error instanceof Error
                ? error.message
                : "The learning data service returned an unexpected error."}
            </p>
          </section>
        </div>
      </main>
    );
  }
  return (
    <PortalFrame
      role={role}
      profile={profile}
      activeHref={`/${role}/${section}`}
    >
      <LearningSection role={role} section={section} data={data} />
    </PortalFrame>
  );
}
