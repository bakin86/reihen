"use client";
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import type { SeatStatus } from "@/components/SeatCell";

export interface SeatUpdate {
  id: string;
  status: SeatStatus;
  code?: string;
  freeAt?: string | null;
}

export function useSeatSocket(branchId: string, onUpdate: (u: SeatUpdate) => void, token?: string | null) {
  // Stable ref so the socket effect never needs onUpdate in its deps
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  useEffect(() => {
    if (!branchId) return;
    const url = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

    const socket: Socket = io(url, {
      transports: ["websocket"],
      auth: { token: token ?? undefined },
    });

    socket.on("connect_error", (err) => {
      // Silent fail for unauthenticated users — seat grid still works via REST
      if (err.message.includes("Authentication") || err.message.includes("token")) {
        socket.disconnect();
      }
    });

    socket.emit("branch:join", branchId);
    socket.on("seat:update", (u: SeatUpdate) => onUpdateRef.current(u));

    return () => {
      socket.emit("branch:leave", branchId);
      socket.disconnect();
    };
  }, [branchId, token]); // onUpdate intentionally excluded — handled via ref
}
