import { describe, expect, it } from "vitest";
import { parseTeacherProfileUpdate } from "./teacher-profile";

describe("teacher profile updates", () => {
  it("accepts editable public fields, optional listed pricing and Tuition", () => {
    expect(
      parseTeacherProfileUpdate({
        publicName: "  Teacher name  ",
        bio: "  Public biography  ",
        startingPrice: "1500",
        pricingBasis: "weekly",
        services: ["tuition"],
      })
    ).toEqual({
      value: {
        public_name: "Teacher name",
        bio: "Public biography",
        starting_price_kes: 1500,
        pricing_basis: "weekly",
        services: ["tuition"],
      },
      error: null,
    });
  });

  it("permits an unlisted price and no selected services", () => {
    expect(
      parseTeacherProfileUpdate({
        publicName: "",
        bio: "",
        startingPrice: "",
        pricingBasis: "",
        services: [],
      })
    ).toEqual({
      value: {
        public_name: null,
        bio: null,
        starting_price_kes: null,
        pricing_basis: null,
        services: [],
      },
      error: null,
    });
  });

  it("rejects unbounded price, missing basis and unsupported services", () => {
    expect(
      parseTeacherProfileUpdate({
        publicName: "Name",
        bio: "",
        startingPrice: "0",
        pricingBasis: "weekly",
        services: [],
      }).error
    ).toMatch(/Starting price/);
    expect(
      parseTeacherProfileUpdate({
        publicName: "Name",
        bio: "",
        startingPrice: "50",
        pricingBasis: "",
        services: [],
      }).error
    ).toMatch(/pricing basis/);
    expect(
      parseTeacherProfileUpdate({
        publicName: "Name",
        bio: "",
        startingPrice: "",
        pricingBasis: "",
        services: ["consulting"],
      }).error
    ).toMatch(/supported/);
  });
});
