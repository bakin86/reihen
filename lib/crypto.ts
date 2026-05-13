import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// Derives a 32-byte key from JWT_SECRET (reuse existing secret, no extra env var)
const PASSWORD = process.env.JWT_SECRET ?? "dev-secret-change-me";
const SALT = "reihen-aes-salt"; // static salt is fine — key uniqueness comes from PASSWORD
const KEY = scryptSync(PASSWORD, SALT, 32);
const ALGO = "aes-256-gcm";

/**
 * Encrypt a plaintext string. Returns "iv:authTag:ciphertext" (all hex).
 * Used for storing sensitive values like third-party API keys in the DB.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a value produced by encrypt(). Returns plaintext string.
 * Throws on tampered/invalid input.
 */
export function decrypt(encoded: string): string {
  const [ivHex, authTagHex, dataHex] = encoded.split(":");
  if (!ivHex || !authTagHex || !dataHex) throw new Error("Invalid encrypted format");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
