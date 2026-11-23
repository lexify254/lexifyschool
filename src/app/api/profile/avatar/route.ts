import { randomUUID } from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isAccountSuspended } from "@/lib/auth/suspension";
import { isExplicitlyPrivateBucket, validateUploadFile } from "@/lib/security/file-upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(data: Record<string, unknown>, status: number): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return json({ error: "Profile photo service is unavailable." }, 503);

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return json({ error: "Sign in to upload a profile photo." }, 401);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,is_suspended,avatar_url")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError) return json({ error: "Profile-photo authorization is unavailable." }, 503);
  if (!profile || profile.id !== auth.user.id) return json({ error: "This upload is not permitted." }, 403);
  if (isAccountSuspended(profile)) return json({ error: "Account access is suspended." }, 403);

  const rawLength = request.headers.get("content-length");
  if (!rawLength || !/^\d+$/.test(rawLength)) return json({ error: "A bounded photo upload is required." }, 411);
  const contentLength = Number(rawLength);
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > MAX_AVATAR_BYTES + 32 * 1024) {
    return json({ error: "Profile photos must be 4 MB or smaller." }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Upload must be valid multipart form data." }, 400);
  }
  const entries = Array.from(form.entries());
  const file = form.get("file");
  if (entries.length !== 1 || entries[0]?.[0] !== "file" || !(file instanceof File)) {
    return json({ error: "Upload one profile photo file." }, 400);
  }
  if (!MIME_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_AVATAR_BYTES || file.size > contentLength) {
    return json({ error: "Choose a JPEG, PNG or WebP image no larger than 4 MB." }, 415);
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return json({ error: "The uploaded image could not be read." }, 400);
  }
  const extension = validateUploadFile(file.name, file.type, bytes, file.size, MAX_AVATAR_BYTES);
  if (!extension || !["jpg", "jpeg", "png", "webp"].includes(extension)) {
    return json({ error: "The file contents do not match a supported image type." }, 415);
  }

  const { data: bucket, error: bucketError } = await supabase.storage.getBucket("profile-photos");
  if (bucketError || !isExplicitlyPrivateBucket(bucket)) {
    return json({ error: "Private profile-photo storage is not configured." }, 503);
  }

  const path = `${auth.user.id}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("profile-photos")
    .upload(path, bytes, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (uploadError) return json({ error: "The photo could not be stored securely." }, 503);

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: path })
    .eq("id", auth.user.id)
    .select("id")
    .maybeSingle();
  if (updateError || !updated) {
    await supabase.storage.from("profile-photos").remove([path]);
    return json({ error: "The photo was uploaded but the profile could not be updated." }, 503);
  }

  const oldPath = typeof profile.avatar_url === "string" ? profile.avatar_url : "";
  if (oldPath.startsWith(`${auth.user.id}/`) && oldPath !== path) {
    await supabase.storage.from("profile-photos").remove([oldPath]);
  }
  return json({ avatarPath: path }, 201);
}
