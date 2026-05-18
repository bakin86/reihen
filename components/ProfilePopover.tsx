"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

interface Booking {
  id: string;
  status: string;
  startTime: string;
  hours: number;
  totalPrice: number;
  bookingSeats: { seat: { number: string } }[];
  center: { id: string; name: string };
}

export function ProfilePopover({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, token, logout } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useQuery<{ bookings: Booking[] }>({
    queryKey: ["activeBookings", "popover"],
    queryFn: () => apiFetch("/api/bookings", { token }),
    enabled: open && !!token,
    staleTime: 30_000,
  });

  const activeBookings = (data?.bookings ?? [])
    .filter((b) => b.status === "PENDING" || b.status === "CONFIRMED")
    .slice(0, 2);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if ((event.target as Element).closest("[data-profile-popover-root]")) return;
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !user) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-10 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/10 bg-white/88 p-3 text-black shadow-[0_24px_80px_rgba(0,0,0,0.20)] backdrop-blur-2xl"
    >
      <div className="rounded-xl border border-black/[0.06] bg-white/72 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black text-sm font-black text-white">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black text-black">{user.name}</div>
            <div className="truncate text-[11px] text-black/45">{user.email}</div>
            <div className="mt-2 inline-flex rounded-full border border-black/10 bg-black/[0.035] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/55">
              {user.role}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-black/40">Balance</div>
            <div className="mono text-sm font-black text-black">{user.balance.toLocaleString()}₮</div>
          </div>
        </div>
      </div>

      <div className="mt-2 rounded-xl border border-black/[0.06] bg-white/58 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-black/45">Active</span>
          {isFetching && <span className="text-[9px] uppercase tracking-[0.16em] text-black/30">Loading</span>}
        </div>

        {!isFetching && activeBookings.length === 0 && (
          <p className="py-3 text-[11px] text-black/45">Идэвхтэй захиалга алга.</p>
        )}

        <div className="space-y-2">
          {activeBookings.map((booking) => (
            <Link
              key={booking.id}
              href={`/centers/${booking.center.id}`}
              onClick={onClose}
              className="block rounded-xl border border-black/[0.06] bg-white/72 px-3 py-2 transition hover:border-black/16 hover:bg-white"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-bold text-black">
                    {booking.bookingSeats.map((bs) => bs.seat.number).join(", ")}
                    <span className="ml-1.5 font-medium text-black/45">{booking.center.name}</span>
                  </div>
                  <div className="mono mt-0.5 text-[9px] text-black/42">
                    {new Date(booking.startTime).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {booking.hours}ц
                  </div>
                </div>
                <span className="mono shrink-0 text-[10px] font-bold text-black/58">
                  {booking.totalPrice.toLocaleString()}₮
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link
          href="/profile"
          onClick={onClose}
          className="soft-action-light soft-action-light-primary px-3 py-2 text-[10px] uppercase tracking-[0.16em]"
        >
          Profile
        </Link>
        <button
          onClick={() => {
            onClose();
            logout();
          }}
          className="soft-action-light px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-red-600 hover:border-red-500/35 hover:bg-red-50 hover:text-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
