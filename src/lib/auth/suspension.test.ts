import { describe, expect, it } from "vitest";
import { isAccountSuspended } from "@/lib/auth/suspension";

describe("account suspension policy", () => {
  it("allows only profiles explicitly marked as not suspended", () => {
    expect(isAccountSuspended({ is_suspended: false })).toBe(false);
  });

  it("fails closed for suspended, missing, or malformed profile status", () => {
    expect(isAccountSuspended({ is_suspended: true })).toBe(true);
    expect(isAccountSuspended({})).toBe(true);
    expect(isAccountSuspended(null)).toBe(true);
    expect(isAccountSuspended(undefined)).toBe(true);
  });
});
