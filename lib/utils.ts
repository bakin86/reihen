import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatMNT(amount: number) {
  return new Intl.NumberFormat("mn-MN").format(amount) + "₮";
}

export function hoursBetween(a: Date, b: Date) {
  return Math.max(0, (b.getTime() - a.getTime()) / 3_600_000);
}
