import { describe, expect, it } from "vitest";
import {
  validateEightFourFourSelection,
  validateJuniorSelection,
  validateSeniorSelection,
  type CurriculumSubject,
} from "./rules";

const juniorCatalog: CurriculumSubject[] = [
  { id: "english", name: "English", curriculumArea: "english" },
  { id: "kiswahili", name: "Kiswahili", curriculumArea: "language" },
  { id: "ksl", name: "Kenya Sign Language", curriculumArea: "language", isKenyaSignLanguage: true },
  { id: "math", name: "Mathematics", curriculumArea: "mathematics" },
  { id: "science", name: "Integrated Science", curriculumArea: "integrated-science" },
  { id: "social", name: "Social Studies", curriculumArea: "social-studies" },
  { id: "cre", name: "Christian Religious Education", curriculumArea: "religious-education", isReligiousEducation: true },
  { id: "ire", name: "Islamic Religious Education", curriculumArea: "religious-education", isReligiousEducation: true },
  { id: "hre", name: "Hindu Religious Education", curriculumArea: "religious-education", isReligiousEducation: true },
  { id: "agriculture", name: "Agriculture", curriculumArea: "agriculture" },
  { id: "pretech", name: "Pre-Technical Studies", curriculumArea: "pre-technical-studies" },
  { id: "creative", name: "Creative Arts and Sports", curriculumArea: "creative-arts-and-sports" },
  { id: "french", name: "French", curriculumArea: "french" },
];

const seniorCatalog: CurriculumSubject[] = [
  { id: "s-english", name: "English", curriculumArea: "english", isCore: true },
  { id: "s-kiswahili", name: "Kiswahili", curriculumArea: "language", isCore: true },
  { id: "s-ksl", name: "Kenya Sign Language", curriculumArea: "language", isKenyaSignLanguage: true, requiresDeafLearner: true, isCore: true },
  { id: "csl", name: "Community Service Learning", curriculumArea: "community-service-learning", isCore: true },
  { id: "core-math", name: "Core Mathematics", curriculumArea: "mathematics", isCore: true },
  { id: "essential-math", name: "Essential Mathematics", curriculumArea: "mathematics", isCore: true },
  { id: "biology", name: "Biology", pathway: "STEM" },
  { id: "chemistry", name: "Chemistry", pathway: "STEM" },
  { id: "physics", name: "Physics", pathway: "STEM" },
  { id: "general-science", name: "General Science", pathway: "STEM" },
  { id: "agriculture", name: "Agriculture", pathway: "STEM" },
  { id: "computer-studies", name: "Computer Studies", pathway: "STEM" },
  { id: "business", name: "Business Studies", pathway: "Social Sciences" },
  { id: "cre-senior", name: "Christian Religious Education", pathway: "Social Sciences", isReligiousEducation: true },
  { id: "ire-senior", name: "Islamic Religious Education", pathway: "Social Sciences", isReligiousEducation: true },
  { id: "geography", name: "Geography", pathway: "Social Sciences" },
];

const seniorBase = ["s-english", "s-kiswahili", "csl", "core-math"] as const;
const stemInput = (electives: string[], extra: Partial<Parameters<typeof validateSeniorSelection>[0]> = {}) => ({
  grade: 10,
  catalog: seniorCatalog,
  selected: [...seniorBase, ...electives],
  pathway: "STEM",
  track: "Pure Sciences",
  ...extra,
});

const kcseCatalog: CurriculumSubject[] = [
  { id: "eng", name: "English" },
  { id: "swa", name: "Kiswahili" },
  { id: "math", name: "Mathematics" },
  { id: "bio", name: "Biology" },
  { id: "chem", name: "Chemistry" },
  { id: "physics", name: "Physics" },
  { id: "geo", name: "Geography" },
  { id: "history", name: "History and Government" },
  { id: "french", name: "French" },
  { id: "agri", name: "Agriculture" },
  { id: "computer", name: "Computer Studies" },
];

describe("Junior School CBE rules", () => {
  it("returns the nine rationalised Grade 8 areas with one RE and one language choice", () => {
    const result = validateJuniorSelection({
      grade: 8,
      catalog: juniorCatalog,
      selected: ["english", "kiswahili", "math", "science", "social", "cre", "agriculture", "pretech", "creative", "french"],
      isDeafLearner: false,
    });

    expect(result.valid).toBe(true);
    expect(result.coreSubjects).toHaveLength(9);
    expect(result.subjectIds.slice(0, 9)).toEqual([
      "english", "kiswahili", "math", "science", "social", "cre", "agriculture", "pretech", "creative",
    ]);
    expect(result.optionalTutoringSubjects.map((subject) => subject.id)).toEqual(["french"]);
    expect(result.subjectIds).toHaveLength(10); // tutoring is separate from the nine core areas
  });
});

describe("Senior School CBE rules", () => {
  it("auto-includes four core subjects and accepts three STEM electives (seven total)", () => {
    const result = validateSeniorSelection(stemInput(["biology", "chemistry", "agriculture"]));
    expect(result.valid).toBe(true);
    expect(result.coreSubjects).toHaveLength(4);
    expect(result.electives).toHaveLength(3);
    expect(result.subjects).toHaveLength(7);
    expect(result.subjectIds).toContain("core-math");
  });

  it.each([
    ["General Science with Biology", ["general-science", "biology", "agriculture"], "overlapping-electives"],
    ["two Religious Education options", ["cre-senior", "ire-senior", "geography"], "multiple-religious-education"],
    ["STEM with Business Studies", ["biology", "chemistry", "business"], "stem-business-studies"],
  ])("rejects %s", (_label, electives, code) => {
    const result = validateSeniorSelection(stemInput(electives as string[]));
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain(code);
  });

  it("rejects Kenya Sign Language for a learner who is not deaf", () => {
    const result = validateSeniorSelection({
      ...stemInput(["biology", "chemistry", "agriculture"]),
      selected: ["s-english", "s-ksl", "csl", "core-math", "biology", "chemistry", "agriculture"],
      isDeafLearner: false,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("ksl-requires-deaf-learner");
  });
});

describe("8-4-4 KCSE rules", () => {
  it("enforces Form 4 minimum, maximum, required Group I, and group minima", () => {
    const tooFew = validateEightFourFourSelection({
      form: 4,
      catalog: kcseCatalog,
      selected: ["eng", "swa", "math", "bio", "geo", "french"],
    });
    expect(tooFew.errors.map((error) => error.code)).toContain("minimum-subject-count");
    expect(tooFew.errors.map((error) => error.code)).toContain("kcse-group-minimum");

    const missingGroupI = validateEightFourFourSelection({
      form: 4,
      catalog: kcseCatalog,
      selected: ["eng", "swa", "bio", "chem", "geo", "french", "agri"],
    });
    expect(missingGroupI.errors.map((error) => error.code)).toContain("required-group-i-subject");

    const tooMany = validateEightFourFourSelection({
      form: 4,
      catalog: kcseCatalog,
      selected: ["eng", "swa", "math", "bio", "chem", "physics", "geo", "history", "french", "agri"],
    });
    expect(tooMany.errors.map((error) => error.code)).toContain("maximum-subject-count");
  });

  it("accepts a valid 8-4-4 selection with all Group I subjects and group minima", () => {
    const result = validateEightFourFourSelection({
      form: 4,
      catalog: kcseCatalog,
      selected: ["eng", "swa", "math", "bio", "chem", "geo", "french"],
    });
    expect(result.valid).toBe(true);
    expect(result.subjects).toHaveLength(7);
    expect(result.groupCounts.II).toBe(2);
    expect(result.groupCounts.III).toBe(1);
    expect(result.groupCounts.V).toBe(1);
  });
});
