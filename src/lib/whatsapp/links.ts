export function normalizeKenyanPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  return null;
}

export function whatsappHref(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const number = normalizeKenyanPhone(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message.slice(0, 500))}`;
}
