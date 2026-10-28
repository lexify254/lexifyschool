import { describe, expect, it } from "vitest";
import {
  isPublicTeacherId,
  normalizeTeacherFilters,
} from "@/lib/data/teacher-marketplace";

const validId = "8b9c2fb4-4e6c-4d02-8ac1-17d3c1f82a10";

describe("teacher marketplace filters", () => {
  it("keeps bounded public search input and valid supported filters", () => {
    expect(
      normalizeTeacherFilters({
        q: "  Amina_% (Tutor)  ",
        subjectId: validId,
        gradeId: validId,
        verified: true,
        maxPrice: 2500,
        pricingBasis: "weekly",
      })
    ).toEqual({
      q: "Amina    Tutor",
      subjectId: validId,
      gradeId: validId,
      verified: true,
      maxPrice: 2500,
      pricingBasis: "weekly",
    });
  });

  it("drops malformed identifiers, invalid prices, and unsupported pricing values", () => {
    expect(
      normalizeTeacherFilters({
        q: "   ",
        subjectId: "not-a-uuid",
        gradeId: "-".repeat(36),
        maxPrice: Number.POSITIVE_INFINITY,
        pricingBasis: "cash-on-delivery",
        verified: false,
      })
    ).toEqual({ verified: false });
  });

  it("accepts only UUID-shaped route identifiers", () => {
    expect(isPublicTeacherId(validId)).toBe(true);
    expect(isPublicTeacherId("------------------------------------")).toBe(
      false
    );
    expect(isPublicTeacherId("not-an-id")).toBe(false);
  });
});
