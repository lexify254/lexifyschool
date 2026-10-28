import { describe, expect, it } from "vitest";
import { normalizeKenyanPhone, whatsappHref } from "./links";

describe("Kenyan contact numbers", () => {
  it.each([
    ["0712 345 678", "254712345678"],
    ["+254 712 345 678", "254712345678"],
    ["0112-345-678", "254112345678"],
    ["254112345678", "254112345678"],
  ])("normalizes %s to E.164 digits", (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "+1 415 555 0100", "254612345678"]) (
    "rejects unsupported number %s",
    (input) => {
      expect(normalizeKenyanPhone(input)).toBeNull();
    },
  );
});

describe("seller WhatsApp links", () => {
  it("encodes an item-specific inquiry and never prints a raw number", () => {
    const href = whatsappHref("0712345678", "Hello, I am interested in Mathematics & Science.");
    expect(href).toBe(
      "https://wa.me/254712345678?text=Hello%2C%20I%20am%20interested%20in%20Mathematics%20%26%20Science.",
    );
  });

  it("returns no link for missing or invalid seller contact details", () => {
    expect(whatsappHref(null, "Hello" )).toBeNull();
    expect(whatsappHref("12345", "Hello")).toBeNull();
  });
});
