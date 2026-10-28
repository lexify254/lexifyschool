export const MAX_CONFIGURED_UPLOAD_MB = 50;
const BYTES_PER_MB = 1024 * 1024;
const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const UPLOAD_BUCKET_ROLES = {
  materials: "teacher",
  homework: "student",
} as const;

const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

export type MalwareScannerConfig = {
  url: string;
  apiKey: string;
};

export function getMaxUploadBytes(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const megabytes = Number(value);
  if (
    !Number.isSafeInteger(megabytes) ||
    megabytes < 1 ||
    megabytes > MAX_CONFIGURED_UPLOAD_MB
  )
    return null;
  return megabytes * BYTES_PER_MB;
}

export function getMalwareScannerConfig(
  env: Readonly<Record<string, string | undefined>> = process.env
): MalwareScannerConfig | null {
  if (
    env.MALWARE_SCAN_PROVIDER !== "http" ||
    !env.MALWARE_SCAN_API_URL ||
    !env.MALWARE_SCAN_API_KEY
  )
    return null;
  try {
    const url = new URL(env.MALWARE_SCAN_API_URL);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    return { url: url.toString(), apiKey: env.MALWARE_SCAN_API_KEY };
  } catch {
    return null;
  }
}

export function isExplicitlyPrivateBucket(bucket: unknown): boolean {
  return (
    typeof bucket === "object" &&
    bucket !== null &&
    "public" in bucket &&
    (bucket as { public?: unknown }).public === false
  );
}

export function validateUploadFile(
  filename: string,
  declaredType: string,
  bytes: Uint8Array,
  size: number,
  maxBytes: number
): string | null {
  if (
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > maxBytes ||
    bytes.byteLength !== size
  )
    return null;
  if (
    !/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,127}$/.test(filename) ||
    filename.includes("..")
  )
    return null;

  const extensions = MIME_EXTENSIONS[declaredType];
  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extensions || !extension || !extensions.includes(extension)) return null;

  const headerMatches =
    (declaredType === "application/pdf" && ascii(bytes, 0, 5) === "%PDF-") ||
    (declaredType === "image/jpeg" &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (declaredType === "image/png" &&
      matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (declaredType === "image/webp" &&
      ascii(bytes, 0, 4) === "RIFF" &&
      ascii(bytes, 8, 4) === "WEBP");
  return headerMatches ? extension : null;
}

export function createPrivateObjectPath(
  userId: string,
  bucket: string,
  extension: string,
  objectId = crypto.randomUUID()
): string | null {
  if (
    !USER_ID_PATTERN.test(userId) ||
    !Object.hasOwn(UPLOAD_BUCKET_ROLES, bucket) ||
    !OBJECT_ID_PATTERN.test(objectId)
  )
    return null;
  if (
    !Object.values(MIME_EXTENSIONS).some(extensions =>
      extensions.includes(extension)
    )
  )
    return null;
  const path = `${userId}/${objectId}.${extension}`;
  return isSafePrivateObjectPath(path, userId) ? path : null;
}

export function isSafePrivateObjectPath(path: string, userId: string): boolean {
  if (
    !USER_ID_PATTERN.test(userId) ||
    path.includes("..") ||
    path.startsWith("/") ||
    path.includes("\\")
  )
    return false;
  const objectName = path.slice(userId.length + 1);
  return (
    path.startsWith(userId + "/") &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png|webp)$/i.test(
      objectName
    )
  );
}

export async function scanWithConfiguredScanner(
  bytes: Uint8Array,
  mimeType: string,
  scanner: MalwareScannerConfig
): Promise<"clean" | "infected" | "unavailable"> {
  try {
    const payload = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(payload).set(bytes);
    const response = await fetch(scanner.url, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-api-key": scanner.apiKey,
        "cache-control": "no-store",
        "x-file-content-type": mimeType,
      },
      body: new Blob([payload], { type: "application/octet-stream" }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) return "unavailable";
    const result: unknown = await response.json();
    if (typeof result !== "object" || result === null || !("status" in result))
      return "unavailable";
    const status = (result as { status?: unknown }).status;
    if (status === "clean") return "clean";
    if (status === "infected") return "infected";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function matches(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}
