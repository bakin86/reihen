import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "outline" | "ghost";
}

export function Button({ variant = "solid", className, type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-semibold uppercase tracking-widest transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-400 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "solid" && "border border-black bg-black text-white shadow-[0_10px_26px_rgba(0,0,0,0.14)] hover:-translate-y-0.5 hover:bg-gray active:translate-y-0",
        variant === "outline" && "border border-black/25 bg-white/70 text-black hover:-translate-y-0.5 hover:border-black hover:bg-black hover:text-white active:translate-y-0",
        variant === "ghost" && "border border-transparent bg-transparent text-black/55 hover:bg-black/[0.05] hover:text-black",
        className
      )}
    />
  );
}
