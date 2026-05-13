"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

export function useFavorites() {
  const { token } = useAuth();
  return useQuery<{ centers: { id: string }[] }>({
    queryKey: ["favorites"],
    queryFn: () => apiFetch("/api/favorites", { token }),
    enabled: !!token,
    staleTime: 60_000,
  });
}

export function useToggleFavorite() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ centerId, isFav }: { centerId: string; isFav: boolean }) => {
      if (isFav) {
        await apiFetch(`/api/favorites/${centerId}`, { method: "DELETE", token });
      } else {
        await apiFetch(`/api/favorites/${centerId}`, { method: "POST", token });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
  });
}
