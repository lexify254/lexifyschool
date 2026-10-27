import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { PaystackProvider } from "./paystack";
import { PesapalProvider } from "./pesapal";
import type { PaymentRecord } from "./core";

const paystackPayment: PaymentRecord = {
  id: "payment-1", payer_id: "payer-1", amount_kes: "125.50", currency: "KES", purpose: "course",
  provider: "paystack", provider_reference: "LEX_abc123", provider_tracking_id: null,
  provider_confirmation_code: null, target_id: "target-1", target_student_id: "student-1", order_id: null, status: "pending",
};
const pesapalPayment: PaymentRecord = {
  ...paystackPayment, provider: "pesapal", provider_reference: "LEX_abc123", provider_tracking_id: "track-123",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

describe("provider adapters", () => {
  it("Paystack webhook rejects an invalid signature before attempting JSON parsing", async () => {
    const provider = new PaystackProvider({ secret: "unit_test_secret" });
    await expect(provider.webhook({ rawBody: Buffer.from("not-json"), signature: "invalid" })).rejects.toThrow(/signature/i);
  });

  it("Paystack verifies reference, KES amount in subunits and checkout reference", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ status: true, data: { reference: "LEX_abc123", authorization_url: "https://checkout.test/1" } }))
      .mockResolvedValueOnce(jsonResponse({ status: true, data: { status: "success", reference: "LEX_abc123", currency: "KES", amount: 12_550 } }));
    const provider = new PaystackProvider({ secret: "unit_test_secret", fetcher });
    const initialized = await provider.initialize({
      reference: "LEX_abc123", amountKes: 125.5, currency: "KES", callbackUrl: "https://school.test/return",
      description: "Course", customer: { email: "learner@example.test", name: "Learner" },
    });
    expect(initialized.checkoutUrl).toBe("https://checkout.test/1");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).amount).toBe(12_550);
    const verified = await provider.verify(paystackPayment);
    expect(verified).toMatchObject({ state: "successful", reference: "LEX_abc123", currency: "KES", amountKes: 125.5, authoritative: true });
  });

  it("Paystack signature covers the exact raw bytes", async () => {
    const secret = "secret-for-test";
    const raw = Buffer.from('{"event":"charge.success","data":{"reference":"LEX_abc123"}}');
    const signature = createHmac("sha512", secret).update(raw).digest("hex");
    const provider = new PaystackProvider({ secret });
    expect(await provider.webhook({ rawBody: raw, signature })).toEqual({ kind: "payment", reference: "LEX_abc123" });
    await expect(provider.webhook({ rawBody: Buffer.from(`${raw.toString()} `), signature })).rejects.toThrow(/signature/i);
  });

  it("PesaPal callback identifiers are hints and only server-polled COMPLETED code 1 is authoritative", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ token: "opaque-test-token", expiryDate: new Date(Date.now() + 60_000).toISOString() }))
      .mockResolvedValueOnce(jsonResponse({
        payment_status_description: "COMPLETED", payment_status_code: 1, order_tracking_id: "track-123",
        merchant_reference: "LEX_abc123", currency: "KES", amount: 125.5, confirmation_code: "confirm-1",
      }));
    const provider = new PesapalProvider({
      baseUrl: "https://sandbox.invalid", consumerKey: "test-key", consumerSecret: "test-secret",
      ipnId: "registered-test-ipn", fetcher,
    });
    const candidate = await provider.webhook({ rawBody: new Uint8Array(), query: new URLSearchParams({ OrderTrackingId: "track-123", OrderMerchantReference: "LEX_abc123" }) });
    expect(candidate).toEqual({ kind: "payment", reference: "LEX_abc123", trackingId: "track-123" });
    const verified = await provider.verify(pesapalPayment);
    expect(verified).toMatchObject({ state: "successful", authoritative: true, currency: "KES", amountKes: 125.5, confirmationCode: "confirm-1" });
    expect(fetcher.mock.calls[1][0]?.toString()).toContain("GetTransactionStatus");
  });

  it("PesaPal never regards callback status alone as a verified payment", async () => {
    const provider = new PesapalProvider({
      baseUrl: "https://sandbox.invalid", consumerKey: "test-key", consumerSecret: "test-secret", ipnId: "ipn",
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ token: "token" })),
    });
    expect(await provider.webhook({ rawBody: new Uint8Array(), query: new URLSearchParams({ OrderTrackingId: "t-1", status: "COMPLETED" }) }))
      .toEqual({ kind: "payment", reference: "", trackingId: "t-1" });
  });
});
