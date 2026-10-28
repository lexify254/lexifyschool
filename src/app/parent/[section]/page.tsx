import { PortalSectionEntry } from "@/components/portal/portal-entry";
import { LearningSectionEntry } from "@/components/learning/learning-entry";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};
const learningSections = new Set([
  "reports",
  "children",
  "payment",
  "payments",
]);
export default async function ParentSectionPage({
  params,
  searchParams,
}: Props) {
  const [{ section }, query] = await Promise.all([params, searchParams]);
  if (learningSections.has(section))
    return (
      <LearningSectionEntry
        role="parent"
        section={section}
        classId={typeof query.classId === "string" ? query.classId : undefined}
      />
    );
  return <PortalSectionEntry role="parent" section={section} />;
}
