"use client";

// Never use an absolute base URL for client-side fetches.
// Using a hardcoded domain breaks CORS on preview deployments because
// the page origin (e.g. reihen-bakin86s-projects.vercel.app) differs
// from the API origin (reihen.vercel.app). Relative paths always resolve
// to whatever origin served the page, which is what we want.
const BASE = "";

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/** Read the CSRF token from the reihen_csrf cookie */
function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)reihen_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiFetch<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, ...init } = opts;
  const bearerToken = token && token !== "cookie-auth" ? token : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Bearer token fallback for mobile/API — browser uses httpOnly cookies
    ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  // Attach CSRF token for mutation requests
  const method = (init.method ?? "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers["x-csrf-token"] = csrf;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: "include", // send httpOnly cookies
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error ?? "Request failed", res.status, json);
  return json as T;
}
