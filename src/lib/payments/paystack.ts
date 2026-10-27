import type { PaymentProvider, PaymentRecord, InitializePaymentInput, InitializePaymentResult, PaymentVerification, PaymentWebhookCandidate } from "./core";
import { kesToMinorUnits, minorUnitsToKes, normalizeReference, referencesMatch, verifyHmacSha512 } from "./core";

interface PaystackConfig {
  secret: string;
  fetcher?: typeof fetch;
}

function apiError(operation: string, status: number): Error {
  return new Error(`Paystack ${operation} failed (HTTP ${status})`);
}

export class PaystackProvider implements PaymentProvider {
  readonly name = "paystack" as const;
  private readonly secret: string;
  private readonly fetcher: typeof fetch;

  constructor(config: PaystackConfig) {
    if (!config.secret) throw new Error("Paystack secret is required");
    this.secret = config.secret;
    this.fetcher = config.fetcher ?? fetch;
  }

  async initialize(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const reference = normalizeReference(input.reference);
    if (!reference) throw new Error("Invalid payment reference");
    const response = await this.fetcher("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.secret}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        email: input.customer.email,
        amount: kesToMinorUnits(input.amountKes),
        currency: "KES",
        reference,
        callback_url: input.callbackUrl,
        metadata: { purpose: "lexifyschool_payment" },
      }),
    });
    if (!response.ok) throw apiError("initialize", response.status);
    const payload = (await response.json()) as { status?: boolean; data?: { reference?: unknown; authorization_url?: unknown } };
    const checkoutUrl = typeof payload.data?.authorization_url === "string" ? payload.data.authorization_url : "";
    if (!payload.status || !referencesMatch(payload.data?.reference, reference) || !checkoutUrl.startsWith("https://")) {
      throw new Error("Paystack returned an invalid initialization response");
    }
    return { reference, checkoutUrl };
  }

  async verify(payment: PaymentRecord): Promise<PaymentVerification> {
    const reference = normalizeReference(payment.provider_reference);
    if (!reference) throw new Error("Payment has no valid Paystack reference");
    const response = await this.fetcher(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.secret}` },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) throw apiError("verification", response.status);
    const payload = (await response.json()) as {
      status?: boolean;
      data?: { status?: unknown; reference?: unknown; currency?: unknown; amount?: unknown };
    };
    const data = payload.data;
    if (!payload.status || !data) throw new Error("Paystack returned an invalid verification response");
    const amountKes = typeof data.amount === "number" && Number.isSafeInteger(data.amount) ? minorUnitsToKes(data.amount) : NaN;
    const verified = data.status === "success";
    return {
      state: verified ? "successful" : "failed",
      reference: typeof data.reference === "string" ? data.reference : "",
      currency: typeof data.currency === "string" ? data.currency : "",
      amountKes,
      authoritative: verified && referencesMatch(data.reference, reference),
    };
  }

  async webhook(input: { rawBody: Uint8Array; signature?: string }): Promise<PaymentWebhookCandidate> {
    if (!verifyHmacSha512(input.rawBody, input.signature, this.secret)) throw new Error("Invalid Paystack webhook signature");
    // Signature validation is deliberately complete before parsing the raw payload.
    let payload: { event?: unknown; data?: { reference?: unknown } };
    try {
      payload = JSON.parse(new TextDecoder().decode(input.rawBody)) as typeof payload;
    } catch {
      throw new Error("Invalid Paystack webhook payload");
    }
    if (payload.event !== "charge.success") return { kind: "ignored" };
    const reference = normalizeReference(payload.data?.reference);
    return reference ? { kind: "payment", reference } : { kind: "ignored" };
  }

  async refund(payment: PaymentRecord, amountKes?: number): Promise<{ state: "pending"; providerReference?: string }> {
    const reference = normalizeReference(payment.provider_reference);
    if (!reference) throw new Error("Payment has no valid Paystack reference");
    const body: Record<string, string | number> = { transaction: reference };
    if (amountKes !== undefined) body.amount = kesToMinorUnits(amountKes);
    const response = await this.fetcher("https://api.paystack.co/refund", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.secret}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw apiError("refund request", response.status);
    const payload = (await response.json()) as { status?: boolean; data?: { id?: unknown; status?: unknown } };
    if (!payload.status) throw new Error("Paystack did not accept the refund request");
    return { state: "pending", providerReference: payload.data?.id == null ? undefined : String(payload.data.id) };
  }
}
