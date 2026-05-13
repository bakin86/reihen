"use client";
import { memo } from "react";
import { useCountdown } from "@/lib/useCountdown";
import type { SeatStatus } from "@/components/SeatCell";

interface BlueprintSeat {
  id: string;
  number: string;
  status: SeatStatus;
  posX?: number | null;
  posY?: number | null;
  freeAt?: string | null;
  typeName?: string | null;
}

interface BlueprintSeatMapProps {
  seats: BlueprintSeat[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  floorName?: string;
}

export function BlueprintSeatMap({ seats, selectedIds, onToggle, floorName }: BlueprintSeatMapProps) {
  // Calculate grid bounds
  const positioned = seats.filter((s) => s.posX != null && s.posY != null);
  const unpositioned = seats.filter((s) => s.posX == null || s.posY == null);

  const maxX = positioned.length > 0 ? Math.max(...positioned.map((s) => s.posX!)) : 0;
  const maxY = positioned.length > 0 ? Math.max(...positioned.map((s) => s.posY!)) : 0;

  return (
    <div className="blueprint-grid rounded-xl p-6 relative overflow-hidden">
      {/* Blueprint title block */}
      <div className="absolute top-3 left-4 flex items-center gap-3">
        <span className="text-[9px] uppercase tracking-[0.3em] text-blue-400/40">
          {floorName || "FLOOR PLAN"}
        </span>
        <span className="text-[8px] text-blue-400/25 mono">
          {seats.length} SEATS · {maxX + 1}×{maxY + 1}
        </span>
      </div>

      {/* Scale indicator */}
      <div className="absolute top-3 right-4 flex items-center gap-2">
        <div className="w-8 h-px bg-blue-400/30" />
        <span className="text-[7px] text-blue-400/30 mono">1m</span>
      </div>

      {/* Positioned seats — absolute grid */}
      {positioned.length > 0 && (
        <div
          className="relative mt-8 mx-auto"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${maxX + 1}, 48px)`,
            gridTemplateRows: `repeat(${maxY + 1}, 48px)`,
            gap: "4px",
            width: "fit-content",
          }}
        >
          {positioned.map((seat) => (
            <BlueprintSeatCell
              key={seat.id}
              seat={seat}
              selected={selectedIds.has(seat.id)}
              onClick={() => onToggle(seat.id)}
              style={{
                gridColumn: seat.posX! + 1,
                gridRow: seat.posY! + 1,
              }}
            />
          ))}
        </div>
      )}

      {/* Unpositioned seats — flow grid */}
      {unpositioned.length > 0 && (
        <div className="mt-6 grid grid-cols-6 gap-1 md:grid-cols-10">
          {unpositioned.map((seat) => (
            <BlueprintSeatCell
              key={seat.id}
              seat={seat}
              selected={selectedIds.has(seat.id)}
              onClick={() => onToggle(seat.id)}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-[9px] text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 border border-green-500/60 bg-green-500/5 rounded-sm" /> OPEN
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 border border-white/15 rounded-sm" style={{ background: "repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(255,255,255,0.03) 2px,rgba(255,255,255,0.03) 4px)" }} /> OCCUPIED
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 border border-dashed border-yellow-500/50 bg-yellow-500/5 rounded-sm" /> WAITING
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 border border-dashed border-orange-500/40 rounded-sm" /> REPAIR
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 border border-white/10 bg-black/30 rounded-sm" /> CLOSED
        </span>
      </div>
    </div>
  );
}

const BlueprintSeatCell = memo(function BlueprintSeatCell({
  seat,
  selected,
  onClick,
  style,
}: {
  seat: BlueprintSeat;
  selected: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  const remaining = useCountdown(seat.status === "OCCUPIED" ? seat.freeAt : null);

  const labelColor =
    seat.status === "OPEN"     ? "text-green-400/80" :
    seat.status === "OCCUPIED" ? "text-white/40" :
    seat.status === "WAITING"  ? "text-yellow-400/80" :
    seat.status === "REPAIR"   ? "text-orange-400/60" :
    "text-white/20";

  return (
    <button
      onClick={onClick}
      data-status={seat.status}
      className={`blueprint-seat flex flex-col items-center justify-center rounded-sm aspect-square min-h-[44px] text-[10px] font-bold ${selected ? "selected" : ""}`}
      style={style}
    >
      <span className={labelColor}>{seat.number}</span>

      {/* Type name */}
      {seat.typeName && (
        <span className="text-[7px] text-white/30 mt-0.5 font-normal leading-none truncate max-w-full px-0.5">
          {seat.typeName}
        </span>
      )}

      {/* Countdown on occupied seats */}
      {seat.status === "OCCUPIED" && remaining != null && (
        <span className="text-[7px] text-white/25 mt-0.5 font-normal">{remaining}м</span>
      )}

      {selected && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 text-[6px] text-white">
          ✓
        </span>
      )}
    </button>
  );
});
