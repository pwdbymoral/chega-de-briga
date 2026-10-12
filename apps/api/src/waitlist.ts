export const waitlistConsentVersion = "lista-espera-2026-10";

export function normalizeWaitlistContact(channel: unknown, raw: string) {
  if (channel === "email") {
    const contact = raw.trim().toLocaleLowerCase("en-US");
    return contact.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : null;
  }
  if (channel === "whatsapp") {
    const explicitCountryCode = /^\s*(?:\+|00)/.test(raw);
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (!explicitCountryCode && (digits.length === 10 || digits.length === 11)) digits = `55${digits}`;
    return digits.length >= 10 && digits.length <= 15 && !digits.startsWith("0") ? `+${digits}` : null;
  }
  return null;
}

export function campaignTag(value: unknown) {
  if (typeof value !== "string") return null;
  const tag = value.trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(tag) ? tag : null;
}
