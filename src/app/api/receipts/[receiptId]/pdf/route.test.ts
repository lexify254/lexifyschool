import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServerClient, createSellerReceiptPdf, getPublicSiteOrigin } =
  vi.hoisted(() => ({
    getSupabaseServerClient: vi.fn(),
    createSellerReceiptPdf: vi.fn(),
    getPublicSiteOrigin: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient }));
vi.mock("@/lib/pdf/seller-receipt", () => ({ createSellerReceiptPdf }));
vi.mock("@/lib/site/public-origin", () => ({ getPublicSiteOrigin }));

import { GET } from "@/app/api/receipts/[receiptId]/pdf/route";

const receiptId = "50000000-0000-4000-8000-000000000003";
const token = "60000000-0000-4000-8000-000000000004";

function makeClient(row: Record<string, unknown> | null) {
  const query: Record<string, any> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  return { from: vi.fn(() => query) };
}

function callPdfRoute() {
  return GET(
    new Request(`https://lexifyschool.example/api/receipts/${receiptId}/pdf`),
    {
      params: Promise.resolve({ receiptId }),
    }
  );
}

describe("seller receipt PDF endpoint", () => {
  beforeEach(() => {
    getSupabaseServerClient.mockReset();
    createSellerReceiptPdf.mockReset();
    getPublicSiteOrigin
      .mockReset()
      .mockReturnValue("https://lexifyschool.example");
  });

  it("returns not found when row-level security hides a receipt from this session", async () => {
    const client = makeClient(null);
    getSupabaseServerClient.mockResolvedValue(client);

    const response = await callPdfRoute();

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Receipt not found.");
    expect(createSellerReceiptPdf).not.toHaveBeenCalled();
  });

  it("returns a private PDF download with the tokenized public verification URL", async () => {
    const client = makeClient({
      id: receiptId,
      receipt_number: "LX-20261029-ABC12345",
      public_token: token,
      seller_id: "40000000-0000-4000-8000-000000000002",
      seller_name: "Amina Teacher",
      buyer_name: null,
      item_title: "Grade 10 Chemistry tutoring",
      item_description: "Three lessons",
      quantity: 3,
      unit_price_kes: 750,
      total_kes: 2250,
      currency: "KES",
      created_at: "2026-10-29T12:00:00.000Z",
    });
    getSupabaseServerClient.mockResolvedValue(client);
    createSellerReceiptPdf.mockResolvedValue(Buffer.from("%PDF-test"));

    const response = await callPdfRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain(
      "lexify-receipt-LX-20261029-ABC12345.pdf"
    );
    expect(createSellerReceiptPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerName: "Amina Teacher",
        itemTitle: "Grade 10 Chemistry tutoring",
        totalKes: 2250,
        verificationUrl: `https://lexifyschool.example/receipts/verify/${token}`,
      })
    );
  });
});
