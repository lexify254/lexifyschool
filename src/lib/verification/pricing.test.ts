import { describe, expect, it } from "vitest";
import {
  formatVerificationFee,
  isActiveVerificationAward,
  parseVerificationFeeInput,
  verificationBadgeStatus,
} from "./pricing";

describe("teacher verification pricing and trial status", () => {
  it("leaves a blank fee unconfigured instead of inventing a default", () => {
    expect(parseVerificationFeeInput("")).toBeNull();
    expect(parseVerificationFeeInput(null)).toBeNull();
    expect(formatVerificationFee({ configured: false, amount: null, currency: "KES" })).toBe("Fee not configured");
  });

  it("accepts a positive KES amount with up to two decimals", () => {
    expect(parseVerificationFeeInput("1250.50")).toBe(1250.5);
    expect(() => parseVerificationFeeInput("0")).toThrow(/greater than zero/);
    expect(() => parseVerificationFeeInput("1.001")).toThrow(/two decimal places/);
  });

  it("treats revoked and expired awards as unverified", () => {
    const now = Date.parse("2026-11-23T10:00:00.000Z");
    expect(isActiveVerificationAward({ expires_at: "2026-11-23T10:00:01.000Z" }, now)).toBe(true);
    expect(isActiveVerificationAward({ expires_at: "2026-11-23T10:00:00.000Z" }, now)).toBe(false);
    expect(isActiveVerificationAward({ expires_at: null, revoked_at: "2026-11-22T10:00:00Z" }, now)).toBe(false);
    expect(verificationBadgeStatus("verified", { expires_at: "2026-11-22T10:00:00.000Z" }, now)).toBe("unverified");
  });
});
