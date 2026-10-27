import { SignupForm } from "@/components/auth/AuthForms";
export default async function SignupRolePage({ params }: { params: Promise<{ role: string }> }) { const { role } = await params; return <SignupForm role={role} />; }
