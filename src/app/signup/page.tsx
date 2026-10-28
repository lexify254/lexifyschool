import { RoleChooser } from "@/components/auth/AuthForms";
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <RoleChooser issue={params.error} />;
}
