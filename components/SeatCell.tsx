import { memo } from "react";
import { cn } from "@/lib/utils";
import { useCountdown } from "@/lib/useCountdown";

export type SeatStatus = "OPEN" | "CLOSED" | "REPAIR" | "WAITING" | "OCCUPIED";

export const SEAT_STATUS_STYLE: Record<SeatStatus, string> = {
  OPEN: "seat-open text-green-400 hover:text-green-300 cursor-pointer",
  OCCUPIED: "seat-occupied text-white/70",
  WAITING: "seat-waiting text-yellow-400",
  REPAIR: "seat-repair text-gray/40 line-through",
  CLOSED: "seat-closed text-gray/30",
};

export const SEAT_STATUS_LABEL: Record<SeatStatus, string> = {
  OPEN: "СУЛ",
  OCCUPIED: "ТОГЛОЖ БУЙ",
  WAITING: "ХҮЛЭЭЛ",
  REPAIR: "ЗАСВАР",
  CLOSED: "ХААЛТТАЙ",
};

export const SeatCell = memo(function SeatCell({
  number,
  status,
  freeAt,
  selected,
  onClick,
  title,
}: {
  number: string;
  status: SeatStatus;
  freeAt?: string | null;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const remaining = useCountdown(status === "OCCUPIED" ? freeAt : null);
  const freeingSoon = status === "OCCUPIED" && remaining != null && remaining <= 5;

  return (
    <button
      onClick={onClick}
      title={title ?? `${number} · ${status}`}
      className={cn(
        "relative aspect-square min-h-[48px] min-w-[48px] rounded-lg text-sm font-black transition-all duration-200",
        SEAT_STATUS_STYLE[status],
        freeingSoon && "seat-freeing-soon",
        selected && "seat-selected"
      )}
    >
      {/* Seat number */}
      <span className={cn(
        "relative z-10",
        selected && "text-white"
      )}>
        {number}
      </span>

      {/* Status indicator dot */}
      {status === "OPEN" && !selected && (
        <span className="absolute right-1 top-1 flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
        </span>
      )}

      {/* Countdown for occupied seats */}
      {status === "OCCUPIED" && remaining != null && (
        <span
          className={cn(
            "absolute bottom-1 left-0 right-0 text-[8px] font-medium",
            freeingSoon ? "text-yellow-400 animate-pulse" : "text-white/40"
          )}
        >
          {remaining}м
        </span>
      )}

      {/* Selected checkmark */}
      {selected && (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[8px] font-black text-white shadow-lg">
          ✓
        </span>
      )}
    </button>
  );
});

export function SeatLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-widest">
      {(Object.keys(SEAT_STATUS_STYLE) as SeatStatus[]).map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={cn(
              "h-4 w-4 rounded",
              s === "OPEN" && "border border-green-500/40 bg-green-500/10",
              s === "OCCUPIED" && "border border-white/10 bg-black/70",
              s === "WAITING" && "border border-yellow-400/40 bg-yellow-400/10",
              s === "REPAIR" && "border border-dashed border-gray/30 bg-white/3",
              s === "CLOSED" && "border border-gray/15 bg-black/3"
            )}
          />
          <span className="text-gray">{SEAT_STATUS_LABEL[s]}</span>
        </div>
      ))}
    </div>
  );
}
