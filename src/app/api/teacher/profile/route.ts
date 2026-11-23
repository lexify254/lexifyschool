import { NextResponse } from "next/server";
import { isAccountSuspended } from "@/lib/auth/suspension";
import { parseTeacherProfileUpdate } from "@/lib/data/teacher-profile";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const fail = (error: string, status = 400) =>
  NextResponse.json(
    { error },
    { status, headers: { "cache-control": "no-store" } }
  );

export async function PATCH(request: Request): Promise<Response> {
  const client = await getSupabaseServerClient();
  if (!client) return fail("Profile service is unavailable.", 503);
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user)
    return fail("Sign in to edit your teacher profile.", 401);
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id,role,is_suspended")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError) return fail("Profile authorization is unavailable.", 503);
  if (!profile || profile.id !== auth.user.id || profile.role !== "teacher")
    return fail("An authenticated teacher account is required.", 403);
  if (isAccountSuspended(profile))
    return fail("Account access is suspended.", 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Profile details must be valid JSON.");
  }
  const parsed = parseTeacherProfileUpdate(body);
  if (parsed.error) return fail(parsed.error);
  const { data, error } = await client
    .from("teacher_details")
    .update({ ...parsed.value, updated_at: new Date().toISOString() })
    .eq("profile_id", auth.user.id)
    .select("profile_id")
    .maybeSingle();
  if (error) {
    console.error(
      `[Lexify] Teacher profile update failed (${error.code ?? "query"}).`
    );
    return fail("Teacher profile could not be saved.", 403);
  }
  if (!data) return fail("Your teacher profile is not available to edit.", 404);
  return NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } }
  );
}
