"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Split-Flap Display — like airport departure boards (Solari boards).
 * Each character flips mechanically through values to reach its target.
 */

const CHARS = " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ₮/:.—#♥★";

interface SplitFlapCharProps {
  target: string;
  delay?: number;
}

function SplitFlapChar({ target, delay = 0 }: SplitFlapCharProps) {
  const [current, setCurrent] = useState(" ");
  const [flipping, setFlipping] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const targetIdx = CHARS.indexOf(target.toUpperCase());
      if (targetIdx === -1) { setCurrent(target); return; }

      let idx = CHARS.indexOf(current.toUpperCase());
      if (idx === -1) idx = 0;

      if (idx === targetIdx) return;

      setFlipping(true);
      intervalRef.current = setInterval(() => {
        idx = (idx + 1) % CHARS.length;
        setCurrent(CHARS[idx]);
        if (idx === targetIdx) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setFlipping(false);
        }
      }, 40);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, delay]);

  return (
    <span className={`split-flap-char ${flipping ? "split-flap-flip" : ""}`}>
      {current}
    </span>
  );
}

interface SplitFlapProps {
  value: string;
  /** Number of character slots (pads with spaces on the left) */
  length?: number;
  className?: string;
  /** Stagger delay between characters in ms */
  stagger?: number;
}

export function SplitFlap({ value, length, className = "", stagger = 60 }: SplitFlapProps) {
  const padded = length ? value.padStart(length, " ") : value;

  return (
    <span className={`split-flap-container ${className}`}>
      {padded.split("").map((char, i) => (
        <SplitFlapChar key={i} target={char} delay={i * stagger} />
      ))}
    </span>
  );
}

/**
 * Animated counter — counts up from 0 to target value with odometer effect.
 */
interface CounterProps {
  value: number;
  duration?: number;
  className?: string;
  suffix?: string;
}

export function Counter({ value, duration = 1200, className = "", suffix = "" }: CounterProps) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  return (
    <span className={`mono ${className}`}>
      {display.toLocaleString()}{suffix}
    </span>
  );
}
