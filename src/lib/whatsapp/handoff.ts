export const whatsappHandoffKinds = [
  "teacher_profile",
  "class",
  "course",
  "product",
] as const;

export type WhatsAppHandoffKind = (typeof whatsappHandoffKinds)[number];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isWhatsAppHandoffItemId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isWhatsAppHandoffKind(
  value: unknown
): value is WhatsAppHandoffKind {
  return (
    typeof value === "string" &&
    whatsappHandoffKinds.includes(value as WhatsAppHandoffKind)
  );
}

export function buildWhatsAppHandoffHref(
  kind: unknown,
  itemId: unknown
): string | null {
  if (!isWhatsAppHandoffKind(kind) || !isWhatsAppHandoffItemId(itemId)) {
    return null;
  }

  return `/api/whatsapp/handoff?kind=${kind}&id=${encodeURIComponent(itemId)}`;
}
