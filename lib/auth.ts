import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isDynamicUsageError } from "next/dist/export/helpers/is-dynamic-usage-error";
import { prisma } from "./prisma";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-me-min-32-chars!!"
);
const ISSUER = process.env.JWT_ISSUER ?? "reihen";
const AUDIENCE = process.env.JWT_AUDIENCE ?? "reihen-users";
const ACCESS_EXPIRES = "15m";       // short-lived access token
const REFRESH_EXPIRES = "7d";       // long-lived refresh token
const REFRESH_DAYS = 7;

// Account lockout settings
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const BCRYPT_SALT_ROUNDS = 12;

export type Role = "PLAYER" | "STAFF" | "OWNER" | "ADMIN";

export interface SessionPayload extends JWTPayload {
  sub: string;
  role: Role;
  email: string;
}

// ─── Password ────────────────────────────────────────────
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// ─── JWT ─────────────────────────────────────────────────
export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(ACCESS_EXPIRES)
    .sign(SECRET);
}

/**
 * Create a refresh token: random opaque string, stored as SHA-256 hash in DB.
 * Returns the raw token to send to client.
 */
export async function createRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(48).toString("base64url");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 3600_000);

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  // Cleanup: delete expired tokens for this user (housekeeping)
  await prisma.refreshToken.deleteMany({
    where: { userId, expiresAt: { lt: new Date() } },
  }).catch(() => {});

  return raw;
}

/**
 * Verify a refresh token: hash it and look up in DB.
 * Deletes the used token (rotation: one-time use).
 */
export async function verifyRefreshToken(raw: string): Promise<{ userId: string }> {
  const tokenHash = createHash("sha256").update(raw).digest("hex");

  const found = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!found) throw new Error("Invalid refresh token");
  if (found.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: found.id } }).catch(() => {});
    throw new Error("Refresh token expired");
  }

  // Delete used token (rotation — each refresh token is single-use)
  await prisma.refreshToken.delete({ where: { id: found.id } }).catch(() => {});

  return { userId: found.userId };
}

/** Revoke all refresh tokens for a user (used on logout, password change) */
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export async function verifyToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  return payload as SessionPayload;
}

// ─── Account lockout ────────────────────────────────────
export async function recordFailedLogin(userId: string): Promise<void> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  });
  if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) },
    });
  }
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

export function isAccountLocked(user: { lockedUntil: Date | null }): boolean {
  return !!user.lockedUntil && user.lockedUntil > new Date();
}

// ─── Cookie helpers ──────────────────────────────────────
const IS_PROD = process.env.NODE_ENV === "production";
export const ACCESS_COOKIE = "reihen_access";
export const REFRESH_COOKIE = "reihen_refresh";
export const CSRF_COOKIE = "reihen_csrf";      // readable by JS for CSRF header
export const CSRF_HEADER = "x-csrf-token";

export function setAuthCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string,
  csrfToken: string
): NextResponse {
  // Access token: httpOnly, not readable by JS
  res.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60, // 15 min
  });
  // Refresh token: httpOnly, only sent to auth endpoints
  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 3600, // 7 days
  });
  // CSRF token: readable by JS, must be sent back as header on mutations
  res.cookies.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false, // JS needs to read this
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });
  return res;
}

export function clearAuthCookies(res: NextResponse): NextResponse {
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
  res.cookies.delete(CSRF_COOKIE);
  return res;
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

// ─── Request helpers ─────────────────────────────────────
/**
 * Extract access token from httpOnly cookie (preferred) or Authorization header (fallback).
 * Supports both cookie-based auth (browser) and Bearer token (API/mobile).
 */
export function extractBearer(req: Request | NextRequest): string | null {
  // 1. Try httpOnly cookie first
  if ("cookies" in req && typeof (req as NextRequest).cookies?.get === "function") {
    const cookie = (req as NextRequest).cookies.get(ACCESS_COOKIE);
    if (cookie?.value) return cookie.value;
  }

  // 2. Fallback to Authorization header (mobile apps, API clients)
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function getSession(
  req: Request | NextRequest
): Promise<SessionPayload> {
  const token = extractBearer(req);
  if (!token) throw new AuthError("Missing Authorization header", 401);
  try {
    return await verifyToken(token);
  } catch {
    throw new AuthError("Invalid or expired token", 401);
  }
}

export async function getCurrentUser(req: Request | NextRequest) {
  const session = await getSession(req);
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      balance: true,
      noShowCount: true,
      avatarUrl: true,
      isActive: true,
      createdAt: true,
    },
  });
  if (!user || !user.isActive) throw new AuthError("User not found", 401);
  return user;
}

// ─── Role guards ─────────────────────────────────────────
export async function requireRole(
  req: Request | NextRequest,
  ...allowed: Role[]
): Promise<SessionPayload> {
  const session = await getSession(req);
  if (!allowed.includes(session.role)) {
    throw new AuthError("Forbidden", 403);
  }
  return session;
}

export const requirePlayer = (req: Request | NextRequest) =>
  requireRole(req, "PLAYER", "STAFF", "ADMIN");
export const requireStaff = (req: Request | NextRequest) =>
  requireRole(req, "STAFF", "OWNER", "ADMIN");
export const requireOwner = (req: Request | NextRequest) =>
  requireRole(req, "OWNER", "ADMIN");
export const requireAdmin = (req: Request | NextRequest) =>
  requireRole(req, "ADMIN");

// ─── Error → Response helper ─────────────────────────────
export function authErrorResponse(e: unknown): NextResponse {
  if (isDynamicUsageError(e)) throw e;
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  // Never leak internal error details to client
  console.error("[auth] Unhandled error:", e);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
