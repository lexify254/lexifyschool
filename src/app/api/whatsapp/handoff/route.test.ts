import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServerClient } = vi.hoisted(() => ({
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient }));

import { GET } from "@/app/api/whatsapp/handoff/route";

const classId = "30000000-0000-4000-8000-000000000001";
const teacherId = "40000000-0000-4000-8000-000000000002";

function createClient(options?: {
  classRow?: Record<string, unknown> | null;
  teacherRow?: Record<string, unknown> | null;
  eligible?: boolean;
  eligibilityError?: unknown;
  recordData?: unknown;
  recordError?: unknown;
}) {
  const tables: string[] = [];
  const client = {
    from: vi.fn((table: string) => {
      tables.push(table);
      const data =
        table === "public_class_listings"
          ? (options?.classRow ?? {
              id: classId,
              title: "Grade 10 Chemistry",
              teacher_id: teacherId,
              is_active: true,
              is_published: true,
            })
          : (options?.teacherRow ?? {
              profile_id: teacherId,
              public_name: "Amina Teacher",
              public_whatsapp: "+254712345678",
              is_accepting_students: true,
            });
      const query: Record<string, any> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn(() => query);
      query.maybeSingle = vi.fn(async () => ({ data, error: null }));
      return query;
    }),
    rpc: vi.fn(async (name: string) =>
      name === "resolve_whatsapp_handoff"
        ? {
            data: [
              {
                eligible: options?.eligible ?? true,
                seller_id: teacherId,
              },
            ],
            error: options?.eligibilityError ?? null,
          }
        : {
            data: options?.recordData === undefined ? true : options.recordData,
            error: options?.recordError ?? null,
          }
    ),
  };
  return { client, tables };
}

function classHandoffRequest() {
  return new Request(
    `https://lexifyschool.example/api/whatsapp/handoff?kind=class&id=${classId}`
  );
}

describe("WhatsApp handoff route", () => {
  beforeEach(() => {
    getSupabaseServerClient.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves anonymous class handoffs through the public class view", async () => {
    const { client, tables } = createClient();
    getSupabaseServerClient.mockResolvedValue(client);

    const response = await GET(classHandoffRequest());

    expect(tables).toEqual(["public_class_listings", "teacher_details"]);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(
      /^https:\/\/wa\.me\/254712345678\?text=/
    );
    expect(client.rpc).toHaveBeenNthCalledWith(1, "resolve_whatsapp_handoff", {
      p_item_type: "class",
      p_item_id: classId,
    });
    expect(client.rpc).toHaveBeenNthCalledWith(2, "record_whatsapp_handoff", {
      p_item_type: "class",
      p_item_id: classId,
    });
  });

  it("does not redirect when the secure eligibility RPC rejects the seller", async () => {
    const { client } = createClient({ eligible: false });
    getSupabaseServerClient.mockResolvedValue(client);

    const response = await GET(classHandoffRequest());

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).toContain("no longer eligible");
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  it("preserves a valid seller handoff when only aggregate click logging fails", async () => {
    const { client } = createClient({
      recordData: null,
      recordError: { code: "08006" },
    });
    getSupabaseServerClient.mockResolvedValue(client);

    const response = await GET(classHandoffRequest());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(
      /^https:\/\/wa\.me\/254712345678\?text=/
    );
  });

  it("fails closed when the seller eligibility check cannot be verified", async () => {
    const { client } = createClient({
      eligibilityError: { code: "08006" },
    });
    getSupabaseServerClient.mockResolvedValue(client);

    const response = await GET(classHandoffRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });
});
