import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt$( v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function fmtN(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(decimals)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(decimals)}K`;
  return v.toFixed(decimals);
}

export function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(decimals)}%`;
}

export function fmtGrowth(v: number | null | undefined): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(1)}%`;
}

export function fmtIndex(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(0)}`;
}

export function scoreColor(score: number): string {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-blue-600";
  if (score >= 25) return "text-amber-600";
  return "text-red-500";
}

export function scoreBg(score: number): string {
  if (score >= 75) return "bg-green-50 text-green-700 border-green-200";
  if (score >= 50) return "bg-blue-50 text-blue-700 border-blue-200";
  if (score >= 25) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

export function growthColor(v: number | null | undefined): string {
  if (v == null) return "text-slate-400";
  if (v > 0.15) return "text-green-600";
  if (v > 0) return "text-green-500";
  if (v > -0.1) return "text-amber-500";
  return "text-red-500";
}

export function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    Bars: "#2563eb",
    Beverages: "#7c3aed",
    Snacks: "#d97706",
    Supplements: "#16a34a",
    "Frozen Meals": "#0891b2",
  };
  return map[cat] ?? "#64748b";
}

export function ageLabel(weeks: number): string {
  if (weeks < 13) return "0–12w";
  if (weeks < 27) return "13–26w";
  if (weeks < 53) return "27–52w";
  return "52w+";
}

export function priceTierLabel(price: number): string {
  if (price < 3) return "< $3";
  if (price < 6) return "$3–$6";
  if (price < 10) return "$6–$10";
  return "$10+";
}
