"use client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface Center {
  id: string;
  name: string;
  address: string;
  district: string;
  description?: string | null;
  images: string[];
  seatCount: number;
  availableSeats: number;
  minPricePerHour: number | null;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  lat?: number | null;
  lng?: number | null;
  distance?: number | null;
}

interface CentersResponse {
  centers: Center[];
  count: number;
  page: number;
  limit: number;
}

export function useCenters(district?: string) {
  const q = district ? `?district=${encodeURIComponent(district)}` : "";
  return useQuery<CentersResponse>({
    queryKey: ["centers", district ?? ""],
    queryFn: () => apiFetch<CentersResponse>(`/api/centers${q}`),
    staleTime: 20_000, // seats change frequently, 20s freshness
  });
}
