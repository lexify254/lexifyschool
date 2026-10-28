import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { APP_ROLES, roleHome, type AppRole } from "@/lib/auth/roles";
import { isAccountSuspended } from "@/lib/auth/suspension";

export { APP_ROLES, roleHome } from "@/lib/auth/roles";
export type { AppRole } from "@/lib/auth/roles";

export type CurrentProfile = {
  id: string;
  role: AppRole;
  full_name: string;
  avatar_url: string | null;
  is_suspended: boolean;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,role,full_name,avatar_url,is_suspended")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (error || !data || !APP_ROLES.includes(data.role as AppRole)) return null;
  return data as CurrentProfile;
}

export async function requireRole(
  role: Exclude<AppRole, "admin">,
  loginNext = roleHome[role]
): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(loginNext)}`);
  if (profile.role !== role) redirect(roleHome[profile.role]);
  if (isAccountSuspended(profile)) redirect("/account-suspended");
  return profile;
}

export async function requireAdmin(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();
  if (isAccountSuspended(profile)) redirect("/account-suspended");
  return profile;
}
