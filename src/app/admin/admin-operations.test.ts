import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  isAdminUuid,
  parseCourseInput,
  parseLessonInput,
  parseModuleInput,
} from "@/lib/admin/operations";

describe("admin operations validation", () => {
  it("accepts a bounded course payload and normalizes its code", () => {
    expect(parseCourseInput({ code: " intro-1 ", title: "Getting started", description: " Basics ", icon_name: "BookOpen", accent_color: "#2563EB", level: "Beginner", duration_minutes: 45 })).toEqual({
      code: "INTRO-1", title: "Getting started", description: "Basics", icon_name: "BookOpen", accent_color: "#2563EB", level: "Beginner", duration_minutes: 45,
    });
  });

  it("rejects unsafe course codes, overlong names, and invalid durations", () => {
    expect(() => parseCourseInput({ code: "A!", title: "Course" })).toThrow(/Course code/);
    expect(() => parseCourseInput({ code: "BASIC", title: " ".repeat(1) })).toThrow(/Title is required/);
    expect(() => parseCourseInput({ code: "BASIC", title: "Course", duration_minutes: 0 })).toThrow(/whole number/);
  });

  it("only parses supported module titles and non-negative ordering", () => {
    expect(parseModuleInput({ title: " Unit 1 ", sort_order: 2 })).toEqual({ title: "Unit 1", description: null, sort_order: 2 });
    expect(() => parseModuleInput({ title: "Unit", sort_order: -1 })).toThrow(/whole number/);
  });

  it("validates lesson type, content objects, booleans, and size", () => {
    const lesson = parseLessonInput({ title: "Read this", lesson_type: "text", content: { body: "Hello" }, sort_order: 0, is_published: true });
    expect(lesson.is_published).toBe(true);
    expect(lesson.is_free_preview).toBe(false);
    expect(() => parseLessonInput({ title: "Bad", lesson_type: "unknown", content: {} })).toThrow(/supported lesson type/);
    expect(() => parseLessonInput({ title: "Bad", lesson_type: "text", content: [] })).toThrow(/JSON object/);
    expect(() => parseLessonInput({ title: "Bad", lesson_type: "text", content: { body: "x".repeat(1000001) } })).toThrow(/1 MB/);
    expect(() => parseLessonInput({ title: "Bad", lesson_type: "text", content: {}, is_published: "true" })).toThrow(/true or false/);
  });

  it("accepts UUIDs for record references but rejects arbitrary identifiers", () => {
    expect(isAdminUuid("01234567-89ab-4cde-8fab-0123456789ab")).toBe(true);
    expect(isAdminUuid("not-an-id")).toBe(false);
  });
});
