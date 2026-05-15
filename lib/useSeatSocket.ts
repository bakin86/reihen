"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import type { SeatStatus } from "@/components/SeatCell";
import { isSupabaseRealtimeConfigured, supabase } from "@/lib/supabase-client";

export interface SeatUpdate {
  id: string;
  status: SeatStatus;
  code?: string;
  freeAt?: string | null;
}

interface SeatRealtimeRow {
  id: string;
  centerId: string;
  number: string;
  status: SeatStatus;
  freeAt: string | null;
}

export function useSeatSocket(branchId: string, onUpdate: (u: SeatUpdate) => void, token?: string | null) {
  // Stable ref so realtime/socket effects never need onUpdate in their deps.
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  useEffect(() => {
    if (!branchId) return;

    const subscriptions: { unsubscribe: () => Promise<unknown> }[] = [];
    let socket: Socket | null = null;

    if (isSupabaseRealtimeConfigured && supabase) {
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
        .subscribe();

      subscriptions.push(channel);
    }

    const url = process.env.NEXT_PUBLIC_WS_URL;
    if (url) {
      const socketToken = token && token !== "cookie-auth" ? token : undefined;
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
    }

    return () => {
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
