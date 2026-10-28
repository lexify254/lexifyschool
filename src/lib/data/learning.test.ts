import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { supportsLearningSection } from "./learning";

describe("role-aware learning section availability", () => {
  it("enables learning and assessment sections for students", () => {
    for (const section of [
      "lessons",
      "calendar",
      "homework",
      "quizzes",
      "questions",
      "resources",
      "payments",
    ]) {
      expect(supportsLearningSection("student", section)).toBe(true);
    }
    expect(supportsLearningSection("student", "materials")).toBe(false);
  });

  it("limits teacher actions to their teaching sections", () => {
    for (const section of [
      "classes",
      "students",
      "materials",
      "questions",
      "lessons",
      "calendar",
    ]) {
      expect(supportsLearningSection("teacher", section)).toBe(true);
    }
    expect(supportsLearningSection("teacher", "homework")).toBe(true);
  });

  it("exposes linked learner reports to parents and only seller inquiries to guests", () => {
    expect(supportsLearningSection("parent", "reports")).toBe(true);
    expect(supportsLearningSection("parent", "children")).toBe(true);
    expect(supportsLearningSection("guest", "payments")).toBe(true);
    expect(supportsLearningSection("guest", "lessons")).toBe(false);
  });
});
