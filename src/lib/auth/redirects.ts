import { roleHome, type AppRole } from "@/lib/auth/roles";

export function safeSameOriginPath(
  candidate: string | null | undefined,
  origin: string,
  fallback = "/",
): string {
  if (
    !candidate ||
    candidate[0] !== "/" ||
    candidate.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(candidate) ||
    /%(?:0[ad]|5c)/i.test(candidate)
  ) {
    return fallback;
  }

  try {
    const base = new URL(origin);
    if (base.protocol !== "https:" && base.protocol !== "http:") return fallback;
    const resolved = new URL(candidate, base);
    if (resolved.origin !== base.origin) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export function safeRoleDestination(
  candidate: string | null | undefined,
  origin: string,
  role: AppRole,
): string {
  const fallback = roleHome[role];
  const destination = safeSameOriginPath(candidate, origin, fallback);
  const pathname = destination.split(/[?#]/, 1)[0];
  const firstSegment = pathname.split("/").filter(Boolean)[0];

  if (["login", "auth", "password"].includes(firstSegment ?? "")) return fallback;
  if (firstSegment === "admin" && role !== "admin") return fallback;
  if (["student", "parent", "teacher", "guest"].includes(firstSegment ?? "") && firstSegment !== role) return fallback;
  return destination;
}
