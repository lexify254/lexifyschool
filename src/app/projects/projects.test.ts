import { describe, expect, it } from "vitest";
import {
  buildProjectInquiryMessage,
  filterAndSortProjects,
  getProjectPriceKes,
  normalizeProjectFilters,
  type ProjectRow,
} from "@/lib/data/projects";

const today = new Date("2026-10-28T12:00:00.000Z");
const projects: ProjectRow[] = [
  {
    code: "WORD-GUIDE",
    title: "Word Study Guide",
    short_description: "A beginner-friendly document template.",
    software_name: "Microsoft Word",
    software_version: "365",
    file_types: [".docx", ".pdf"],
    difficulty: "beginner",
    price_kes: 500,
    sale_price_kes: 350,
    sale_starts_at: "2026-10-01T00:00:00.000Z",
    sale_ends_at: "2026-11-01T00:00:00.000Z",
    is_free: false,
    featured: true,
  },
  {
    code: "FREE-SHEETS",
    title: "Spreadsheet Basics",
    description: "Practice worksheets for Excel.",
    software_name: "Excel",
    file_types: [".xlsx"],
    difficulty: "beginner",
    price_kes: 0,
    is_free: true,
  },
  {
    code: "DESIGN-ADV",
    title: "Advanced Design Project",
    description: "Presentation and graphics files.",
    software_name: "PowerPoint",
    difficulty: "advanced",
    price_kes: 900,
    sale_price_kes: null,
    is_free: false,
  },
];

const emptyFilters = normalizeProjectFilters({});

describe("Projects Store browse helpers", () => {
  it("bounds query parameters and accepts supported filters and sort options", () => {
    expect(
      normalizeProjectFilters({
        q: "  spreadsheet  ",
        software: " Excel ",
        difficulty: "beginner",
        maxPrice: "0",
        free: "on",
        sort: "price-asc",
      })
    ).toEqual({
      q: "spreadsheet",
      software: "Excel",
      difficulty: "beginner",
      maxPrice: 0,
      freeOnly: true,
      sort: "price-asc",
    });
    expect(
      normalizeProjectFilters({
        q: "x".repeat(100),
        maxPrice: "-1",
        sort: "other",
      })
    ).toMatchObject({
      q: "x".repeat(80),
      maxPrice: undefined,
      sort: "featured",
    });
  });

  it("searches titles, descriptions, software and file types and applies all filters", () => {
    expect(
      filterAndSortProjects(
        projects,
        { ...emptyFilters, q: "worksheets" },
        today
      )
    ).toEqual([projects[1]]);
    expect(
      filterAndSortProjects(projects, { ...emptyFilters, q: ".docx" }, today)
    ).toEqual([projects[0]]);
    expect(
      filterAndSortProjects(
        projects,
        {
          ...emptyFilters,
          software: "excel",
          difficulty: "beginner",
          freeOnly: true,
        },
        today
      )
    ).toEqual([projects[1]]);
    expect(
      filterAndSortProjects(projects, { ...emptyFilters, maxPrice: 400 }, today)
    ).toEqual(projects.slice(0, 2));
  });

  it("sorts by title and current listed price, including an active dated sale", () => {
    expect(
      filterAndSortProjects(
        projects,
        { ...emptyFilters, sort: "title" },
        today
      ).map(project => project.title)
    ).toEqual([
      "Advanced Design Project",
      "Spreadsheet Basics",
      "Word Study Guide",
    ]);
    expect(
      filterAndSortProjects(
        projects,
        { ...emptyFilters, sort: "price-asc" },
        today
      )
    ).toEqual([projects[1], projects[0], projects[2]]);
    expect(
      filterAndSortProjects(
        projects,
        { ...emptyFilters, sort: "price-desc" },
        today
      )
    ).toEqual([projects[2], projects[0], projects[1]]);
  });

  it("uses scheduled sale dates and never treats a missing sale as zero-price", () => {
    expect(getProjectPriceKes(projects[0], today)).toBe(350);
    expect(
      getProjectPriceKes(projects[0], new Date("2026-09-01T00:00:00Z"))
    ).toBe(500);
    expect(getProjectPriceKes(projects[2], today)).toBe(900);
    expect(
      getProjectPriceKes({ price_kes: 500, sale_price_kes: 300 }, today)
    ).toBe(500);
    expect(getProjectPriceKes(projects[1], today)).toBe(0);
  });

  it("builds an item-specific enquiry without claiming a sale or download", () => {
    const message = buildProjectInquiryMessage({
      code: "WORD-GUIDE",
      title: "Word Study Guide",
      listedPrice: "KES 350",
    });
    expect(message).toContain("Word Study Guide");
    expect(message).toContain("WORD-GUIDE");
    expect(message).toContain("KES 350");
    expect(message).toContain("does not confirm a sale");
    expect(message).toContain("download access");
  });
});
