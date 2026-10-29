import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getServerSupabaseCookieOptions } from "@/lib/supabase/cookies";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: getServerSupabaseCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, { ...options, ...getServerSupabaseCookieOptions() });
          });
        } catch {
          // Server components cannot write cookies; src/proxy.ts refreshes sessions on requests.
        }
      },
    },
  });
}
