"use client";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";

interface LazyImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
}

export function LazyImage({ src, alt, fill, className, sizes }: LazyImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" } // start loading 200px before entering viewport
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0">
      {visible && (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          className={className}
          sizes={sizes}
          loading="lazy"
          placeholder="empty"
        />
      )}
    </div>
  );
}
