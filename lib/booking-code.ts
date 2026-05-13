import { prisma } from "./prisma";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion

/** Generate unique "#BK-XXXXXX" code (6 alphanumeric). ~900M combinations. */
export async function generateBookingCode(maxAttempts = 20): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    let chars = "";
    for (let j = 0; j < 6; j++) {
      chars += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
    const code = `#BK-${chars}`;
    const exists = await prisma.booking.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  // Extremely unlikely fallback — extend to 8 chars
  let chars = "";
  for (let j = 0; j < 8; j++) {
    chars += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return `#BK-${chars}`;
}

export function maskName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "***";
  if (trimmed.length <= 2) return trimmed[0] + "*";
  return trimmed[0] + "*".repeat(Math.min(trimmed.length - 2, 4)) + trimmed[trimmed.length - 1];
}
