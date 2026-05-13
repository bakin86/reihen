"use client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

export function useStats() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["me", "stats"],
    queryFn: () => apiFetch("/api/me/stats", { token }),
    enabled: !!token,
    staleTime: 60_000, // stats don't change every second
  });
}
