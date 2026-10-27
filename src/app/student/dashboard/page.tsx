import { PortalDashboardEntry } from "@/components/portal/portal-entry";
export const dynamic = "force-dynamic";
export default async function StudentDashboardPage() {
  return <PortalDashboardEntry role="student" />;
}
