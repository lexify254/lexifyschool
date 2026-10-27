import { createHmac, timingSafeEqual } from "node:crypto";

export const PAYMENT_PROVIDERS = ["paystack", "pesapal"] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];
export type PaymentPurpose = "tutoring" | "course" | "product";
export type PaymentState =
  | "pending"
  | "successful"
  | "failed"
  | "abandoned"
  | "refunded"
  | "partially_refunded";

export interface PaymentRecord {
  id: string;
  payer_id: string;
  amount_kes: number | string;
  currency: "KES";
  purpose: PaymentPurpose;
  provider: PaymentProviderName;
  provider_reference: string;
  provider_tracking_id: string | null;
  provider_confirmation_code: string | null;
  target_id: string;
  target_student_id: string;
  order_id: string | null;
  status: PaymentState;
}

export interface PaymentCustomer {
  email: string;
  name: string;
  phone?: string | null;
}

export interface InitializePaymentInput {
  reference: string;
  amountKes: number;
  currency: "KES";
  callbackUrl: string;
  description: string;
  customer: PaymentCustomer;
  notificationId?: string;
}

export interface InitializePaymentResult {
  reference: string;
  checkoutUrl: string;
  trackingId?: string;
}

export interface PaymentVerification {
  state: "successful" | "failed" | "pending";
  reference: string;
  trackingId?: string;
  confirmationCode?: string;
  currency: string;
  amountKes: number;
  authoritative: boolean;
}

export type PaymentWebhookCandidate =
  | { kind: "payment"; reference: string; trackingId?: string }
  | { kind: "ignored" };

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  initialize(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verify(payment: PaymentRecord): Promise<PaymentVerification>;
  webhook(input: {
    rawBody: Uint8Array;
    signature?: string;
    query?: URLSearchParams;
  }): Promise<PaymentWebhookCandidate>;
  refund(payment: PaymentRecord, amountKes?: number): Promise<{ state: "pending"; providerReference?: string }>;
}

export function kesToMinorUnits(amountKes: number): number {
  if (!Number.isFinite(amountKes) || amountKes <= 0) throw new Error("KES amount must be positive and finite");
  const minor = Math.round((amountKes + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(minor) || Math.abs(amountKes * 100 - minor) > 1e-7) {
    throw new Error("KES amount must have at most two decimal places");
  }
  return minor;
}

export function minorUnitsToKes(minor: number): number {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error("Invalid KES minor-unit amount");
  return minor / 100;
}

export function normalizeReference(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ref = value.trim();
  if (ref.length < 1 || ref.length > 50 || !/^[A-Za-z0-9_-]+$/.test(ref)) return null;
  return ref;
}

export function referencesMatch(left: unknown, right: unknown): boolean {
  const a = normalizeReference(left);
  const b = normalizeReference(right);
  return a !== null && b !== null && a === b;
}

export function verifyHmacSha512(rawBody: Uint8Array, signature: string | undefined, secret: string): boolean {
  if (!signature || !/^[a-f\d]{128}$/i.test(signature) || !secret) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function decideSettlement(input: {
  currentState: PaymentState;
  authoritative: boolean;
  verifiedState: PaymentVerification["state"];
  matchesExpectedPayment: boolean;
}): "settle" | "already_processed" | "ignore" {
  if (input.currentState === "successful") return "already_processed";
  if (input.currentState !== "pending") return "ignore";
  if (input.authoritative && input.verifiedState === "successful" && input.matchesExpectedPayment) return "settle";
  return "ignore";
}

const rateWindows = new Map<string, { count: number; resetsAt: number }>();
let lastPruneAt = 0;

/** Per-process defense only. Deploy a shared durable limiter for distributed enforcement. */
export function allowPaymentRequest(key: string, limit = 8, windowMs = 60_000, now = Date.now()): boolean {
  if (rateWindows.size > 5_000 && now - lastPruneAt > 60_000) {
    for (const [candidate, window] of rateWindows) if (window.resetsAt <= now) rateWindows.delete(candidate);
    lastPruneAt = now;
  }
  const current = rateWindows.get(key);
  if (!current || current.resetsAt <= now) {
    rateWindows.set(key, { count: 1, resetsAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function resetPaymentRateLimitForTests(): void {
  rateWindows.clear();
}
