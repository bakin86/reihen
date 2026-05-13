"use client";
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";

interface InViewProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** milliseconds delay before animation starts */
  delay?: number;
  /** initial movement direction */
  from?: "up" | "down" | "left" | "right" | "none";
  /** distance in px */
  distance?: number;
  /** animation duration in ms */
  duration?: number;
  /** IntersectionObserver rootMargin bottom offset */
  offset?: string;
  as?: "div" | "section" | "span";
}

export function InView({
  children,
  className = "",
  style,
  delay = 0,
  from = "up",
  distance = 40,
  duration = 900,
  offset = "-80px",
  as: Tag = "div",
}: InViewProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: `0px 0px ${offset} 0px`, threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [offset]);

  const initX = from === "left" ? -distance : from === "right" ? distance : 0;
  const initY = from === "up" ? distance : from === "down" ? -distance : 0;

  return (
    <Tag
      ref={ref as any}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible
          ? "translate(0px, 0px)"
          : `translate(${initX}px, ${initY}px)`,
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: visible ? "auto" : "transform, opacity",
      }}
    >
      {children}
    </Tag>
  );
}
