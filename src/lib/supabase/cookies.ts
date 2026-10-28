import type { CookieOptions } from "@supabase/ssr";

const securePreviewCookies: CookieOptions = { sameSite: "none", secure: true };
const localHttpCookies: CookieOptions = { sameSite: "lax", secure: false };
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Preview and production are public HTTPS even when the development server
 * receives HTTP internally. Default to secure cross-site cookies. Plain HTTP
 * is enabled only when the configured public origin explicitly targets loopback.
 */
export function getServerSupabaseCookieOptions(): CookieOptions {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredOrigin) {
    try {
      const origin = new URL(configuredOrigin);
      if (origin.protocol === "http:" && localHosts.has(origin.hostname)) {
        return localHttpCookies;
      }
    } catch {
      // Invalid or absent origin is not evidence that the public site is HTTP.
    }
  }
  return securePreviewCookies;
}

/** Browser-localhost handling uses the browser's public URL, not server request metadata. */
export function getBrowserSupabaseCookieOptions(): CookieOptions {
  if (typeof window !== "undefined" && window.location.protocol === "http:" && localHosts.has(window.location.hostname)) {
    return localHttpCookies;
  }
  return securePreviewCookies;
}
