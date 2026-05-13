"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AuthContext, type AuthUser } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_APP_URL ?? "";

/** Read a non-httpOnly cookie by name */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Helper: fetch with cookies + CSRF header */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> ?? {}),
  };

  // Attach CSRF token for mutations
  const method = (init?.method ?? "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = getCookie("reihen_csrf");
    if (csrf) headers["x-csrf-token"] = csrf;
  }

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers,
    credentials: "include", // send httpOnly cookies
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doRefreshRef = useRef<(() => Promise<void>) | null>(null);

  const clearTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const logout = useCallback(async () => {
    // Revoke refresh tokens + clear cookies server-side
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    setToken(null);
    setUser(null);
    clearTimer();
  }, [clearTimer]);

  const scheduleRefresh = useCallback(() => {
    clearTimer();
    refreshTimer.current = setTimeout(() => {
      doRefreshRef.current?.();
    }, 12 * 60 * 1000);
  }, [clearTimer]);

  // Refresh access token before it expires (every 12 min for a 15 min token)
  const doRefresh = useCallback(async () => {
    try {
      // Cookie-based: refresh token is sent automatically via httpOnly cookie
      const res = await api<{ token: string; refreshToken: string; csrfToken: string; user: AuthUser }>(
        "/api/auth/refresh",
        { method: "POST", body: JSON.stringify({}) }
      );
      // Token is in response body for WebSocket auth; cookies are set by the server
      setToken(res.token);
      setUser(res.user);
      scheduleRefresh();
    } catch {
      logout();
    }
  }, [logout, scheduleRefresh]);

  useEffect(() => {
    doRefreshRef.current = doRefresh;
  }, [doRefresh]);

  // Restore session on mount — check if httpOnly cookie is valid
  useEffect(() => {
    api<{ user: AuthUser }>("/api/auth/me")
      .then(({ user: u }) => {
        setUser(u);
        // We don't have the raw JWT in JS anymore (httpOnly), but keep token state
        // for WebSocket auth — will be refreshed on next doRefresh
        setToken("cookie-auth");
        scheduleRefresh();
      })
      .catch(() => {
        // Access cookie expired or missing — try refresh
        doRefresh().finally(() => setLoading(false));
        return;
      })
      .finally(() => setLoading(false));

    return clearTimer;
  }, [doRefresh, scheduleRefresh, clearTimer]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{
      token: string;
      refreshToken: string;
      csrfToken: string;
      user: AuthUser;
    }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    // Server sets httpOnly cookies; we keep token in state for WebSocket auth
    setToken(res.token);
    setUser(res.user);
    scheduleRefresh();
  }, [scheduleRefresh]);

  const register = useCallback(
    async (data: { name: string; email: string; password: string; phone: string; role?: "PLAYER" | "OWNER" }) => {
      const res = await api<{
        token: string;
        refreshToken: string;
        csrfToken: string;
        user: AuthUser;
      }>("/api/auth/register", { method: "POST", body: JSON.stringify(data) });
      setToken(res.token);
      setUser(res.user);
      scheduleRefresh();
    },
    [scheduleRefresh]
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
