import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServerClient } = vi.hoisted(() => ({
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient }));

import ReceiptVerificationPage from "@/app/receipts/verify/[token]/page";

const token = "60000000-0000-4000-8000-000000000004";

describe("public seller receipt verification page", () => {
  beforeEach(() => getSupabaseServerClient.mockReset());

  it("shows the minimal seller-reported summary and never renders buyer details", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            receipt_number: "LX-20261029-ABC12345",
            seller_name: "Amina Teacher",
            item_title: "Grade 10 Chemistry tutoring",
            total_kes: 2250,
            issued_at: "2026-10-29T12:00:00.000Z",
            buyer_name: "Private Buyer Name",
            buyer_phone: "+254700000000",
          },
        ],
        error: null,
      }),
    };
    getSupabaseServerClient.mockResolvedValue(client);

    const page = await ReceiptVerificationPage({
      params: Promise.resolve({ token }),
    });
    const html = renderToStaticMarkup(page);

    expect(client.rpc).toHaveBeenCalledWith("verify_seller_receipt", {
      p_token: token,
    });
    expect(html).toContain("Seller receipt record found");
    expect(html).toContain("LX-20261029-ABC12345");
    expect(html).toContain("Amina Teacher");
    expect(html).toContain("Grade 10 Chemistry tutoring");
    expect(html).toContain("Ksh");
    expect(html).toContain("2,250.00");
    expect(html).toContain(
      "Lexify did not process or independently verify a payment"
    );
    expect(html).not.toContain("Private Buyer Name");
    expect(html).not.toContain("+254700000000");
  });
});
