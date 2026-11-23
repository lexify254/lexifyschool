export const VERIFICATION_TRIAL_DAYS = 14;
export const VERIFICATION_CURRENCY = "KES" as const;

export type VerificationFee = {
  configured: boolean;
  amount: number | null;
  currency: typeof VERIFICATION_CURRENCY;
};

export function parseVerificationFeeInput(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("Enter a valid fee amount.");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 999999999.99) {
    throw new Error("Fee must be greater than zero and no more than KES 999,999,999.99.");
  }
  if (Math.round(parsed * 100) !== parsed * 100) {
    throw new Error("Fee can have at most two decimal places.");
  }
  return parsed;
}

export function isActiveVerificationAward(
  award: { revoked_at?: string | null; expires_at?: string | null } | null | undefined,
  now = Date.now()
): boolean {
  if (!award || award.revoked_at) return false;
  if (!award.expires_at) return true;
  const expiry = Date.parse(award.expires_at);
  return Number.isFinite(expiry) && expiry > now;
}

export function verificationBadgeStatus(
  profileStatus: unknown,
  award: { revoked_at?: string | null; expires_at?: string | null } | null | undefined,
  now = Date.now()
): "verified" | "unverified" {
  return profileStatus === "verified" && isActiveVerificationAward(award, now)
    ? "verified"
    : "unverified";
}

export function formatVerificationFee(fee: VerificationFee | null | undefined) {
  if (!fee?.configured || fee.amount === null || !Number.isFinite(fee.amount)) {
    return "Fee not configured";
  }
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: fee.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(fee.amount);
}
