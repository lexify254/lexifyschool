import { NextResponse } from "next/server";
import { isAccountSuspended } from "@/lib/auth/suspension";
import { getMaxUploadBytes, isSafePrivateObjectPath, validateUploadHeader } from "@/lib/security/file-upload";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_JSON_BYTES = 16 * 1024;

function json(data: Record<string, unknown>, status: number): Response {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_JSON_BYTES)) {
    return json({ error: "Upload details are too large." }, 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Upload details must be valid JSON." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Upload details are required." }, 400);
  }
  const input = body as Record<string, unknown>;
  if (Object.keys(input).sort().join(",") !== "lessonId,path,title") {
    return json({ error: "Upload details are missing or unsupported." }, 400);
  }
  if (
    typeof input.lessonId !== "string" ||
    !UUID.test(input.lessonId) ||
    typeof input.path !== "string" ||
    typeof input.title !== "string" ||
    !input.title.trim() ||
    input.title.trim().length > 160
  ) {
    return json({ error: "Choose a lesson and provide a file title (up to 160 characters)." }, 400);
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return json({ error: "Upload service is unavailable." }, 503);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return json({ error: "Authentication is required." }, 401);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,is_suspended")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError) return json({ error: "Upload authorization is unavailable." }, 503);
  if (!profile || profile.id !== auth.user.id || profile.role !== "admin") {
    return json({ error: "Only an administrator can attach course files." }, 403);
  }
  if (isAccountSuspended(profile)) return json({ error: "Account access is suspended." }, 403);
  if (!isSafePrivateObjectPath(input.path, auth.user.id)) {
    return json({ error: "The uploaded file reference is not valid." }, 400);
  }

  const maxBytes = getMaxUploadBytes(process.env.MAX_UPLOAD_MB);
  if (maxBytes === null) return json({ error: "Upload size configuration is invalid." }, 503);

  const { data: lesson, error: lessonError } = await supabase
    .from("course_lessons")
    .select("id")
    .eq("id", input.lessonId)
    .maybeSingle();
  if (lessonError) return json({ error: "Lesson authorization is unavailable." }, 503);
  if (!lesson) return json({ error: "The selected lesson was not found." }, 404);

  const pathParts = input.path.split("/");
  const objectName = pathParts[1];
  const { data: objects, error: listError } = await supabase.storage
    .from("course-content")
    .list(auth.user.id, { search: objectName, limit: 10 });
  if (listError) return json({ error: "Uploaded file details could not be checked." }, 503);
  const storedObject = objects?.find(object => object.name === objectName);
  const metadata = storedObject?.metadata as Record<string, unknown> | null | undefined;
  const size = Number(metadata?.size);
  const mimeType = typeof metadata?.mimetype === "string"
    ? metadata.mimetype
    : typeof metadata?.contentType === "string"
      ? metadata.contentType
      : "";
  if (!storedObject || !Number.isSafeInteger(size) || size <= 0 || size > maxBytes || !mimeType) {
    return json({ error: "Uploaded file is missing, too large, or has invalid metadata." }, 415);
  }

  const { data: signed, error: signingError } = await supabase.storage
    .from("course-content")
    .createSignedUrl(input.path, 60);
  if (signingError || !signed?.signedUrl) {
    return json({ error: "The uploaded file could not be verified." }, 503);
  }

  let headerResponse: Response;
  try {
    headerResponse = await fetch(signed.signedUrl, {
      headers: { range: "bytes=0-31" },
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    return json({ error: "The uploaded file could not be verified." }, 503);
  }
  const expectedEnd = Math.min(31, size - 1);
  const expectedRange = `bytes 0-${expectedEnd}/${size}`;
  const returnedRange = headerResponse.headers.get("content-range");
  const returnedLength = Number(headerResponse.headers.get("content-length"));
  if (
    headerResponse.status !== 206 ||
    returnedRange !== expectedRange ||
    returnedLength !== expectedEnd + 1
  ) {
    await headerResponse.body?.cancel();
    return json({ error: "The storage service could not verify this file's signature." }, 503);
  }
  const header = new Uint8Array(await headerResponse.arrayBuffer());
  if (header.byteLength !== expectedEnd + 1) {
    return json({ error: "The storage service returned an invalid file signature." }, 503);
  }
  const fileExtension = validateUploadHeader(objectName, mimeType, header, size, maxBytes);
  if (!fileExtension || !objectName.toLowerCase().endsWith(`.${fileExtension}`)) {
    return json({ error: "File type or contents are not allowed." }, 415);
  }

  const { data: resource, error: resourceError } = await supabase
    .from("lesson_resources")
    .insert({
      lesson_id: input.lessonId,
      title: input.title.trim(),
      file_path: input.path,
      mime_type: mimeType,
      is_downloadable: true,
    })
    .select("id,title")
    .single();
  if (resourceError || !resource) {
    const { error: cleanupError } = await supabase.storage
      .from("course-content")
      .remove([input.path]);
    if (cleanupError) console.error("[Lexify] Course upload cleanup failed after attachment error.");
    return json({ error: "The file could not be attached to the lesson. Try again." }, 503);
  }

  return json({ resource, size, mimeType }, 201);
}
