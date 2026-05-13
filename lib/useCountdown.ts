"use client";

import { useEffect, useState } from "react";

/**
 * Returns minutes remaining until `freeAt`, or null if unavailable/past.
 * Recalculates every 30 seconds.
 */
export function useCountdown(freeAt: string | null | undefined): number | null {
  const [remaining, setRemaining] = useState<number | null>(() => calc(freeAt));

  useEffect(() => {
    if (!freeAt) {
      setRemaining(null);
      return;
    }
    setRemaining(calc(freeAt));
    const id = setInterval(() => setRemaining(calc(freeAt)), 30_000);
    return () => clearInterval(id);
  }, [freeAt]);

  return remaining;
}

function calc(freeAt: string | null | undefined): number | null {
  if (!freeAt) return null;
  const ms = new Date(freeAt).getTime() - Date.now();
  if (ms <= 0) return null;
  return Math.ceil(ms / 60_000);
}
