/**
 * Skeleton — animated placeholder that matches the shape of real content.
 * Use `dark` prop when rendering on a dark background.
 */

import { type CSSProperties } from "react";

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
  dark?: boolean;
}

export function Skeleton({ className = "", style, dark = false }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse ${dark ? "bg-white/[0.06]" : "bg-black/[0.05]"} ${className}`}
      style={style}
    />
  );
}

/* ── Pre-built skeletons for common patterns ── */

/** Matches a single center row on the home page */
export function CenterRowSkeleton({ index }: { index: number }) {
  const isEven = index % 2 === 0;
  return (
    <div className="flex items-stretch" style={{ minHeight: 200 }}>
      {/* Image placeholder */}
      <div
        className={`hidden md:block flex-shrink-0 ${isEven ? "order-1" : "order-2"}`}
        style={{ width: "38%" }}
      >
        <Skeleton className="h-full w-full" />
      </div>

      {/* Text block */}
      <div
        className={`flex flex-1 flex-col justify-between px-6 py-10 md:px-10 md:py-12 ${
          isEven ? "order-2" : "order-1"
        }`}
      >
        {/* Index + district */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-2 w-5" />
          <Skeleton className="h-2 w-16" />
        </div>
        {/* Name */}
        <Skeleton className="mt-3 h-10 w-3/4 md:h-14" />
        {/* Meta */}
        <div className="mt-4 flex items-center gap-5">
          <Skeleton className="h-2 w-10" />
          <Skeleton className="h-2 w-16" />
          <Skeleton className="h-2 w-20" />
        </div>
      </div>
    </div>
  );
}

/** Matches the 6-cell stats strip on profile */
export function StatsStripSkeleton({ dark = true }: { dark?: boolean }) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center justify-center py-6">
          <Skeleton dark={dark} className="h-7 w-16 mb-2" />
          <Skeleton dark={dark} className="h-2 w-12" />
        </div>
      ))}
    </div>
  );
}

/** Matches a single booking history row */
export function BookingRowSkeleton({ dark = true }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 md:px-12">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-3">
          <Skeleton dark={dark} className="h-2 w-16" />
          <Skeleton dark={dark} className="h-2 w-4" />
        </div>
        <Skeleton dark={dark} className="h-3 w-40" />
        <Skeleton dark={dark} className="h-2 w-28" />
      </div>
      <Skeleton dark={dark} className="h-4 w-16" />
    </div>
  );
}

/** Matches the monthly spending chart */
export function ChartSkeleton({ dark = true }: { dark?: boolean }) {
  return (
    <div className="flex items-end gap-1.5" style={{ height: 120 }}>
      {Array.from({ length: 6 }).map((_, i) => {
        const heights = [40, 65, 30, 80, 55, 45];
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="w-full flex items-end" style={{ height: 80 }}>
              <Skeleton
                dark={dark}
                className="w-full"
                style={{ height: `${heights[i]}%` }}
              />
            </div>
            <Skeleton dark={dark} className="h-2 w-5" />
          </div>
        );
      })}
    </div>
  );
}

/** Matches the 4-cell bento stat cards in the owner dashboard */
export function DashStatSkeleton({ dark = true }: { dark?: boolean }) {
  return (
    <div className="flex flex-col justify-between border border-white/[0.06] bg-white/[0.03] p-4 md:p-6" style={{ minHeight: 140 }}>
      <Skeleton dark={dark} className="h-2 w-20" />
      <div>
        <Skeleton dark={dark} className="h-10 w-28 mt-2" />
        <Skeleton dark={dark} className="h-2 w-14 mt-2" />
      </div>
    </div>
  );
}

/** Top center row skeleton */
export function TopCenterRowSkeleton({ dark = true }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-5 py-4">
      <Skeleton dark={dark} className="h-8 w-6 shrink-0" />
      <Skeleton dark={dark} className="h-10 w-10 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton dark={dark} className="h-3 w-32" />
        <Skeleton dark={dark} className="h-2 w-48" />
      </div>
    </div>
  );
}
