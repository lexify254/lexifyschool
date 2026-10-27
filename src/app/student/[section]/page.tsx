import { PortalSectionEntry } from "@/components/portal/portal-entry";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ section: string }> };
export default async function StudentSectionPage({ params }: Props) {
  const { section } = await params;
  return <PortalSectionEntry role="student" section={section} />;
}
