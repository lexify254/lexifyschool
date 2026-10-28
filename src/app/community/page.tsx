import { redirect } from "next/navigation";
import CommunityClient from "@/components/community/CommunityClient";
import { PortalFrame } from "@/components/portal/portal-ui";
import { requireRole } from "@/lib/auth/guards";
import { loadCommunityState } from "@/lib/community/service";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const profile = await requireRole("student", "/community");
  const state = await loadCommunityState();
  if (state.status === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent("/community")}`);
  }

  return (
    <PortalFrame role="student" profile={profile} activeHref="/community">
      <section
        className="container"
        style={{ paddingTop: 42, paddingBottom: 72 }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <span className="section-kicker">Student community</span>
          <h1 style={{ margin: "8px 0 12px" }}>Learn together, safely</h1>
          <p style={{ maxWidth: 760, color: "var(--muted)", marginTop: 0 }}>
            Join an interest channel to exchange learning ideas with other
            students. Community access is available only when your learner
            setting, a confirmed parent or guardian’s access control, and active
            guardian consent are all verified.
          </p>

          <section
            aria-labelledby="community-rules-title"
            className="content-card"
            style={{ marginBottom: 22 }}
          >
            <h2 id="community-rules-title" style={{ marginTop: 0 }}>
              Community rules
            </h2>
            <ul style={{ marginBottom: 0, paddingLeft: 22 }}>
              <li>Be kind, respectful and focused on learning.</li>
              <li>
                Do not share passwords, phone numbers, addresses or other
                private information.
              </li>
              <li>
                Do not arrange private contact with people you do not know.
                There are no stranger direct messages here.
              </li>
              <li>
                Use the report control on a message that feels unsafe or
                inappropriate.
              </li>
            </ul>
          </section>

          {state.status === "ready" ? (
            <CommunityClient initialState={state} />
          ) : state.status === "blocked" ? (
            <section className="content-card" role="status" aria-live="polite">
              <h2 style={{ marginTop: 0 }}>
                Community access is not available
              </h2>
              <p style={{ marginBottom: 0 }}>
                {state.message} Ask your parent or guardian to review the
                community setting and consent if you think this is unexpected.
              </p>
            </section>
          ) : (
            <section
              className="content-card"
              role="alert"
              aria-live="assertive"
            >
              <h2 style={{ marginTop: 0 }}>Community could not be loaded</h2>
              <p style={{ marginBottom: 0 }}>
                {state.message} No channels or messages are being shown until
                access can be checked.
              </p>
            </section>
          )}
        </div>
      </section>
    </PortalFrame>
  );
}
