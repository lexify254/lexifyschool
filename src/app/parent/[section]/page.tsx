import { PortalSectionEntry } from "@/components/portal/portal-entry";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ section: string }> };
export default async function ParentSectionPage({ params }: Props) {
  const { section } = await params;
  return <PortalSectionEntry role="parent" section={section} />;
}
