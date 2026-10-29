export const VERIFICATION_NOTE_MAX_LENGTH = 2000;

export type ReviewDecision = "approved" | "rejected";
export type ReviewPayload = {
  decision: ReviewDecision;
  note: string | null;
};

export class VerificationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerificationInputError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseVerificationNote(
  value: unknown,
  label = "Claim note"
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string")
    throw new VerificationInputError(`${label} must be text.`);
  const note = value.trim();
  if (note.length > VERIFICATION_NOTE_MAX_LENGTH) {
    throw new VerificationInputError(
      `${label} must be ${VERIFICATION_NOTE_MAX_LENGTH} characters or fewer.`
    );
  }
  return note || null;
}

export function parseReviewPayload(value: unknown): ReviewPayload {
  if (!isRecord(value))
    throw new VerificationInputError("Review details must be an object.");
  if (value.decision !== "approved" && value.decision !== "rejected") {
    throw new VerificationInputError("Choose approve or reject.");
  }
  return {
    decision: value.decision,
    note: parseVerificationNote(value.note, "Review note"),
  };
}

export function isVerificationRequestId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}
