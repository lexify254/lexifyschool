export const TEACHER_PRICING_BASES = [
  "lesson_bundle",
  "weekly",
  "monthly",
] as const;
export type TeacherPricingBasis = (typeof TEACHER_PRICING_BASES)[number];
export type TeacherProfileUpdate = {
  public_name: string | null;
  bio: string | null;
  starting_price_kes: number | null;
  pricing_basis: TeacherPricingBasis | null;
  services: string[];
};
export type TeacherProfileParseResult =
  | { value: TeacherProfileUpdate; error: null }
  | { value: null; error: string };

export function parseTeacherProfileUpdate(
  input: unknown
): TeacherProfileParseResult {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return { value: null, error: "Profile details must be provided." };
  const body = input as Record<string, unknown>;
  if (
    typeof body.publicName !== "string" ||
    body.publicName.trim().length > 120
  )
    return {
      value: null,
      error: "Public name must be 120 characters or fewer.",
    };
  if (typeof body.bio !== "string" || body.bio.trim().length > 1600)
    return {
      value: null,
      error: "Biography must be 1,600 characters or fewer.",
    };
  const rawPrice = body.startingPrice;
  let price: number | null = null;
  if (rawPrice !== "" && rawPrice !== null && rawPrice !== undefined) {
    price = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
    if (!Number.isFinite(price) || price <= 0 || price > 10_000_000)
      return {
        value: null,
        error: "Starting price must be between 1 and 10,000,000 KES.",
      };
  }
  const rawBasis = body.pricingBasis;
  const basis =
    rawBasis === "" || rawBasis === null || rawBasis === undefined
      ? null
      : rawBasis;
  if (
    price !== null &&
    (typeof basis !== "string" ||
      !TEACHER_PRICING_BASES.includes(basis as TeacherPricingBasis))
  )
    return {
      value: null,
      error: "Choose a valid pricing basis for the starting price.",
    };
  if (price === null && basis !== null)
    return {
      value: null,
      error: "Clear the pricing basis when no starting price is listed.",
    };
  const services = body.services;
  if (
    !Array.isArray(services) ||
    services.some(service => service !== "tuition")
  )
    return {
      value: null,
      error: "Only currently supported teacher services can be selected.",
    };
  return {
    value: {
      public_name: body.publicName.trim() || null,
      bio: body.bio.trim() || null,
      starting_price_kes: price,
      pricing_basis: basis as TeacherPricingBasis | null,
      services: services.includes("tuition") ? ["tuition"] : [],
    },
    error: null,
  };
}
