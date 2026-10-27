import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPaymentRuntimeConfig, paymentsUnavailableResponse } from "@/lib/payments/config";
import { allowPaymentRequest } from "@/lib/payments/core";
import { getAuthenticatedUser, getPrivilegedSupabaseClient, jsonError, MAX_PAYMENT_BODY_BYTES, readBoundedBody, sanitizedPaymentLog } from "@/lib/payments/server";
import { createPaymentProvider } from "@/lib/payments/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const initializeSchema = z.object({
  purpose: z.enum(["tutoring", "course", "product"]),
  targetId: z.string().uuid(),
  studentId: z.string().uuid().optional(),
}).strict();

function requestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 80) || "unknown";
}

export async function POST(request: Request): Promise<Response> {
  const user = await getAuthenticatedUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!allowPaymentRequest(`init:${user.id}:${requestIp(request)}`, 6)) return jsonError("Too many payment requests. Try again shortly.", 429);

  const config = getPaymentRuntimeConfig();
  if (!config.configured) return paymentsUnavailableResponse();
  const privileged = getPrivilegedSupabaseClient();
  if (!privileged) return paymentsUnavailableResponse();

  const body = await readBoundedBody(request, MAX_PAYMENT_BODY_BYTES);
  if (!body) return jsonError("Request body is too large.", 413);
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return jsonError("Invalid JSON request.", 400);
  }
  const parsed = initializeSchema.safeParse(raw);
  if (!parsed.success) return jsonError("Invalid payment request.", 422);

  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length < 8 || key.length > 128 || !/^[A-Za-z0-9_-]+$/.test(key)) {
    return jsonError("A valid Idempotency-Key header is required.", 422);
  }

  const reference = `LEX${randomUUID().replaceAll("-", "")}`;
  const { data: intentData, error: intentError } = await privileged.rpc("create_payment_intent", {
    p_actor: user.id,
    p_purpose: parsed.data.purpose,
    p_target_id: parsed.data.targetId,
    p_student_id: parsed.data.studentId ?? null,
    p_provider: config.provider,
    p_idempotency_key: key,
    p_reference: reference,
  });
  if (intentError || !intentData || typeof intentData !== "object") {
    sanitizedPaymentLog("intent_rejected", { provider: config.provider, userId: user.id, reason: "database_validation" });
    return jsonError("The requested payment could not be created. Check the item and learner selection.", 422);
  }
  const intent = intentData as {
    id?: string; amount_kes?: number | string; provider_reference?: string; purpose?: string;
    target_student_id?: string; checkout_url?: string | null; status?: string; reused?: boolean;
  };
  if (!intent.id || !intent.provider_reference || !intent.amount_kes || intent.status !== "pending") {
    if (intent.checkout_url && intent.id && intent.provider_reference && intent.amount_kes) {
      return Response.json({ paymentId: intent.id, reference: intent.provider_reference, amountKes: Number(intent.amount_kes), checkoutUrl: intent.checkout_url }, { headers: { "Cache-Control": "no-store" } });
    }
    return jsonError("This payment is already being processed. Contact support if it remains pending.", 409);
  }
  if (intent.reused && intent.checkout_url) {
    return Response.json({ paymentId: intent.id, reference: intent.provider_reference, amountKes: Number(intent.amount_kes), checkoutUrl: intent.checkout_url }, { headers: { "Cache-Control": "no-store" } });
  }
  if (intent.reused) return jsonError("This payment initialization is pending. Do not submit another payment; contact support if it remains pending.", 409);

  const [{ data: profile }, provider] = await Promise.all([
    privileged.from("profiles").select("full_name,phone").eq("id", user.id).maybeSingle(),
    Promise.resolve(createPaymentProvider(config.provider)),
  ]);
  if (!user.email || !config.callbackUrl) return paymentsUnavailableResponse();
  try {
    const initialized = await provider.initialize({
      reference: intent.provider_reference,
      amountKes: Number(intent.amount_kes),
      currency: "KES",
      callbackUrl: config.callbackUrl,
      description: `Lexify School ${intent.purpose ?? parsed.data.purpose} payment`,
      customer: {
        email: user.email,
        name: profile?.full_name?.trim() || "Lexify School learner",
        phone: profile?.phone ?? null,
      },
      notificationId: config.pesapalIpnId ?? undefined,
    });
    const { error: updateError } = await privileged.from("payments").update({
      provider_reference: initialized.reference,
      provider_tracking_id: initialized.trackingId ?? null,
      checkout_url: initialized.checkoutUrl,
    }).eq("id", intent.id).eq("status", "pending");
    if (updateError) throw new Error("Could not persist provider transaction identifiers");
    sanitizedPaymentLog("checkout_initialized", { provider: config.provider, paymentId: intent.id, userId: user.id, mode: config.mode });
    return Response.json({
      paymentId: intent.id,
      reference: initialized.reference,
      amountKes: Number(intent.amount_kes),
      checkoutUrl: initialized.checkoutUrl,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    sanitizedPaymentLog("checkout_initialization_failed", { provider: config.provider, paymentId: intent.id, userId: user.id });
    return jsonError("The provider could not initialize this payment. The payment remains pending; contact support before retrying.", 503);
  }
}
