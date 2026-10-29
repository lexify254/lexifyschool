import "server-only";

const FALLBACK_PUBLIC_ORIGIN = "https://lexifyschool-grfxddmm.manus.space";

export function getPublicSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return FALLBACK_PUBLIC_ORIGIN;

  try {
    const url = new URL(configured);
    const hostname = url.hostname.toLowerCase();
    const isPrivateHost =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
      hostname.includes(":");
    const isPlaceholder =
      hostname === "example.com" || hostname.endsWith(".example.com");

    if (
      url.protocol === "https:" &&
      hostname &&
      !url.username &&
      !url.password &&
      !isPrivateHost &&
      !isPlaceholder
    ) {
      return url.origin;
    }
  } catch {
    // Fall back to the published Lexify origin rather than deriving one from
    // the incoming request host, which can be an internal Preview proxy host.
  }

  return FALLBACK_PUBLIC_ORIGIN;
}
