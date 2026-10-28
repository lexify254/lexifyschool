import { PortalSectionEntry } from "@/components/portal/portal-entry";
import { LearningSectionEntry } from "@/components/learning/learning-entry";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};
export default async function GuestSectionPage({
  params,
  searchParams,
}: Props) {
  const [{ section }, query] = await Promise.all([params, searchParams]);
  if (["payment", "payments"].includes(section))
    return (
      <LearningSectionEntry
        role="guest"
        section={section}
        classId={typeof query.classId === "string" ? query.classId : undefined}
      />
    );
  return <PortalSectionEntry role="guest" section={section} />;
}
