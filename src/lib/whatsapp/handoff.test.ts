import { describe, expect, it } from "vitest";
import { buildWhatsAppHandoffHref, isWhatsAppHandoffKind } from "./handoff";

describe("WhatsApp handoff route links", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";

  it("builds a same-origin handoff URL for a supported listing", () => {
    expect(buildWhatsAppHandoffHref("course", id)).toBe(
      `/api/whatsapp/handoff?kind=course&id=${id}`
    );
  });

  it("rejects unsupported types and malformed or injected IDs", () => {
    expect(buildWhatsAppHandoffHref("other", id)).toBeNull();
    expect(buildWhatsAppHandoffHref("product", "https://wa.me/123")).toBeNull();
    expect(buildWhatsAppHandoffHref("class", `${id}&kind=product`)).toBeNull();
    expect(buildWhatsAppHandoffHref("teacher_profile", null)).toBeNull();
  });

  it("recognizes only the four supported item types", () => {
    expect(isWhatsAppHandoffKind("teacher_profile")).toBe(true);
    expect(isWhatsAppHandoffKind("class")).toBe(true);
    expect(isWhatsAppHandoffKind("course")).toBe(true);
    expect(isWhatsAppHandoffKind("product")).toBe(true);
    expect(isWhatsAppHandoffKind("payments")).toBe(false);
  });
});
