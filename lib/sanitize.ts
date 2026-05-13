/**
 * Sanitize a string from external APIs before storing or rendering.
 * Strips HTML tags, control characters, and trims length.
 */
export function sanitizeString(input: unknown, maxLen = 255): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")           // strip HTML tags (XSS)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")  // strip control chars
    .trim()
    .slice(0, maxLen);
}

/**
 * Validate that a cafeId is a safe alphanumeric string.
 * Prevents path traversal and SSRF via crafted IDs.
 */
export function validateCafeId(cafeId: unknown): string | null {
  if (typeof cafeId !== "string") return null;
  // iCafeCloud cafeIds are numeric or alphanumeric, max 32 chars
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(cafeId)) return null;
  return cafeId;
}

/**
 * Validate an IP address (IPv4 or IPv6) for API key binding.
 */
export function isValidIp(ip: string): boolean {
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return ip.split(".").every((n) => Number(n) >= 0 && Number(n) <= 255);
  }
  // IPv6
  if (/^[0-9a-fA-F:]+$/.test(ip) && ip.includes(":")) return true;
  return false;
}
