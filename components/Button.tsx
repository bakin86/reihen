import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "outline";
}

export function Button({ variant = "solid", className, ...props }: Props) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "solid" && "border border-black bg-black text-white shadow-[0_10px_26px_rgba(0,0,0,0.14)] hover:bg-gray",
        variant === "outline" && "border border-black/25 bg-white/70 text-black hover:border-black hover:bg-black hover:text-white",
        className
      )}
    />
  );
}
