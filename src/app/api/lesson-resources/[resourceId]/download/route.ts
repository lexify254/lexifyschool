import { NextResponse } from "next/server";
import { isAccountSuspended } from "@/lib/auth/suspension";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSafePrivateObjectPath } from "@/lib/security/file-upload";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  const { resourceId } = await params;
  if (!UUID.test(resourceId)) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Download service is unavailable." }, { status: 503 });
  }
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Sign in to download this lesson file." }, { status: 401 });
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,is_suspended")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError || !profile) {
    return NextResponse.json({ error: "Download access could not be checked." }, { status: 503 });
  }
  if (isAccountSuspended(profile)) {
    return NextResponse.json({ error: "Account access is suspended." }, { status: 403 });
  }
  const { data: resource, error } = await supabase
    .from("lesson_resources")
    .select("id,title,file_path")
    .eq("id", resourceId)
    .eq("is_downloadable", true)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Download access could not be checked." }, { status: 503 });
  }
  if (!resource || typeof resource.file_path !== "string") {
    return NextResponse.json({ error: "File not found or not available to your account." }, { status: 404 });
  }
  const ownerId = resource.file_path.split("/")[0];
  if (!isSafePrivateObjectPath(resource.file_path, ownerId)) {
    return NextResponse.json({ error: "File reference is invalid." }, { status: 404 });
  }
  const { data: signed, error: signingError } = await supabase.storage
    .from("course-content")
    .createSignedUrl(resource.file_path, 300, { download: resource.title });
  if (signingError || !signed?.signedUrl) {
    return NextResponse.json({ error: "A secure download link could not be created." }, { status: 503 });
  }
  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { "cache-control": "no-store, private", "referrer-policy": "no-referrer" },
  });
}
