import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { APP_ROLES, roleHome, type AppRole } from "@/lib/auth/roles";
import { safeRoleDestination, safeSameOriginPath } from "@/lib/auth/redirects";

function redirect(request: NextRequest, path: string) {
  const safePath = safeSameOriginPath(path, request.nextUrl.origin, "/login?error=auth_callback");
  return new Response(null, { status: 303, headers: { Location: safePath } });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const supabase = await getSupabaseServerClient();
  if (!supabase) return redirect(request, "/login?error=auth_unavailable");
  if (!code) return redirect(request, "/login?error=auth_callback");

  const { data: authData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError || !authData.user) return redirect(request, "/login?error=auth_callback");

  const next = request.nextUrl.searchParams.get("next");
  if (next === "/password/update") return redirect(request, "/password/update");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", authData.user.id)
    .maybeSingle();
  const roleValue = profile?.role;
  if (profileError || !profile || typeof roleValue !== "string" || !APP_ROLES.includes(roleValue as AppRole)) {
    await supabase.auth.signOut();
    return redirect(request, "/login?error=role_unverified");
  }
  const role = roleValue as AppRole;
  const meta = authData.user.user_metadata ?? {};
  let queueApplied = false;

  if (role === "student" && Array.isArray(meta.pending_subject_selection) && meta.pending_subject_selection.length) {
    const gradeId = typeof meta.grade_id === "string" ? meta.grade_id : "";
    const subjectIds = meta.pending_subject_selection.filter((id: unknown): id is string => typeof id === "string");
    const pathwayId = typeof meta.pathway_id === "string" ? meta.pathway_id : null;
    const trackId = typeof meta.track_id === "string" ? meta.track_id : null;
    if (!gradeId || !subjectIds.length) return redirect(request, "/signup?error=curriculum_pending");
    const { error: saveError } = await supabase.rpc("save_student_subjects", {
      grade_id: gradeId,
      selected_area_ids: subjectIds,
      pathway_id: pathwayId,
      track_id: trackId,
    });
    if (saveError) return redirect(request, "/signup?error=curriculum_pending");
    const details: Record<string, unknown> = {};
    for (const field of ["school", "county", "goals"] as const) {
      if (typeof meta[field] === "string") details[field] = meta[field];
    }
    if (Array.isArray(meta.hobbies)) {
      details.hobbies = meta.hobbies.filter((item: unknown): item is string => typeof item === "string").map((item: string) => item.trim()).filter(Boolean);
    }
    if (Object.keys(details).length) {
      const { error: detailsError } = await supabase.from("student_details").update(details).eq("profile_id", authData.user.id);
      if (detailsError) return redirect(request, "/signup?error=curriculum_pending");
    }
    queueApplied = true;
  } else if (role === "teacher" && Array.isArray(meta.pending_subject_selection) && meta.pending_subject_selection.length) {
    const queued = meta.pending_subject_selection.filter(
      (item: unknown): item is { grade_id: string; learning_area_id: string; experience_years?: number | null; qualifications?: string[] } =>
        Boolean(item && typeof item === "object" && typeof (item as { grade_id?: unknown }).grade_id === "string" && typeof (item as { learning_area_id?: unknown }).learning_area_id === "string"),
    );
    const rows = queued.map((item) => ({ teacher_id: authData.user!.id, grade_id: item.grade_id, learning_area_id: item.learning_area_id }));
    if (rows.length) {
      const { error: teacherError } = await supabase.from("teacher_subjects").upsert(rows, { onConflict: "teacher_id,grade_id,learning_area_id" });
      if (teacherError) return redirect(request, "/signup?error=teacher_subjects_pending");
    }
    const first = queued[0];
    const updates: Record<string, unknown> = {};
    if (typeof first?.experience_years === "number") updates.experience_years = first.experience_years;
    if (Array.isArray(first?.qualifications)) updates.qualifications = first.qualifications;
    if (typeof meta.whatsapp === "string" && meta.whatsapp) updates.public_whatsapp = meta.whatsapp;
    if (Object.keys(updates).length) {
      const { error: detailError } = await supabase.from("teacher_details").update(updates).eq("profile_id", authData.user.id);
      if (detailError) return redirect(request, "/signup?error=teacher_subjects_pending");
    }
    queueApplied = true;
  }

  if (queueApplied) {
    const { error: clearError } = await supabase.auth.updateUser({ data: { pending_subject_selection: null } });
    if (clearError) return redirect(request, "/signup?error=curriculum_pending");
  }

  const parentStudentId = request.nextUrl.searchParams.get("parent_student_id");
  if (role === "parent" && parentStudentId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parentStudentId)) {
    const { error: linkError } = await supabase.from("parent_student_links").insert({
      parent_id: authData.user.id,
      student_id: parentStudentId,
      relationship: "parent/guardian",
    });
    if (linkError) return redirect(request, "/signup?error=parent_link_pending");
  }

  const destination = next
    ? safeRoleDestination(next, request.nextUrl.origin, role)
    : roleHome[role];
  return redirect(request, destination);
}
