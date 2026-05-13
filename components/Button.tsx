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
        "px-6 py-4 text-sm uppercase tracking-widest transition-colors disabled:opacity-50",
        variant === "solid" && "bg-black text-white hover:bg-gray",
        variant === "outline" && "border border-black hover:bg-black hover:text-white",
        className
      )}
    />
  );
}
