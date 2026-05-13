"use client";
import { useEffect, useState } from "react";

interface TypewriterProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  onComplete?: () => void;
}

/**
 * Typewriter — reveals text one character at a time.
 * Used for booking codes, confirmations, system messages.
 */
export function Typewriter({ text, speed = 50, delay = 0, className = "", onComplete }: TypewriterProps) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);

    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
          onComplete?.();
        }
      }, speed);
      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, delay]);

  return (
    <span className={`${className} ${!done ? "typewriter-cursor" : ""}`}>
      {displayed}
    </span>
  );
}
