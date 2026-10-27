import { PortalDashboardEntry } from "@/components/portal/portal-entry";
export const dynamic = "force-dynamic";
export default async function ParentDashboardPage() {
  return <PortalDashboardEntry role="parent" />;
}
