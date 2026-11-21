export type CurriculumAvailabilityRecord = Record<string, unknown>;

export type CurriculumAvailabilityStatus = "available" | "inactive" | "scheduled" | "ended" | "invalid";

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function asDateOnly(value: Date | string): string | null {
  if (typeof value === "string") return isDateOnly(value) ? value : null;
  if (Number.isNaN(value.valueOf())) return null;
  return value.toISOString().slice(0, 10);
}

function windowDate(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !isDateOnly(value)) return undefined;
  return value;
}

export function currentCurriculumDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function curriculumAvailabilityStatus(
  record: CurriculumAvailabilityRecord,
  asOf: Date | string = new Date(),
): CurriculumAvailabilityStatus {
  const today = asDateOnly(asOf);
  const startsOn = windowDate(record.starts_on);
  const endsOn = windowDate(record.ends_on);
  if (!today || startsOn === undefined || endsOn === undefined) return "invalid";
  if (record.is_active !== true) return "inactive";
  if (startsOn && startsOn > today) return "scheduled";
  if (endsOn && endsOn < today) return "ended";
  return "available";
}

export function isCurriculumAvailable(
  record: CurriculumAvailabilityRecord,
  asOf: Date | string = new Date(),
): boolean {
  return curriculumAvailabilityStatus(record, asOf) === "available";
}

export function curriculumAvailabilityLabel(
  record: CurriculumAvailabilityRecord,
  asOf: Date | string = new Date(),
  parentAvailable = true,
): string {
  if (!parentAvailable) return "System unavailable";
  const status = curriculumAvailabilityStatus(record, asOf);
  if (status === "inactive") return "Inactive";
  if (status === "scheduled") return `Scheduled · starts ${String(record.starts_on)}`;
  if (status === "ended") return `Ended · ended ${String(record.ends_on)}`;
  if (status === "invalid") return "Review dates";
  return "Available";
}
