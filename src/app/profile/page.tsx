import { redirect } from "next/navigation";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { getCurrentProfile } from "@/lib/auth/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string | string[] }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fprofile");
  if (profile.is_suspended) redirect("/account-suspended");

  const client = await getSupabaseServerClient();
  let avatarUrl: string | null = null;
  let studentCode: string | null = null;
  if (client && profile.avatar_url?.startsWith(`${profile.id}/`)) {
    const { data } = await client.storage
      .from("profile-photos")
      .createSignedUrl(profile.avatar_url, 3600);
    avatarUrl = data?.signedUrl ?? null;
  }
  if (client && profile.role === "student") {
    const { data } = await client
      .from("student_details")
      .select("student_code")
      .eq("profile_id", profile.id)
      .maybeSingle();
    studentCode = typeof data?.student_code === "string" ? data.student_code : null;
  }

  const params = await searchParams;
  const linkState = Array.isArray(params.link) ? params.link[0] ?? "" : params.link ?? "";
  return (
    <main className="page-content">
      <div className="container" style={{ maxWidth: 820 }}>
        <header className="page-heading">
          <span className="section-kicker">Account settings</span>
          <h1>Your profile</h1>
          <p>Update the name and private photo shown in your account navigation.</p>
        </header>
        <ProfileEditor
          profile={{ id: profile.id, full_name: profile.full_name, role: profile.role }}
          avatarUrl={avatarUrl}
          studentCode={studentCode}
          linkState={linkState}
        />
      </div>
    </main>
  );
}
