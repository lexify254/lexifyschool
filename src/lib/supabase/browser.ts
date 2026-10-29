"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabaseCookieOptions } from "@/lib/supabase/cookies";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  if (!client) {
    client = createBrowserClient(config.url, config.key, {
      cookieOptions: getBrowserSupabaseCookieOptions(),
    });
  }
  return client;
}
