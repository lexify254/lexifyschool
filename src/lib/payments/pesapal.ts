import type { PaymentProvider, PaymentRecord, InitializePaymentInput, InitializePaymentResult, PaymentVerification, PaymentWebhookCandidate } from "./core";
import { kesToMinorUnits, normalizeReference, referencesMatch } from "./core";

interface PesapalConfig {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  ipnId: string;
  username?: string | null;
  fetcher?: typeof fetch;
}

function apiError(operation: string, status: number): Error {
  return new Error(`PesaPal ${operation} failed (HTTP ${status})`);
}

function kesCents(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") return NaN;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) return NaN;
  try {
    return kesToMinorUnits(amount);
  } catch {
    return NaN;
  }
}

export class PesapalProvider implements PaymentProvider {
  readonly name = "pesapal" as const;
  private readonly baseUrl: string;
  private readonly consumerKey: string;
  private readonly consumerSecret: string;
  private readonly ipnId: string;
  private readonly username: string | null;
  private readonly fetcher: typeof fetch;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: PesapalConfig) {
    if (!config.baseUrl || !config.consumerKey || !config.consumerSecret || !config.ipnId) {
      throw new Error("PesaPal configuration is incomplete");
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.consumerKey = config.consumerKey;
    this.consumerSecret = config.consumerSecret;
    this.ipnId = config.ipnId;
    this.username = config.username?.trim() || null;
    this.fetcher = config.fetcher ?? fetch;
  }

  private async bearerToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    const response = await this.fetcher(`${this.baseUrl}/api/Auth/RequestToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({ consumer_key: this.consumerKey, consumer_secret: this.consumerSecret }),
    });
    if (!response.ok) throw apiError("authentication", response.status);
    const payload = (await response.json()) as { token?: unknown; expiryDate?: unknown };
    if (typeof payload.token !== "string" || !payload.token) throw new Error("PesaPal returned an invalid token response");
    this.token = payload.token;
    // The documented token lifetime is at most five minutes; refresh early.
    const expiry = typeof payload.expiryDate === "string" ? Date.parse(payload.expiryDate) : NaN;
    this.tokenExpiresAt = Number.isFinite(expiry) ? Math.min(expiry, Date.now() + 4 * 60_000) : Date.now() + 4 * 60_000;
    return this.token;
  }

  async initialize(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const reference = normalizeReference(input.reference);
    if (!reference) throw new Error("Invalid PesaPal merchant reference");
    if (!input.notificationId || input.notificationId !== this.ipnId) throw new Error("PesaPal IPN registration is required");
    const names = input.customer.name.trim().split(/\s+/).filter(Boolean);
    const firstName = names[0] ?? "Lexify";
    const lastName = names.slice(1).join(" ") || firstName;
    const token = await this.bearerToken();
    const response = await this.fetcher(`${this.baseUrl}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        id: reference,
        currency: "KES",
        amount: Math.round(input.amountKes * 100) / 100,
        description: input.description.slice(0, 100),
        callback_url: input.callbackUrl,
        notification_id: this.ipnId,
        billing_address: {
          email_address: input.customer.email,
          phone_number: input.customer.phone ?? "",
          country_code: "KE",
          first_name: firstName,
          last_name: lastName,
        },
      }),
    });
    if (!response.ok) throw apiError("order submission", response.status);
    const payload = (await response.json()) as { order_tracking_id?: unknown; merchant_reference?: unknown; redirect_url?: unknown };
    const trackingId = typeof payload.order_tracking_id === "string" ? payload.order_tracking_id : "";
    const checkoutUrl = typeof payload.redirect_url === "string" ? payload.redirect_url : "";
    if (!trackingId || !referencesMatch(payload.merchant_reference, reference) || !checkoutUrl.startsWith("https://")) {
      throw new Error("PesaPal returned an invalid order response");
    }
    return { reference, trackingId, checkoutUrl };
  }

  async verify(payment: PaymentRecord): Promise<PaymentVerification> {
    const reference = normalizeReference(payment.provider_reference);
    const trackingId = payment.provider_tracking_id?.trim();
    if (!reference || !trackingId || trackingId.length > 200) throw new Error("Payment is missing its PesaPal order identifiers");
    const token = await this.bearerToken();
    const url = new URL(`${this.baseUrl}/api/Transactions/GetTransactionStatus`);
    url.searchParams.set("orderTrackingId", trackingId);
    const response = await this.fetcher(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) throw apiError("status verification", response.status);
    const payload = (await response.json()) as {
      payment_status_description?: unknown;
      payment_status_code?: unknown;
      order_tracking_id?: unknown;
      merchant_reference?: unknown;
      currency?: unknown;
      amount?: unknown;
      confirmation_code?: unknown;
    };
    const currency = typeof payload.currency === "string" ? payload.currency : "";
    const amountKes = typeof payload.amount === "number" || typeof payload.amount === "string" ? Number(payload.amount) : NaN;
    const completed = String(payload.payment_status_description ?? "").trim().toUpperCase() === "COMPLETED"
      && Number(payload.payment_status_code) === 1;
    const idsMatch = referencesMatch(payload.merchant_reference, reference)
      && String(payload.order_tracking_id ?? trackingId) === trackingId;
    return {
      state: completed ? "successful" : "pending",
      reference: typeof payload.merchant_reference === "string" ? payload.merchant_reference : "",
      trackingId,
      confirmationCode: typeof payload.confirmation_code === "string" ? payload.confirmation_code : undefined,
      currency,
      amountKes,
      authoritative: completed && idsMatch,
    };
  }

  async webhook(input: { rawBody: Uint8Array; query?: URLSearchParams }): Promise<PaymentWebhookCandidate> {
    // PesaPal API 3.0 does not provide a callback signature here. These identifiers
    // are only lookup hints; the caller must always invoke verify() server-side.
    const query = input.query;
    const trackingId = query?.get("OrderTrackingId") ?? query?.get("orderTrackingId") ?? query?.get("order_tracking_id");
    const reference = query?.get("OrderMerchantReference") ?? query?.get("merchant_reference") ?? query?.get("id");
    if (!trackingId || trackingId.length > 200) return { kind: "ignored" };
    const normalized = reference ? normalizeReference(reference) : null;
    return { kind: "payment", reference: normalized ?? "", trackingId };
  }

  async refund(payment: PaymentRecord, amountKes?: number): Promise<{ state: "pending"; providerReference?: string }> {
    if (!this.username) throw new Error("PesaPal refund username is not configured");
    const confirmationCode = payment.provider_confirmation_code?.trim();
    if (!confirmationCode) throw new Error("PesaPal refund requires a confirmed payment code");
    const amount = amountKes ?? Number(payment.amount_kes);
    if (!Number.isFinite(amount) || kesToMinorUnits(amount) !== kesToMinorUnits(Number(payment.amount_kes))) {
      throw new Error("PesaPal refund implementation supports full-payment refunds only");
    }
    const token = await this.bearerToken();
    const response = await this.fetcher(`${this.baseUrl}/api/Transactions/RefundRequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        confirmation_code: confirmationCode,
        amount,
        username: this.username,
        remarks: `Lexify School payment refund ${payment.id}`,
      }),
    });
    if (!response.ok) throw apiError("refund request", response.status);
    const payload = (await response.json()) as { status?: unknown; message?: unknown; request_id?: unknown };
    if (payload.status === false || String(payload.status ?? "").toLowerCase() === "failed") {
      throw new Error("PesaPal did not accept the refund request");
    }
    return { state: "pending", providerReference: payload.request_id == null ? undefined : String(payload.request_id) };
  }
}
