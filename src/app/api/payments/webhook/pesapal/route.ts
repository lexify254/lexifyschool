import { getPaymentRuntimeConfig, paymentsUnavailableResponse } from "@/lib/payments/config";
import { allowPaymentRequest } from "@/lib/payments/core";
import { reconcileWebhookCandidate } from "@/lib/payments/reconcile";
import { getPrivilegedSupabaseClient, jsonError, MAX_WEBHOOK_BODY_BYTES, readBoundedBody, sanitizedPaymentLog } from "@/lib/payments/server";
import { createPaymentProvider } from "@/lib/payments/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  const config = getPaymentRuntimeConfig();
  if (!config.configured || config.provider !== "pesapal") return paymentsUnavailableResponse();
  const client = getPrivilegedSupabaseClient();
  if (!client) return paymentsUnavailableResponse();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 80) || "unknown";
  if (!allowPaymentRequest(`hook:pesapal:${ip}`, 60)) return jsonError("Rate limit exceeded.", 429);
  const body = await readBoundedBody(request, MAX_WEBHOOK_BODY_BYTES);
  if (!body) return jsonError("Notification body is too large.", 413);
  const provider = createPaymentProvider("pesapal");
  try {
    const candidate = await provider.webhook({ rawBody: body, query: new URL(request.url).searchParams });
    const result = await reconcileWebhookCandidate({ client, provider, candidate });
    sanitizedPaymentLog("notification_processed", { provider: "pesapal", outcome: result });
    // PesaPal expects the acknowledgement shape; callback/IPN hints never grant access.
    return Response.json({ orderNotificationType: "IPNCHANGE", orderTrackingId: new URL(request.url).searchParams.get("OrderTrackingId"), orderMerchantReference: new URL(request.url).searchParams.get("OrderMerchantReference"), status: 200 }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    sanitizedPaymentLog("notification_reconciliation_failed", { provider: "pesapal", reason: "status_poll_or_settlement" });
    return jsonError("Notification could not be reconciled. Provider may retry.", 503);
  }
}

export const GET = handle;
export const POST = handle;
