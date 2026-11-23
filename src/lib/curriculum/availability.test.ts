import { describe, expect, it } from "vitest";
import {
  currentCurriculumDate,
  curriculumAvailabilityLabel,
  curriculumAvailabilityStatus,
  isCurriculumAvailable,
} from "./availability";

describe("curriculum availability windows", () => {
  it("keeps the start and end dates inclusive", () => {
    const grade = { is_active: true, starts_on: "2027-01-01", ends_on: "2027-12-31" };

    expect(isCurriculumAvailable(grade, "2026-12-31")).toBe(false);
    expect(isCurriculumAvailable(grade, "2027-01-01")).toBe(true);
    expect(isCurriculumAvailable(grade, "2027-12-31")).toBe(true);
    expect(isCurriculumAvailable(grade, "2028-01-01")).toBe(false);
  });

  it("requires the administrative active flag even inside the date window", () => {
    expect(isCurriculumAvailable({ is_active: false }, "2026-11-21")).toBe(false);
    expect(isCurriculumAvailable({ is_active: true }, "2026-11-21")).toBe(true);
  });

  it("fails closed when a stored date or evaluation date is malformed", () => {
    expect(isCurriculumAvailable({ is_active: true, starts_on: "2027-02-30" }, "2027-03-01")).toBe(false);
    expect(curriculumAvailabilityStatus({ is_active: true }, "not-a-date")).toBe("invalid");
  });

  it("reports scheduled, ended, inactive and available states for admins", () => {
    expect(curriculumAvailabilityLabel({ is_active: true, starts_on: "2027-01-01" }, "2026-11-21")).toBe("Scheduled · starts 2027-01-01");
    expect(curriculumAvailabilityLabel({ is_active: true, ends_on: "2026-11-20" }, "2026-11-21")).toBe("Ended · ended 2026-11-20");
    expect(curriculumAvailabilityLabel({ is_active: false }, "2026-11-21")).toBe("Inactive");
    expect(curriculumAvailabilityLabel({ is_active: true }, "2026-11-21", false)).toBe("System unavailable");
    expect(curriculumAvailabilityLabel({ is_active: true }, "2026-11-21")).toBe("Available");
  });

  it("uses UTC calendar dates consistently", () => {
    expect(currentCurriculumDate(new Date("2026-11-21T10:59:14.000Z"))).toBe("2026-11-21");
  });
});
