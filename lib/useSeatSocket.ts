"use client";

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import type { SeatStatus } from "@/components/SeatCell";

export interface SeatUpdate {
  id: string;
  status: SeatStatus;
  code?: string;
  freeAt?: string | null;
}

export interface BookingUpdate {
  id: string;
  code?: string;
  status: string;
  paymentStatus?: string;
}

interface SeatRealtimeRow {
  id: string;
  centerId: string;
  number: string;
  status: SeatStatus;
  freeAt: string | null;
}

interface BookingRealtimeRow {
  id: string;
  centerId: string;
  code: string;
  status: string;
  paymentStatus: string;
}

export function useSeatSocket(
  branchId: string,
  onUpdate: (u: SeatUpdate) => void,
  token?: string | null,
  onBookingUpdate?: (u: BookingUpdate) => void
) {
  // Stable ref so realtime/socket effects never need onUpdate in their deps.
  const onUpdateRef = useRef(onUpdate);
  const onBookingUpdateRef = useRef(onBookingUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onBookingUpdateRef.current = onBookingUpdate;
  });

  useEffect(() => {
    if (!branchId) return;

    const subscriptions: { unsubscribe: () => Promise<unknown> }[] = [];
    let socket: Socket | null = null;
    let cancelled = false;

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      import("@/lib/supabase-client").then(({ isSupabaseRealtimeConfigured, supabase }) => {
        if (cancelled || !isSupabaseRealtimeConfigured || !supabase) return;
        const channel = supabase
          .channel(`seat-status:${branchId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "Seat",
              filter: `centerId=eq.${branchId}`,
            },
            (payload) => {
              const row = payload.new as SeatRealtimeRow;
              if (!row?.id || !row?.status) return;
              onUpdateRef.current({
                id: row.id,
                status: row.status,
                code: row.number,
                freeAt: row.freeAt,
              });
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "Booking",
              filter: `centerId=eq.${branchId}`,
            },
            (payload) => {
              const row = payload.new as BookingRealtimeRow;
              if (!row?.id) return;
              onBookingUpdateRef.current?.({
                id: row.id,
                code: row.code,
                status: row.status,
                paymentStatus: row.paymentStatus,
              });
            }
          )
          .subscribe();

        subscriptions.push(channel);
      });
    }

    const url = process.env.NEXT_PUBLIC_WS_URL;
    if (url) {
      const socketToken = token && token !== "cookie-auth" ? token : undefined;
      import("socket.io-client").then(({ io }) => {
        if (cancelled) return;
        socket = io(url, {
          transports: ["websocket"],
          auth: { token: socketToken },
        });

        socket.on("connect_error", (err) => {
          // Silent fail for unauthenticated users - seat grid still works via REST/Realtime.
          if (err.message.includes("Authentication") || err.message.includes("token")) {
            socket?.disconnect();
          }
        });

        socket.emit("branch:join", branchId);
        socket.on("seat:update", (u: SeatUpdate) => onUpdateRef.current(u));
        socket.on("booking:update", (u: BookingUpdate) => onBookingUpdateRef.current?.(u));
      });
    }

    return () => {
      cancelled = true;
      for (const sub of subscriptions) {
        sub.unsubscribe().catch(() => {});
      }
      if (socket) {
        socket.emit("branch:leave", branchId);
        socket.disconnect();
      }
    };
  }, [branchId, token]); // onUpdate intentionally excluded - handled via ref
}
