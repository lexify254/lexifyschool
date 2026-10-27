import { z } from "zod";
import { getPaymentRuntimeConfig, paymentsUnavailableResponse } from "@/lib/payments/config";
import { allowPaymentRequest } from "@/lib/payments/core";
import { getAuthenticatedUser, getPrivilegedSupabaseClient, jsonError, MAX_PAYMENT_BODY_BYTES, readBoundedBody, sanitizedPaymentLog } from "@/lib/payments/server";
import { createPaymentProvider } from "@/lib/payments/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const refundSchema = z.object({ paymentId: z.string().uuid() }).strict();

export async function POST(request: Request): Promise<Response> {
  const user = await getAuthenticatedUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!allowPaymentRequest(`refund:${user.id}`, 2)) return jsonError("Too many refund requests. Try again later.", 429);
  const config = getPaymentRuntimeConfig();
  if (!config.configured) return paymentsUnavailableResponse();
  const client = getPrivilegedSupabaseClient();
  if (!client) return paymentsUnavailableResponse();
  const body = await readBoundedBody(request, MAX_PAYMENT_BODY_BYTES);
  if (!body) return jsonError("Request body is too large.", 413);
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder().decode(body)); } catch { return jsonError("Invalid JSON request.", 400); }
  const parsed = refundSchema.safeParse(raw);
  if (!parsed.success) return jsonError("Invalid refund request.", 422);

  const { data: refund, error: requestError } = await client.rpc("request_payment_refund", {
    p_payment_id: parsed.data.paymentId,
    p_actor: user.id,
  });
  if (requestError || !refund || typeof refund !== "object") return jsonError("Only the payer of a completed payment may request its refund.", 422);
  const details = refund as { id?: string; status?: string; amount_kes?: number; created?: boolean };
  if (!details.id) return jsonError("Refund request could not be recorded.", 503);
  if (!details.created || details.status !== "pending") {
    return Response.json({ refundId: details.id, status: details.status ?? "pending" }, { status: 202, headers: { "Cache-Control": "no-store" } });
  }
  const { data: payment } = await client.from("payments")
    .select("id,payer_id,amount_kes,currency,purpose,provider,provider_reference,provider_tracking_id,provider_confirmation_code,target_id,target_student_id,order_id,status")
    .eq("id", parsed.data.paymentId).eq("payer_id", user.id).maybeSingle();
  if (!payment || payment.status !== "successful") return jsonError("Completed payment not found.", 422);
  if (payment.provider !== config.provider) return paymentsUnavailableResponse();
  try {
    const provider = createPaymentProvider(config.provider);
    const result = await provider.refund(payment as never, Number(details.amount_kes));
    const { error: updateError } = await client.rpc("record_payment_refund_submission", {
      p_refund_id: details.id,
      p_provider_reference: result.providerReference ?? null,
    });
    if (updateError) throw new Error("Refund submission could not be recorded");
    sanitizedPaymentLog("refund_requested", { provider: config.provider, paymentId: payment.id, refundId: details.id });
    return Response.json({ refundId: details.id, status: "pending" }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch {
    // The durable refund record remains pending; no access or ledger changes occur.
    sanitizedPaymentLog("refund_submission_unconfirmed", { provider: config.provider, paymentId: payment.id, refundId: details.id });
    return Response.json({ refundId: details.id, status: "pending", message: "Refund request is recorded and awaits provider reconciliation." }, { status: 202, headers: { "Cache-Control": "no-store" } });
  }
}
