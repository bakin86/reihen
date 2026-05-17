"use client";

import { useCallback, useRef, useState } from "react";

export function useNotificationSound() {
  const [enabled, setEnabled] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureContext = useCallback(async () => {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!ctxRef.current) ctxRef.current = new AudioContextCtor();
    if (ctxRef.current.state === "suspended") await ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const enable = useCallback(async () => {
    const ctx = await ensureContext();
    if (!ctx) return;
    setEnabled(true);
  }, [ensureContext]);

  const play = useCallback(async () => {
    if (!enabled) return;
    const ctx = await ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    gain.connect(ctx.destination);

    for (const [offset, freq] of [
      [0, 740],
      [0.11, 980],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + offset);
      osc.connect(gain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.18);
    }
  }, [enabled, ensureContext]);

  return { enabled, enable, play };
}
