import { describe, expect, it } from "vitest";
import {
  isVerificationRequestId,
  parseReviewPayload,
  parseVerificationNote,
  VERIFICATION_NOTE_MAX_LENGTH,
} from "./validation";

describe("teacher verification input validation", () => {
  it("accepts and trims optional bounded claim notes", () => {
    expect(parseVerificationNote(undefined)).toBeNull();
    expect(parseVerificationNote("  I teach mathematics.  ")).toBe(
      "I teach mathematics."
    );
    expect(
      parseVerificationNote("x".repeat(VERIFICATION_NOTE_MAX_LENGTH))
    ).toHaveLength(VERIFICATION_NOTE_MAX_LENGTH);
  });

  it("rejects non-text or overlong claim notes", () => {
    expect(() => parseVerificationNote(12)).toThrow(/must be text/);
    expect(() =>
      parseVerificationNote("x".repeat(VERIFICATION_NOTE_MAX_LENGTH + 1))
    ).toThrow(/2000 characters/);
  });

  it("allows only approved/rejected decisions and bounded review notes", () => {
    expect(
      parseReviewPayload({ decision: "approved", note: "  Checked records. " })
    ).toEqual({
      decision: "approved",
      note: "Checked records.",
    });
    expect(parseReviewPayload({ decision: "rejected" })).toEqual({
      decision: "rejected",
      note: null,
    });
    expect(() => parseReviewPayload({ decision: "pending" })).toThrow(
      /Choose approve or reject/
    );
    expect(() =>
      parseReviewPayload({
        decision: "rejected",
        note: "x".repeat(VERIFICATION_NOTE_MAX_LENGTH + 1),
      })
    ).toThrow(/2000 characters/);
  });

  it("recognizes UUID request identifiers only", () => {
    expect(
      isVerificationRequestId("01234567-89ab-4cde-8fab-0123456789ab")
    ).toBe(true);
    expect(isVerificationRequestId("../other-request")).toBe(false);
  });
});
