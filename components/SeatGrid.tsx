"use client";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { SeatStatus, SeatUpdateEvent } from "@/types";
import { cn } from "@/lib/utils";

interface Seat {
  id: string;
  code: string;
  status: SeatStatus;
  tier: string;
}

export function SeatGrid({
  branchId,
  initial,
  onSelect,
}: {
  branchId: string;
  initial: Seat[];
  onSelect?: (seat: Seat) => void;
}) {
  const [seats, setSeats] = useState<Seat[]>(initial);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";
    const socket: Socket = io(url, { transports: ["websocket"] });
    socket.emit("branch:join", branchId);
    socket.on("seat:update", (evt: SeatUpdateEvent) => {
      setSeats((prev) =>
        prev.map((s) => (s.id === evt.id ? { ...s, status: evt.status } : s))
      );
    });
    return () => {
      socket.emit("branch:leave", branchId);
      socket.disconnect();
    };
  }, [branchId]);

  return (
    <div className="grid grid-cols-6 gap-2 md:grid-cols-10">
      {seats.map((s) => (
        <button
          key={s.id}
          disabled={s.status !== "AVAILABLE"}
          onClick={() => onSelect?.(s)}
          className={cn(
            "aspect-square border border-black text-xs font-black",
            s.status === "AVAILABLE" && "bg-white text-black hover:bg-black hover:text-white",
            s.status === "OCCUPIED" && "bg-black text-white",
            s.status === "RESERVED" && "bg-gray text-white",
            s.status === "MAINTENANCE" && "bg-white text-gray line-through",
            s.status === "OFFLINE" && "opacity-30"
          )}
        >
          {s.code}
        </button>
      ))}
    </div>
  );
}
