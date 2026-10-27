import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PortalRole } from "./portal-ui";
import { PortalFrame, PortalUnavailable } from "./portal-ui";
import { PortalDashboard } from "./portal-dashboard";
import { PortalSection } from "./portal-section";

export async function PortalDashboardEntry({ role }: { role: PortalRole }) {
  const client = await getSupabaseServerClient();
  if (!client) return <PortalUnavailable />;
  const profile = await requireRole(role);
  return <PortalFrame role={role} profile={profile} activeHref={`/${role}/dashboard`}><PortalDashboard role={role} profile={profile} client={client} /></PortalFrame>;
}

export async function PortalSectionEntry({ role, section }: { role: PortalRole; section: string }) {
  const client = await getSupabaseServerClient();
  if (!client) return <PortalUnavailable />;
  const profile = await requireRole(role);
  return <PortalFrame role={role} profile={profile} activeHref={`/${role}/${section}`}><PortalSection role={role} section={section} profile={profile} client={client} /></PortalFrame>;
}
