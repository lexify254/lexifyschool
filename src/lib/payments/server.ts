import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentProviderName } from "./core";
import { getPaymentRuntimeConfig } from "./config";
import { PaystackProvider } from "./paystack";
import { PesapalProvider } from "./pesapal";

export function createPaymentProvider(name?: PaymentProviderName) {
  const config = getPaymentRuntimeConfig();
  if (!config.configured) throw new Error("Payments are not configured");
  const provider = name ?? config.provider;
  if (provider === "paystack" && config.paystackSecret) {
    return new PaystackProvider({ secret: config.paystackSecret });
  }
  if (provider === "pesapal" && config.pesapalBaseUrl && config.pesapalConsumerKey && config.pesapalConsumerSecret && config.pesapalIpnId) {
    return new PesapalProvider({
      baseUrl: config.pesapalBaseUrl,
      consumerKey: config.pesapalConsumerKey,
      consumerSecret: config.pesapalConsumerSecret,
      ipnId: config.pesapalIpnId,
      username: config.pesapalUsername,
    });
  }
  throw new Error("Payments are not configured");
}

export function getPrivilegedSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key || /^(replace_me|your[-_]|example|change[-_]?me)/i.test(key)) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

export async function getAuthenticatedUser() {
  const client = await getSupabaseServerClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : data.user;
}

export const MAX_PAYMENT_BODY_BYTES = 8 * 1024;
export const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

export async function readBoundedBody(request: Request, maximum: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function sanitizedPaymentLog(event: string, fields: Record<string, string | number | boolean | null>): void {
  // Call sites pass only internal IDs, provider name and coarse outcomes. Never log
  // credentials, raw provider payloads, email, phone, card data or webhook signatures.
  console.info("payment_event", { event, ...fields });
}
