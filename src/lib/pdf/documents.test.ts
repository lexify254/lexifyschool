import { describe, expect, it } from "vitest";
import { createCertificatePdf, createLearningReportPdf } from "./documents";

describe("learning document PDFs", () => {
  it("renders a report from actual learner record fields", async () => {
    const pdf = await createLearningReportPdf({
      learnerName: "Jordan Learner",
      generatedAt: "2026-10-28T10:00:00.000Z",
      curriculum: [{ title: "Mathematics", selectionType: "core" }],
      enrolments: [{ classTitle: "Algebra", status: "active" }],
      assessments: [
        {
          assessmentType: "Quiz",
          learningArea: "Mathematics",
          score: "8",
          maxScore: "10",
          percentage: "80",
          assessedOn: "2026-10-20",
        },
      ],
      attendance: [
        {
          status: "present",
          lessonTitle: "Linear equations",
          classTitle: "Algebra",
          startsAt: "2026-10-20T09:00:00.000Z",
        },
      ],
      attendanceCounts: { present: 1 },
      recordCounts: {
        enrolments: 1,
        scores: 1,
        attendance: 1,
        curriculumSelections: 1,
      },
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("renders only a stored certificate record's values", async () => {
    const pdf = await createCertificatePdf({
      learnerName: "Jordan Learner",
      courseTitle: "Computer Fundamentals",
      certificateCode: "LX-RECORDED-001",
      issuedAt: "2026-10-10T00:00:00.000Z",
      generatedAt: "2026-10-28T10:00:00.000Z",
      score: "92.5",
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });
});
