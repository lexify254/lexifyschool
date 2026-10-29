import { describe, expect, it } from "vitest";
import {
  createSellerReceiptPdf,
  type SellerReceiptPdfInput,
} from "./seller-receipt";

const validReceipt: SellerReceiptPdfInput = {
  receiptNumber: "LX-SR-2026-001",
  sellerName: "Amina Seller",
  buyerName: "Jordan Buyer",
  itemTitle: "Mathematics tutoring session",
  itemDescription: "One-hour individual lesson",
  quantity: 1,
  unitPriceKes: 2500,
  totalKes: 2500,
  issuedAt: "2026-10-29T08:00:00.000Z",
  verificationUrl: "https://example.com/receipts/LX-SR-2026-001",
};

describe("seller receipt PDF", () => {
  it("generates a valid single-page PDF buffer", async () => {
    const pdf = await createSellerReceiptPdf(validReceipt);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1_000);
    // Count page objects without treating the /Pages tree node as a page.
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
  });

  it.each([
    "http://example.com/verify",
    "https://localhost/verify",
    "https://user:pass@example.com/verify",
    "not-a-url",
  ])(
    "rejects an invalid or non-public HTTPS QR URL (%s)",
    async verificationUrl => {
      await expect(
        createSellerReceiptPdf({ ...validReceipt, verificationUrl })
      ).rejects.toThrow(/public HTTPS URL/);
    }
  );

  it.each([
    { quantity: Number.NaN },
    { quantity: 0 },
    { quantity: 1.5 },
    { unitPriceKes: Number.POSITIVE_INFINITY },
    { totalKes: Number.MAX_SAFE_INTEGER + 1 },
    { totalKes: -1 },
    { totalKes: 2499.99 },
  ])("rejects unsafe numeric receipt fields (%o)", async override => {
    await expect(
      createSellerReceiptPdf({ ...validReceipt, ...override })
    ).rejects.toThrow();
  });
});
