"use client";
import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { useClerk, useUser as useClerkUser } from "@clerk/nextjs";
import { AuthContext, type AuthUser } from "@/lib/useAuth";

const API = "";
const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  const method = (init?.method ?? "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = getCookie("reihen_csrf");
    if (csrf) headers["x-csrf-token"] = csrf;
  }

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const clerkSessionRef = useRef(false);
  const clerkSignOutRef = useRef<(() => Promise<void>) | null>(null);

  const clearTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const loadCurrentUser = useCallback(async () => {
    const { user: current } = await api<{ user: AuthUser }>("/api/auth/me");
    setUser(current);
    setToken("cookie-auth");
    return current;
  }, []);

  const scheduleRefresh = useCallback(() => {
    clearTimer();
    if (clerkSessionRef.current) return;
    refreshTimer.current = setTimeout(() => {
      doRefreshRef.current?.();
    }, 12 * 60 * 1000);
  }, [clearTimer]);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    await clerkSignOutRef.current?.().catch(() => {});
    clerkSessionRef.current = false;
    setToken(null);
    setUser(null);
    clearTimer();
  }, [clearTimer]);

  const doRefresh = useCallback(async () => {
    try {
      const res = await api<{ token: string; refreshToken: string; csrfToken: string; user: AuthUser }>(
        "/api/auth/refresh",
        { method: "POST", body: JSON.stringify({}) }
      );
      clerkSessionRef.current = false;
      setToken(res.token);
      setUser(res.user);
      scheduleRefresh();
    } catch {
      if (clerkSessionRef.current) {
        setToken(null);
        setUser(null);
      } else {
        await logout();
      }
    }
  }, [logout, scheduleRefresh]);

  useEffect(() => {
    doRefreshRef.current = doRefresh;
  }, [doRefresh]);

  useEffect(() => {
    const refreshAuthState = () => {
      loadCurrentUser().catch(() => {
        setUser(null);
        setToken(null);
      });
    };
    window.addEventListener("reihen:auth-refresh", refreshAuthState);
    return () => window.removeEventListener("reihen:auth-refresh", refreshAuthState);
  }, [loadCurrentUser]);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      setLoading(true);
      let restoredLegacySession = false;
      try {
        await loadCurrentUser();
        restoredLegacySession = true;
        if (!cancelled) scheduleRefresh();
      } catch {
        if (!CLERK_ENABLED) {
          await doRefresh();
        } else if (!cancelled) {
          setUser(null);
          setToken(null);
        }
      } finally {
        // When Clerk is enabled, ClerkAuthSync owns the final loading state.
        // Setting loading=false here creates a race where protected owner pages
        // render before Clerk has finished hydrating the signed-in user.
        if (!cancelled && (!CLERK_ENABLED || restoredLegacySession)) setLoading(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [loadCurrentUser, scheduleRefresh, doRefresh, clearTimer]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{
      token: string;
      refreshToken: string;
      csrfToken: string;
      user: AuthUser;
    }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    clerkSessionRef.current = false;
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
      clerkSessionRef.current = false;
      setToken(res.token);
      setUser(res.user);
      scheduleRefresh();
    },
    [scheduleRefresh]
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {CLERK_ENABLED ? (
        <ClerkAuthSync
          setUser={setUser}
          setToken={setToken}
          setLoading={setLoading}
          loadCurrentUser={loadCurrentUser}
          clearTimer={clearTimer}
          clerkSessionRef={clerkSessionRef}
          clerkSignOutRef={clerkSignOutRef}
        />
      ) : null}
      {children}
    </AuthContext.Provider>
  );
}

function ClerkAuthSync({
  setUser,
  setToken,
  setLoading,
  loadCurrentUser,
  clearTimer,
  clerkSessionRef,
  clerkSignOutRef,
}: {
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  loadCurrentUser: () => Promise<AuthUser>;
  clearTimer: () => void;
  clerkSessionRef: MutableRefObject<boolean>;
  clerkSignOutRef: MutableRefObject<(() => Promise<void>) | null>;
}) {
  const clerk = useClerk();
  const { isLoaded, isSignedIn } = useClerkUser();

  useEffect(() => {
    clerkSignOutRef.current = async () => {
      if (clerk.loaded) await clerk.signOut();
    };
    return () => {
      clerkSignOutRef.current = null;
    };
  }, [clerk, clerkSignOutRef]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    async function syncClerkUser() {
      if (!isSignedIn) {
        clerkSessionRef.current = false;
        clearTimer();
        setUser(null);
        setToken(null);
        setLoading(false);
        return;
      }

      clerkSessionRef.current = true;
      clearTimer();
      setLoading(true);
      try {
        await loadCurrentUser();
      } catch {
        if (!cancelled) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    syncClerkUser();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, loadCurrentUser, clearTimer, setLoading, setToken, setUser, clerkSessionRef]);

  return null;
}
