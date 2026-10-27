export function normalizeKenyanPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  let normalized = digits;
  if (digits.startsWith("0") && digits.length === 10) normalized = `254${digits.slice(1)}`;
  else if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) normalized = `254${digits}`;
  if (normalized.length < 8 || normalized.length > 15) return null;
  return normalized;
}

export function whatsappHref(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const number = normalizeKenyanPhone(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message.slice(0, 500))}`;
}
