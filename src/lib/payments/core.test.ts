import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { decideSettlement, kesToMinorUnits, minorUnitsToKes, normalizeReference, referencesMatch, verifyHmacSha512 } from "./core";
import { getPaymentRuntimeConfig } from "./config";

describe("payment core", () => {
  it("converts KES whole shillings and decimals to minor units", () => {
    expect(kesToMinorUnits(150)).toBe(15_000);
    expect(kesToMinorUnits(150.25)).toBe(15_025);
    expect(minorUnitsToKes(15_025)).toBe(150.25);
    expect(() => kesToMinorUnits(1.001)).toThrow();
    expect(() => kesToMinorUnits(0)).toThrow();
  });

  it("validates exact raw-body Paystack HMAC-SHA512 signatures", () => {
    const raw = Buffer.from('{"event":"charge.success"}');
    const secret = "test_secret_value";
    const signature = createHmac("sha512", secret).update(raw).digest("hex");
    expect(verifyHmacSha512(raw, signature, secret)).toBe(true);
    expect(verifyHmacSha512(Buffer.from('{"event":"charge.success" }'), signature, secret)).toBe(false);
    expect(verifyHmacSha512(raw, "not-a-signature", secret)).toBe(false);
    expect(verifyHmacSha512(raw, signature, "different-secret")).toBe(false);
  });

  it("normalizes only legal bounded merchant references", () => {
    expect(normalizeReference("  LEX_abc-123  ")).toBe("LEX_abc-123");
    expect(normalizeReference("a".repeat(50))).toHaveLength(50);
    expect(normalizeReference("a".repeat(51))).toBeNull();
    expect(normalizeReference("ref with spaces")).toBeNull();
    expect(referencesMatch(" LEX-123 ", "LEX-123")).toBe(true);
    expect(referencesMatch("LEX-123", "lex-123")).toBe(false);
  });

  it("settles only authoritative matching pending payments and classifies duplicates", () => {
    const matches = { authoritative: true, verifiedState: "successful" as const, matchesExpectedPayment: true };
    expect(decideSettlement({ currentState: "pending", ...matches })).toBe("settle");
    expect(decideSettlement({ currentState: "successful", ...matches })).toBe("already_processed");
    expect(decideSettlement({ currentState: "pending", ...matches, authoritative: false })).toBe("ignore");
    expect(decideSettlement({ currentState: "pending", ...matches, matchesExpectedPayment: false })).toBe("ignore");
    expect(decideSettlement({ currentState: "failed", ...matches })).toBe("ignore");
  });

  it("defaults to sandbox and fails closed if test credentials/config are missing", () => {
    const missing = getPaymentRuntimeConfig({ PAYMENT_PROVIDER: "paystack" });
    expect(missing.mode).toBe("test");
    expect(missing.configured).toBe(false);
    expect(missing.missing).toContain("PAYSTACK_SECRET_KEY");
    const test = getPaymentRuntimeConfig({
      PAYMENT_PROVIDER: "paystack", PAYMENT_TEST_MODE: "true", PAYSTACK_SECRET_KEY: "sk_test_real",
      PAYSTACK_CALLBACK_URL: "https://school.test/payments/return",
    });
    expect(test.mode).toBe("test");
    expect(test.configured).toBe(true);
    const liveWithoutWebhook = getPaymentRuntimeConfig({
      PAYMENT_PROVIDER: "paystack", PAYMENT_TEST_MODE: "false", PAYSTACK_SECRET_KEY: "sk_live_real",
      PAYSTACK_CALLBACK_URL: "https://school.test/payments/return",
    });
    expect(liveWithoutWebhook.configured).toBe(false);
    expect(liveWithoutWebhook.missing).toContain("PAYSTACK_WEBHOOK_URL (public HTTPS URL configured with Paystack)");
  });
});
