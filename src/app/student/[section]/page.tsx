import { redirect } from "next/navigation";
import { PortalSectionEntry } from "@/components/portal/portal-entry";
import { LearningSectionEntry } from "@/components/learning/learning-entry";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};
const learningSections = new Set([
  "lessons",
  "calendar",
  "homework",
  "quizzes",
  "questions",
  "resources",
  "payment",
  "payments",
]);
export default async function StudentSectionPage({
  params,
  searchParams,
}: Props) {
  const [{ section }, query] = await Promise.all([params, searchParams]);
  if (section === "community") redirect("/community");
  if (learningSections.has(section))
    return (
      <LearningSectionEntry
        role="student"
        section={section}
        classId={typeof query.classId === "string" ? query.classId : undefined}
      />
    );
  return <PortalSectionEntry role="student" section={section} />;
}
