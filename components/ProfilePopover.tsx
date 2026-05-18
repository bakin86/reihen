"use client";

import { useEffect, useRef, useState } from "react";
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
  const [rendered, setRendered] = useState(open);

  const { data, isFetching } = useQuery<{ bookings: Booking[] }>({
    queryKey: ["activeBookings"],
    queryFn: () => apiFetch("/api/bookings", { token }),
    enabled: open && !!token,
    staleTime: 30_000,
  });

  const activeBookings = (data?.bookings ?? [])
    .filter((b) => b.status === "PENDING" || b.status === "CONFIRMED")
    .slice(0, 2);

  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }

    const timer = window.setTimeout(() => setRendered(false), 180);
    return () => window.clearTimeout(timer);
  }, [open]);

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

  if (!rendered || !user) return null;

  return (
    <div
      ref={panelRef}
      className={`fixed left-4 right-4 top-16 overflow-hidden rounded-2xl border border-black/10 bg-white/88 p-3 text-black shadow-[0_24px_80px_rgba(0,0,0,0.20)] backdrop-blur-2xl sm:absolute sm:left-auto sm:right-0 sm:top-10 sm:w-[min(22rem,calc(100vw-2rem))] ${
        open ? "profile-popover-enter" : "profile-popover-exit"
      }`}
      role="dialog"
      aria-label="Profile summary"
    >
      <div className="profile-popover-item rounded-xl border border-black/[0.06] bg-white/72 p-4" style={{ animationDelay: "40ms" }}>
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

      <div className="profile-popover-item mt-2 rounded-xl border border-black/[0.06] bg-white/58 p-3" style={{ animationDelay: "80ms" }}>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-black/45">
            <span className="profile-live-dot h-1.5 w-1.5 rounded-full bg-green-500" />
            Active
          </span>
          {isFetching && <span className="text-[9px] uppercase tracking-[0.16em] text-black/30">Loading</span>}
        </div>

        {!isFetching && activeBookings.length === 0 && (
          <p className="py-3 text-[11px] text-black/45">Идэвхтэй захиалга алга.</p>
        )}

        <div className="space-y-2">
          {activeBookings.map((booking, index) => (
            <Link
              key={booking.id}
              href={`/centers/${booking.center.id}`}
              onClick={onClose}
              className="profile-popover-item block rounded-xl border border-black/[0.06] bg-white/72 px-3 py-2 transition duration-200 hover:-translate-y-0.5 hover:border-black/16 hover:bg-white hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
              style={{ animationDelay: `${120 + index * 45}ms` }}
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

        {activeBookings.length > 0 && (
          <Link
            href="/profile"
            onClick={onClose}
            className="mt-2 block rounded-lg px-3 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-black/45 transition hover:bg-black/[0.04] hover:text-black"
          >
            View all bookings
          </Link>
        )}
      </div>

      <div className="profile-popover-item mt-2 grid grid-cols-2 gap-2" style={{ animationDelay: "140ms" }}>
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
