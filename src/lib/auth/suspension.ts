export function isAccountSuspended(
  profile: { is_suspended?: unknown } | null | undefined
): boolean {
  return profile?.is_suspended !== false;
}
