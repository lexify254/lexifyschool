import type { PaymentProvider, PaymentRecord, PaymentWebhookCandidate } from "./core";
import { decideSettlement, referencesMatch } from "./core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizedPaymentLog } from "./server";

function sameKesAmount(left: number, right: number): boolean {
  return Number.isFinite(left) && Number.isFinite(right) && Math.round(left * 100) === Math.round(right * 100);
}

async function findPayment(client: SupabaseClient, providerName: PaymentRecord["provider"], candidate: Extract<PaymentWebhookCandidate, { kind: "payment" }>) {
  const columns = "id,payer_id,amount_kes,currency,purpose,provider,provider_reference,provider_tracking_id,provider_confirmation_code,target_id,target_student_id,order_id,status";
  if (candidate.trackingId) {
    const byTracking = await client.from("payments").select(columns).eq("provider", providerName)
      .eq("provider_tracking_id", candidate.trackingId).maybeSingle();
    if (!byTracking.error && byTracking.data) return byTracking.data as unknown as PaymentRecord;
  }
  if (candidate.reference) {
    const byReference = await client.from("payments").select(columns).eq("provider", providerName)
      .eq("provider_reference", candidate.reference).maybeSingle();
    if (!byReference.error && byReference.data) return byReference.data as unknown as PaymentRecord;
  }
  return null;
}

export async function reconcileWebhookCandidate(input: {
  client: SupabaseClient;
  provider: PaymentProvider;
  candidate: PaymentWebhookCandidate;
}): Promise<"ignored" | "pending" | "settled" | "duplicate"> {
  if (input.candidate.kind === "ignored") return "ignored";
  const payment = await findPayment(input.client, input.provider.name, input.candidate);
  if (!payment) return "ignored";
  if (payment.status === "successful") return "duplicate";
  if (payment.status !== "pending") return "ignored";

  const verification = await input.provider.verify(payment);
  const matchesExpected = verification.currency === "KES"
    && referencesMatch(verification.reference, payment.provider_reference)
    && (!payment.provider_tracking_id || !verification.trackingId || payment.provider_tracking_id === verification.trackingId)
    && sameKesAmount(verification.amountKes, Number(payment.amount_kes));
  const decision = decideSettlement({
    currentState: payment.status,
    authoritative: verification.authoritative,
    verifiedState: verification.state,
    matchesExpectedPayment: matchesExpected,
  });
  if (decision === "already_processed") return "duplicate";
  if (decision !== "settle") {
    sanitizedPaymentLog("provider_status_not_settled", { provider: input.provider.name, paymentId: payment.id, state: verification.state });
    return "pending";
  }

  const { error } = await input.client.rpc("settle_payment_atomic", {
    p_payment_id: payment.id,
    p_provider: input.provider.name,
    p_reference: payment.provider_reference,
    p_currency: verification.currency,
    p_amount_kes: verification.amountKes,
    p_tracking_id: verification.trackingId ?? payment.provider_tracking_id,
    p_confirmation_code: verification.confirmationCode ?? null,
  });
  if (error) {
    sanitizedPaymentLog("settlement_failed", { provider: input.provider.name, paymentId: payment.id, reason: "atomic_settlement_rejected" });
    throw new Error("Atomic payment settlement failed");
  }
  sanitizedPaymentLog("payment_settled", { provider: input.provider.name, paymentId: payment.id });
  return "settled";
}
