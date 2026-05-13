import { decrypt } from "./crypto";
import { sanitizeString, validateCafeId } from "./sanitize";

const BASE = "https://api.icafecloud.com";

export interface IcafePcStatus {
  pcId: string;
  name: string;
  ip: string;
  enabled: boolean;
  connectTime: string | null;
  disconnectTime: string | null;
  /** Derived: true if PC has an active connection (in-use) */
  inUse: boolean;
}

/**
 * Fetch all PC statuses from an iCafeCloud cafe.
 * - cafeId is validated against injection/SSRF
 * - apiKey is decrypted from DB (stored encrypted)
 * - Response is sanitized before returning
 */
export async function fetchPcStatuses(
  encryptedApiKey: string,
  cafeId: string
): Promise<IcafePcStatus[]> {
  // SSRF protection: validate cafeId format
  const safeCafeId = validateCafeId(cafeId);
  if (!safeCafeId) throw new Error("Invalid cafeId format");

  const apiKey = decrypt(encryptedApiKey);

  const res = await fetch(`${BASE}/api/v2/cafe/${safeCafeId}/pcs`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(10_000), // 10s timeout — prevent hanging
  });

  if (!res.ok) {
    throw new Error(`iCafeCloud API error: ${res.status}`);
  }

  const data = await res.json();
  const pcs: any[] = Array.isArray(data?.data) ? data.data : [];

  // Sanitize all external data before returning
  return pcs.map((pc) => ({
    pcId: sanitizeString(pc.pc_icafe_id, 64),
    name: sanitizeString(pc.pc_name, 64),
    ip: sanitizeString(pc.pc_ip, 45),
    enabled: !!pc.pc_enabled,
    connectTime: pc.status_connect_time_local
      ? sanitizeString(pc.status_connect_time_local, 32)
      : null,
    disconnectTime: pc.status_disconnect_time_local
      ? sanitizeString(pc.status_disconnect_time_local, 32)
      : null,
    inUse: !!pc.status_connect_time_local && !pc.status_disconnect_time_local,
  }));
}
