import { describe, expect, it, vi } from "vitest";
import type { CurrentProfile } from "@/lib/auth/guards";

vi.mock("server-only", () => ({}));

import {
  readGuestDashboard,
  readParentDashboard,
  readTeacherDashboard,
} from "./portal-data";

type AnyRow = Record<string, any>;
type QueryTrace = {
  table: string;
  select: string;
  filters: { method: string; field: string; value: unknown }[];
};

function mockSupabase(fixtures: Record<string, AnyRow[]>) {
  const trace: QueryTrace[] = [];
  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          const filters: QueryTrace["filters"] = [];
          const query: any = {
            eq(field: string, value: unknown) {
              filters.push({ method: "eq", field, value });
              return query;
            },
            not(field: string, operator: string, value: unknown) {
              filters.push({ method: `not:${operator}`, field, value });
              return query;
            },
            in(field: string, value: unknown[]) {
              filters.push({ method: "in", field, value });
              return query;
            },
            gte(field: string, value: unknown) {
              filters.push({ method: "gte", field, value });
              return query;
            },
            order() {
              return query;
            },
            async limit(limit: number) {
              return {
                data: resolve(table, columns, filters, limit),
                error: null,
              };
            },
            async maybeSingle() {
              return {
                data: resolve(table, columns, filters, 2)[0] ?? null,
                error: null,
              };
            },
          };
          function resolve(
            tableName: string,
            select: string,
            queryFilters: QueryTrace["filters"],
            limit: number
          ) {
            trace.push({
              table: tableName,
              select,
              filters: [...queryFilters],
            });
            const filtered = (fixtures[tableName] ?? [])
              .filter(row =>
                queryFilters.every(({ method, field, value }) => {
                  if (method === "eq") return row[field] === value;
                  if (method === "not:is")
                    return value === null
                      ? row[field] != null
                      : row[field] !== value;
                  if (method === "in")
                    return (value as unknown[]).includes(row[field]);
                  if (method === "gte")
                    return String(row[field]) >= String(value);
                  return true;
                })
              )
              .slice(0, limit);
            const columns = select.split(",").map(column => column.trim());
            return filtered.map(row =>
              Object.fromEntries(
                columns
                  .filter(column => column in row)
                  .map(column => [column, row[column]])
              )
            );
          }
          return query;
        },
      };
    },
  };
  return { client: client as any, trace };
}

const parent: CurrentProfile = {
  id: "parent-1",
  full_name: "Guardian",
} as CurrentProfile;
const student: CurrentProfile = {
  id: "student-1",
  full_name: "Learner",
} as CurrentProfile;
const teacher: CurrentProfile = {
  id: "teacher-1",
  full_name: "Tutor",
} as CurrentProfile;

describe("portal dashboard data scope", () => {
  it("shows only confirmed learners and their active-class teacher contacts", async () => {
    const { client, trace } = mockSupabase({
      parent_student_links: [
        {
          parent_id: parent.id,
          student_id: "child-confirmed",
          relationship: "Child",
          confirmed_at: "2026-01-01",
        },
        {
          parent_id: parent.id,
          student_id: "child-pending",
          relationship: "Child",
          confirmed_at: null,
        },
        {
          student_id: "other-parent-child",
          relationship: "Child",
          confirmed_at: "2026-01-01",
          parent_id: "other-parent",
        },
      ],
      profiles: [
        { id: "child-confirmed", full_name: "Confirmed Learner" },
        { id: "child-pending", full_name: "Pending Learner" },
      ],
      enrolments: [
        {
          id: "e1",
          class_id: "class-1",
          student_id: "child-confirmed",
          status: "active",
          lessons_remaining: 2,
        },
        {
          id: "e2",
          class_id: "class-2",
          student_id: "child-pending",
          status: "active",
          lessons_remaining: 4,
        },
      ],
      classes: [
        {
          id: "class-1",
          title: "Reading",
          teacher_id: "teacher-2",
          learning_area_id: "area-1",
          schedule: {},
        },
        {
          id: "class-2",
          title: "Science",
          teacher_id: "teacher-3",
          learning_area_id: "area-2",
          schedule: {},
        },
      ],
      teacher_details: [
        {
          profile_id: "teacher-2",
          public_name: "A. Tutor",
          public_whatsapp: "0712345678",
        },
        {
          profile_id: "teacher-3",
          public_name: "B. Tutor",
          public_whatsapp: "0798765432",
        },
      ],
    });

    const data = await readParentDashboard(client, parent);
    expect(data.children.map(child => child.id)).toEqual(["child-confirmed"]);
    expect(data.children[0].classes).toEqual(["Reading"]);
    expect(data.teachers).toHaveLength(1);
    expect(data.teachers?.[0]).toMatchObject({
      title: "A. Tutor",
      detail: "Reading",
      meta: "Contact via WhatsApp",
    });
    expect(data.teachers?.[0].href).toMatch(
      /^https:\/\/wa\.me\/254712345678\?/
    );
    expect(data.teachers?.[0].href).not.toContain("0712345678");
    const linksRead = trace.find(
      query => query.table === "parent_student_links"
    );
    expect(linksRead?.filters).toContainEqual({
      method: "eq",
      field: "parent_id",
      value: parent.id,
    });
    expect(linksRead?.filters).toContainEqual({
      method: "not:is",
      field: "confirmed_at",
      value: null,
    });
    expect(
      trace.some(query =>
        ["payments", "receipts", "payout_requests", "ledger_entries"].includes(
          query.table
        )
      )
    ).toBe(false);
  });

  it("loads teacher dashboard records only from classes owned by the signed-in teacher", async () => {
    const { client, trace } = mockSupabase({
      classes: [
        {
          id: "owned-class",
          title: "My class",
          teacher_id: teacher.id,
          learning_area_id: "area-1",
          grade_id: "grade-1",
          is_active: true,
          schedule: {},
        },
        {
          id: "other-class",
          title: "Other class",
          teacher_id: "teacher-else",
          learning_area_id: "area-2",
          grade_id: "grade-2",
          is_active: true,
          schedule: {},
        },
      ],
      enrolments: [
        {
          id: "enrol-1",
          class_id: "owned-class",
          student_id: "student-2",
          status: "active",
        },
      ],
      lessons: [],
      profiles: [],
      learning_areas: [],
      grades: [],
    });

    const data = await readTeacherDashboard(client, teacher);
    expect(data.programs.map(record => record.title)).toEqual(["My class"]);
    expect(
      trace.find(query => query.table === "classes")?.filters
    ).toContainEqual({ method: "eq", field: "teacher_id", value: teacher.id });
    expect(
      trace.some(query =>
        [
          "ledger_entries",
          "payout_requests",
          "payment_requests",
          "payments",
          "receipts",
        ].includes(query.table)
      )
    ).toBe(false);
  });

  it("summarizes only the signed-in guest learner's completed course lessons", async () => {
    const { client, trace } = mockSupabase({
      course_enrolments: [
        {
          id: "course-enrol",
          course_id: "course-1",
          student_id: student.id,
          status: "active",
          expires_at: null,
        },
      ],
      courses: [{ id: "course-1", title: "Foundations" }],
      course_modules: [{ id: "module-1", course_id: "course-1" }],
      course_lessons: [
        { id: "lesson-1", module_id: "module-1" },
        { id: "lesson-2", module_id: "module-1" },
      ],
      lesson_progress: [
        {
          lesson_id: "lesson-1",
          student_id: student.id,
          completed_at: "2026-01-01",
        },
        {
          lesson_id: "lesson-2",
          student_id: "another-learner",
          completed_at: "2026-01-02",
        },
      ],
    });

    const data = await readGuestDashboard(client, student);
    expect(data.programs).toHaveLength(1);
    expect(data.programs[0]).toMatchObject({
      title: "Foundations",
      detail: "active · 1 of 2 lessons completed",
      href: "/guest/courses",
    });
    expect(
      trace.find(query => query.table === "course_enrolments")?.filters
    ).toContainEqual({ method: "eq", field: "student_id", value: student.id });
    expect(
      trace.find(query => query.table === "lesson_progress")?.filters
    ).toContainEqual({ method: "eq", field: "student_id", value: student.id });
    expect(
      trace.some(query => ["payments", "receipts"].includes(query.table))
    ).toBe(false);
  });
});
