import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Launch, LaunchOutcome, VelocityTier } from "@/lib/types";

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

// Shared price-tier breakpoints — also imported by analogs.ts for priceTierIndex
export const PRICE_TIER_THRESHOLDS = [3, 6, 10] as const;

export function priceTierLabel(price: number): string {
  const [t1, t2, t3] = PRICE_TIER_THRESHOLDS;
  if (price < t1) return "< $3";
  if (price < t2) return "$3–$6";
  if (price < t3) return "$6–$10";
  return "$10+";
}

/** Format a YYYY-MM-DD (or YYYY-MM-01) date string as "Mar '26" */
export function fmtMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/** Hex color for a quality score — consistent with scoreColor() Tailwind classes */
export function scoreHex(score: number): string {
  if (score >= 75) return "#16a34a"; // green-600
  if (score >= 50) return "#2563eb"; // blue-600
  if (score >= 25) return "#d97706"; // amber-600
  return "#dc2626";                   // red-600
}

export const OUTCOME_META: Record<LaunchOutcome, { label: string; description: string; bgClass: string; hex: string }> = {
  "Early Stage": {
    label: "Early Stage",
    description: "Year 1 not yet complete — outcome pending",
    bgClass: "bg-slate-100 text-slate-600 border border-slate-300",
    hex: "#64748b",
  },
  "Year 1": {
    label: "Year 1",
    description: "Year 1 complete, awaiting Year 2 read",
    bgClass: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    hex: "#4f46e5",
  },
  "Successful": {
    label: "Successful",
    description: "Y2 dollars or velocity exceeded Y1",
    bgClass: "bg-teal-50 text-teal-700 border border-teal-200",
    hex: "#0d9488",
  },
  "Fading": {
    label: "Fading",
    description: "Y2 did not surpass Y1 in size or growth",
    bgClass: "bg-orange-50 text-orange-700 border border-orange-200",
    hex: "#ea580c",
  },
  "Sustaining": {
    label: "Sustaining",
    description: "Y3 dollars grew vs. Y2 — durable brand",
    bgClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    hex: "#059669",
  },
  "Declining": {
    label: "Declining",
    description: "Y3 dollars fell vs. Y2",
    bgClass: "bg-rose-50 text-rose-700 border border-rose-200",
    hex: "#e11d48",
  },
};

export const VELOCITY_TIER_META: Record<VelocityTier, { label: string; bgClass: string; hex: string }> = {
  "Top":    { label: "Top Third",    bgClass: "bg-green-50 text-green-700 border border-green-200",   hex: "#16a34a" },
  "Mid":    { label: "Mid Third",    bgClass: "bg-yellow-50 text-yellow-700 border border-yellow-200", hex: "#ca8a04" },
  "Bottom": { label: "Bottom Third", bgClass: "bg-slate-100 text-slate-500 border border-slate-300",  hex: "#94a3b8" },
};

export const LAUNCH_OUTCOMES: LaunchOutcome[] = [
  "Early Stage", "Year 1", "Successful", "Fading", "Sustaining", "Declining"
];

// $ generated per total distribution point (efficiency metric)
export function getDollarPerTdp(l: Launch): number {
  return l.tdpLatest > 0 ? l.dollarsLatest / l.tdpLatest : 0;
}

// Category ranking: Top Third / Mid Third / Bottom Third by dollarsLatest
export function getCategoryTier(l: Launch, allLaunches: Launch[]): "Top Third" | "Mid Third" | "Bottom Third" {
  const peers = allLaunches.filter(p => p.category === l.category);
  peers.sort((a, b) => b.dollarsLatest - a.dollarsLatest);
  const rank = peers.findIndex(p => p.upc === l.upc) + 1;
  const n = peers.length;
  if (rank <= Math.ceil(n / 3)) return "Top Third";
  if (rank <= Math.ceil((2 * n) / 3)) return "Mid Third";
  return "Bottom Third";
}

// Effective promo depth: what % discount is applied when item is on promotion
// Formula: (basePrice - avgActualPrice) / basePrice / promoDependency
// Returns 0 if promoDependency < 0.01 (essentially never on promo)
export function getPromoDepth(l: Launch): number {
  if (l.promoDependency < 0.01) return 0;
  return (l.basePrice - l.priceLatest) / l.basePrice / l.promoDependency;
}

// Item's contribution to category growth in percentage points
// e.g. 0.75 means this item drove 0.75pp of category's total growth rate
export function getGrowthContribution(l: Launch, benchGrowthRate: number): number {
  if (!l.growthRate12w || benchGrowthRate === 0) return 0;
  return l.dollarShareCategory * l.growthRate12w;
}
