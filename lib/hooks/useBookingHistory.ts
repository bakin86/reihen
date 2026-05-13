"use client";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

type BookingStatus = "ALL" | "CONFIRMED" | "CANCELLED" | "NOSHOW" | "PENDING";

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useBookingHistory(page: number, status?: BookingStatus) {
  const { token } = useAuth();
  const params = new URLSearchParams({ page: String(page), limit: "10" });
  if (status && status !== "ALL") params.set("status", status);

  return useQuery<{ bookings: any[]; pagination: Pagination }>({
    queryKey: ["bookingHistory", page, status ?? "ALL"],
    queryFn: () => apiFetch(`/api/bookings/history?${params}`, { token }),
    enabled: !!token,
    placeholderData: keepPreviousData, // keep previous page visible while loading next
    staleTime: 30_000,
  });
}
