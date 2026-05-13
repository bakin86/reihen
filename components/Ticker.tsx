"use client";

export function Ticker({ items }: { items: string[] }) {
  const loop = [...items, ...items, ...items];
  return (
    <div className="overflow-hidden border-y border-white/[0.04] py-3">
      <div className="ticker text-[10px] uppercase tracking-[0.3em] text-white/25">
        {loop.map((t, i) => (
          <span key={i}>— {t}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * LiveTicker — real-time updates with a pulsing dot.
 */
export function LiveTicker({ items }: { items: string[] }) {
  const loop = [...items, ...items, ...items];
  return (
    <div className="overflow-hidden border-y border-white/[0.04] bg-[#080808] py-2.5">
      <div className="ticker-live text-[9px] uppercase tracking-[0.25em] text-white/20">
        {loop.map((t, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="inline-flex h-1 w-1 rounded-full bg-white/20 ticker-pulse" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
