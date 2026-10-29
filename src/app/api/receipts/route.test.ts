import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServerClient } = vi.hoisted(() => ({
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient }));

import { POST } from "@/app/api/receipts/route";

const validBody = {
  confirmedExternalSale: true,
  buyerName: "Optional Buyer",
  itemTitle: "Grade 10 Chemistry tutoring",
  itemDescription: "Three lessons",
  quantity: 3,
  unitPriceKes: 750,
};

function request(body: Record<string, unknown>) {
  return new Request("https://lexifyschool.example/api/receipts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("seller receipt creation API", () => {
  beforeEach(() => getSupabaseServerClient.mockReset());

  it("requires explicit seller confirmation of an off-platform completed sale", async () => {
    const response = await POST(
      request({ ...validBody, confirmedExternalSale: false })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining(
        "completed directly outside Lexify School"
      ),
    });
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("maps database rejection of a non-seller or inactive account to 403", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "42501" },
      }),
    };
    getSupabaseServerClient.mockResolvedValue(client);

    const response = await POST(request(validBody));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("active teacher or administrator"),
    });
    expect(client.rpc).toHaveBeenCalledWith("create_seller_receipt", {
      p_confirm_external_sale: true,
      p_buyer_name: "Optional Buyer",
      p_item_title: "Grade 10 Chemistry tutoring",
      p_item_description: "Three lessons",
      p_quantity: 3,
      p_unit_price_kes: 750,
    });
  });

  it("returns the seller's PDF link after the authorized receipt RPC succeeds", async () => {
    const receiptId = "50000000-0000-4000-8000-000000000003";
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ id: receiptId, receipt_number: "LX-20261029-ABC12345" }],
        error: null,
      }),
    };
    getSupabaseServerClient.mockResolvedValue(client);

    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      receiptId,
      receiptNumber: "LX-20261029-ABC12345",
      pdfUrl: `/api/receipts/${receiptId}/pdf`,
    });
  });
});
