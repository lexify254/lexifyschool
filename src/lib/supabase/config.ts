export type SupabasePublicConfig = {
  url: string;
  key: string;
};

function isUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function isPublicKey(value: string): boolean {
  return (
    /^sb_publishable_[A-Za-z0-9_-]+$/.test(value) ||
    /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
  );
}

export function resolveSupabaseConfig(
  rawUrl: string | undefined,
  rawKey: string | undefined,
): SupabasePublicConfig | null {
  const first = rawUrl?.trim() ?? "";
  const second = rawKey?.trim() ?? "";

  if (isUrl(first) && isPublicKey(second)) {
    return { url: first, key: second };
  }

  if (isPublicKey(first) && isUrl(second)) {
    return { url: second, key: first };
  }

  return null;
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  return resolveSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
