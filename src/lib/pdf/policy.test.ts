import { describe, expect, it } from "vitest";
import {
  hasLearningReportContent,
  isUsableIssuedCertificate,
  resolveRequestedStudentId,
} from "./policy";

describe("protected learning document policy", () => {
  it("lets students request only their own report subject", () => {
    expect(
      resolveRequestedStudentId({ id: "student-a", role: "student" })
    ).toBe("student-a");
    expect(
      resolveRequestedStudentId(
        { id: "student-a", role: "student" },
        "student-a"
      )
    ).toBe("student-a");
    expect(
      resolveRequestedStudentId(
        { id: "student-a", role: "student" },
        "student-b"
      )
    ).toBeNull();
  });

  it("requires parents to request a specific learner for link verification", () => {
    expect(
      resolveRequestedStudentId({ id: "parent-a", role: "parent" })
    ).toBeNull();
    expect(
      resolveRequestedStudentId({ id: "parent-a", role: "parent" }, "student-a")
    ).toBe("student-a");
    expect(
      resolveRequestedStudentId(
        { id: "teacher-a", role: "teacher" },
        "student-a"
      )
    ).toBeNull();
  });

  it("does not render a report with no recorded learning data", () => {
    expect(
      hasLearningReportContent({
        enrolments: 0,
        scores: 0,
        attendance: 0,
        curriculumSelections: 0,
      })
    ).toBe(false);
    expect(
      hasLearningReportContent({
        enrolments: 0,
        scores: 1,
        attendance: 0,
        curriculumSelections: 0,
      })
    ).toBe(true);
  });

  it("accepts only complete, non-revoked stored certificate records", () => {
    expect(
      isUsableIssuedCertificate({
        certificate_code: "LX-123",
        issued_at: "2026-01-15T10:00:00.000Z",
        revoked_at: null,
      })
    ).toBe(true);
    expect(
      isUsableIssuedCertificate({
        certificate_code: "LX-123",
        issued_at: "2026-01-15T10:00:00.000Z",
        revoked_at: "2026-02-01T00:00:00.000Z",
      })
    ).toBe(false);
    expect(
      isUsableIssuedCertificate({
        certificate_code: "",
        issued_at: "2026-01-15",
      })
    ).toBe(false);
  });
});
