import { getPaymentRuntimeConfig, paymentsUnavailableResponse } from "@/lib/payments/config";
import { allowPaymentRequest } from "@/lib/payments/core";
import { reconcileWebhookCandidate } from "@/lib/payments/reconcile";
import { getPrivilegedSupabaseClient, jsonError, MAX_WEBHOOK_BODY_BYTES, readBoundedBody, sanitizedPaymentLog } from "@/lib/payments/server";
import { createPaymentProvider } from "@/lib/payments/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const config = getPaymentRuntimeConfig();
  if (!config.configured || config.provider !== "paystack") return paymentsUnavailableResponse();
  const client = getPrivilegedSupabaseClient();
  if (!client) return paymentsUnavailableResponse();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 80) || "unknown";
  if (!allowPaymentRequest(`hook:paystack:${ip}`, 60)) return jsonError("Rate limit exceeded.", 429);
  const body = await readBoundedBody(request, MAX_WEBHOOK_BODY_BYTES);
  if (!body) return jsonError("Webhook body is too large.", 413);
  const provider = createPaymentProvider("paystack");
  let candidate;
  try {
    // The adapter validates HMAC over these exact bytes before it parses JSON.
    candidate = await provider.webhook({ rawBody: body, signature: request.headers.get("x-paystack-signature") ?? undefined });
  } catch {
    sanitizedPaymentLog("webhook_rejected", { provider: "paystack", reason: "signature_or_payload" });
    return jsonError("Invalid webhook.", 401);
  }
  try {
    const result = await reconcileWebhookCandidate({ client, provider, candidate });
    sanitizedPaymentLog("webhook_processed", { provider: "paystack", outcome: result });
    return Response.json({ received: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("Webhook could not be reconciled. Provider may retry.", 503);
  }
}
