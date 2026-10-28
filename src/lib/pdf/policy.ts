export type ReportActor = { id: string; role: string };

/** Resolve the requested learner subject without trusting caller-supplied IDs. */
export function resolveRequestedStudentId(
  actor: ReportActor,
  requestedStudentId?: string | null
): string | null {
  if (actor.role === "student") {
    return !requestedStudentId || requestedStudentId === actor.id
      ? actor.id
      : null;
  }
  if (actor.role === "parent") return requestedStudentId || null;
  return null;
}

export function hasLearningReportContent(input: {
  enrolments: number;
  scores: number;
  attendance: number;
  curriculumSelections: number;
}): boolean {
  return Object.values(input).some(
    count => Number.isFinite(count) && count > 0
  );
}

export function isUsableIssuedCertificate(
  record:
    | {
        certificate_code?: unknown;
        issued_at?: unknown;
        revoked_at?: unknown;
      }
    | null
    | undefined
): boolean {
  if (!record || record.revoked_at != null) return false;
  if (
    typeof record.certificate_code !== "string" ||
    !record.certificate_code.trim()
  )
    return false;
  if (typeof record.issued_at !== "string" || !record.issued_at.trim())
    return false;
  return !Number.isNaN(new Date(record.issued_at).valueOf());
}
