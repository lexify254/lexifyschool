import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const APP_ROLES = ["student", "parent", "teacher", "guest", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export type CurrentProfile = {
  id: string;
  role: AppRole;
  full_name: string;
  avatar_url: string | null;
};

export const roleHome: Record<AppRole, string> = {
  student: "/student/dashboard",
  parent: "/parent/dashboard",
  teacher: "/teacher/dashboard",
  guest: "/guest/dashboard",
  admin: "/admin",
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,role,full_name,avatar_url")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (error || !data || !APP_ROLES.includes(data.role as AppRole)) return null;
  return data as CurrentProfile;
}

export async function requireRole(role: Exclude<AppRole, "admin">): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== role) redirect(roleHome[profile.role]);
  return profile;
}

export async function requireAdmin(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();
  return profile;
}
