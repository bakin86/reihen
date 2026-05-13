export function normalizePhoneForAuth(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("976")) return digits.slice(3);
  if (digits.length === 12 && digits.startsWith("0976")) return digits.slice(4);
  if (digits.length === 9 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function normalizeIdentifier(raw: string): { value: string; isEmail: boolean } {
  const value = raw.trim();
  const isEmail = value.includes("@");
  return {
    value: isEmail ? value.toLowerCase() : normalizePhoneForAuth(value),
    isEmail,
  };
}
