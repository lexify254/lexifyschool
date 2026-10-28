import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isAccountSuspended } from "@/lib/auth/suspension";
import {
  createPrivateObjectPath,
  getMalwareScannerConfig,
  getMaxUploadBytes,
  isExplicitlyPrivateBucket,
  scanWithConfiguredScanner,
  UPLOAD_BUCKET_ROLES,
  validateUploadFile,
} from "@/lib/security/file-upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MULTIPART_OVERHEAD_BYTES = 32 * 1024;

function json(data: Record<string, unknown>, status: number): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return json({ error: "Upload service is unavailable." }, 503);

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user)
    return json({ error: "Authentication is required." }, 401);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,is_suspended")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError)
    return json({ error: "Upload authorization is unavailable." }, 503);
  if (!profile || profile.id !== auth.user.id)
    return json({ error: "Upload is not permitted." }, 403);
  if (isAccountSuspended(profile))
    return json({ error: "Account access is suspended." }, 403);

  const maxBytes = getMaxUploadBytes(process.env.MAX_UPLOAD_MB);
  const scanner = getMalwareScannerConfig();
  if (maxBytes === null || scanner === null) {
    return json({ error: "Secure uploads are not configured." }, 503);
  }

  const rawLength = request.headers.get("content-length");
  if (!rawLength || !/^\d+$/.test(rawLength))
    return json({ error: "A bounded request size is required." }, 411);
  const contentLength = Number(rawLength);
  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > maxBytes + MULTIPART_OVERHEAD_BYTES
  ) {
    return json({ error: "Upload exceeds the configured size limit." }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Upload must be valid multipart form data." }, 400);
  }
  const entries = Array.from(form.entries());
  if (
    entries.length !== 2 ||
    entries.some(([key]) => key !== "file" && key !== "bucket")
  ) {
    return json(
      { error: "Upload must include exactly one file and one bucket." },
      400
    );
  }
  const bucketValue = form.get("bucket");
  const fileValue = form.get("file");
  if (
    typeof bucketValue !== "string" ||
    !Object.hasOwn(UPLOAD_BUCKET_ROLES, bucketValue) ||
    !(fileValue instanceof File)
  ) {
    return json({ error: "Unsupported upload." }, 400);
  }
  const bucket = bucketValue as keyof typeof UPLOAD_BUCKET_ROLES;
  if (profile.role !== UPLOAD_BUCKET_ROLES[bucket])
    return json({ error: "Upload is not permitted for this role." }, 403);
  if (
    fileValue.size <= 0 ||
    fileValue.size > maxBytes ||
    fileValue.size > contentLength
  ) {
    return json({ error: "Upload exceeds the configured size limit." }, 413);
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await fileValue.arrayBuffer());
  } catch {
    return json({ error: "Unable to read uploaded file." }, 400);
  }
  const extension = validateUploadFile(
    fileValue.name,
    fileValue.type,
    bytes,
    fileValue.size,
    maxBytes
  );
  if (!extension)
    return json({ error: "File type or contents are not allowed." }, 415);

  const { data: storageBucket, error: bucketError } =
    await supabase.storage.getBucket(bucket);
  if (bucketError || !isExplicitlyPrivateBucket(storageBucket)) {
    return json({ error: "Private upload storage is unavailable." }, 503);
  }

  const scanResult = await scanWithConfiguredScanner(
    bytes,
    fileValue.type,
    scanner
  );
  if (scanResult === "infected")
    return json({ error: "File did not pass security scanning." }, 422);
  if (scanResult !== "clean")
    return json({ error: "Security scanning is unavailable." }, 503);

  const path = createPrivateObjectPath(auth.user.id, bucket, extension);
  if (!path)
    return json(
      { error: "A safe private storage path could not be created." },
      503
    );

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, fileValue, {
      contentType: fileValue.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError)
    return json({ error: "File could not be stored securely." }, 503);

  return json(
    { bucket, path, mimeType: fileValue.type, size: fileValue.size },
    201
  );
}
