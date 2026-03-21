import type { NeedState, Category, InnovationType, Launch } from "@/lib/types";

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------

export const NEED_STATE_META: Record<NeedState, { hex: string; description: string }> = {
  "Energy Support":           { hex: "#f59e0b", description: "Energy, stamina, alertness, and endurance" },
  "Recovery":                 { hex: "#0ea5e9", description: "Post-workout rebuild, muscle repair, joint support" },
  "Cognitive Health & Focus": { hex: "#8b5cf6", description: "Brain health, focus, clarity, concentration" },
  "Mood Support":             { hex: "#ec4899", description: "Calm, stress relief, emotional wellbeing, adaptogens" },
  "Immunity":                 { hex: "#22c55e", description: "Immune defense, seasonal wellness" },
  "Sleep":                    { hex: "#6366f1", description: "Sleep quality, nighttime rest, relaxation" },
  "Digestive Health":         { hex: "#84cc16", description: "Gut health, probiotics, microbiome, regularity" },
  "Hydration":                { hex: "#06b6d4", description: "Replenishment, electrolytes, fluid balance" },
  "Beauty & Skin Health":     { hex: "#f472b6", description: "Skin, hair, nails, collagen, beauty-from-within" },
  "Cleanse / Detox":          { hex: "#a3e635", description: "Cleanse, detox, reset, greens" },
  "Broad Wellness":           { hex: "#94a3b8", description: "General wellness, clean eating, balanced nutrition" },
};

export const NEED_STATE_LIST: NeedState[] = [
  "Energy Support",
  "Recovery",
  "Cognitive Health & Focus",
  "Mood Support",
  "Immunity",
  "Sleep",
  "Digestive Health",
  "Hydration",
  "Beauty & Skin Health",
  "Cleanse / Detox",
  "Broad Wellness",
];

// ---------------------------------------------------------------------------
// SPINS-ready normalized input interface
// ---------------------------------------------------------------------------

export interface NeedStateInput {
  category: Category;
  subcategory: string;
  healthFocus: string | null;
  functionalIngredients: string[];
  brandPositioning: string | null;
  eatingOccasion: string | null;
  isProteinFocused: boolean;
  isVegan: boolean;
  isOrganic: boolean;
}

// ---------------------------------------------------------------------------
// Adapter: Launch → NeedStateInput  (SPINS swap point)
// ---------------------------------------------------------------------------

export function launchToNeedStateInput(l: Launch): NeedStateInput {
  return {
    category: l.category,
    subcategory: l.subcategory,
    healthFocus: l.attributes.healthFocus,
    functionalIngredients: l.attributes.functionalIngredient
      ? l.attributes.functionalIngredient.split(/[+,]/).map((s) => s.trim().toLowerCase())
      : [],
    brandPositioning: l.attributes.brandPositioning,
    eatingOccasion: l.attributes.eatingOccasion,
    isProteinFocused: l.attributes.isProteinFocused,
    isVegan: l.attributes.isVegan,
    isOrganic: l.attributes.isOrganic,
  };
}

// ---------------------------------------------------------------------------
// Classification maps
// ---------------------------------------------------------------------------

export const HEALTH_FOCUS_MAP: Record<string, NeedState> = {
  "Muscle Recovery":    "Recovery",
  "Energy":             "Energy Support",
  "Endurance":          "Energy Support",
  "Performance":        "Energy Support",
  "Immune Support":     "Immunity",
  "Sleep":              "Sleep",
  "Focus & Calm":       "Cognitive Health & Focus",
  "Focus & Cognition":  "Cognitive Health & Focus",
  "Cognitive Health":   "Cognitive Health & Focus",
  "Gut Health":         "Digestive Health",
  "Hydration":          "Hydration",
  "Stress Relief":      "Mood Support",
  "Joint & Skin Health":"Beauty & Skin Health",
  "Anti-Inflammatory":  "Recovery",
};

export const FUNCTIONAL_INGREDIENT_SECONDARY_MAP: Record<string, NeedState> = {
  "melatonin":           "Sleep",
  "l-theanine":          "Mood Support",
  "ashwagandha":         "Mood Support",
  "probiotics":          "Digestive Health",
  "prebiotics":          "Digestive Health",
  "elderberry":          "Immunity",
  "zinc":                "Immunity",
  "vitamin c":           "Immunity",
  "collagen peptides":   "Beauty & Skin Health",
  "collagen":            "Beauty & Skin Health",
  "lion's mane":         "Cognitive Health & Focus",
  "bacopa":              "Cognitive Health & Focus",
  "electrolytes":        "Hydration",
  "spirulina":           "Cleanse / Detox",
  "chlorella":           "Cleanse / Detox",
  "adaptogens":          "Mood Support",
  "magnesium glycinate": "Sleep",
  "magnesium":           "Mood Support",
  "creatine":            "Recovery",
  "caffeine":            "Energy Support",
};

// ---------------------------------------------------------------------------
// Core classification function
// ---------------------------------------------------------------------------

export function computeNeedState(input: NeedStateInput): { primary: NeedState; secondary: NeedState | null } {
  const primary: NeedState =
    (input.healthFocus != null && input.healthFocus !== "" && HEALTH_FOCUS_MAP[input.healthFocus])
      ? HEALTH_FOCUS_MAP[input.healthFocus]
      : "Broad Wellness";

  let secondary: NeedState | null = null;
  for (const token of input.functionalIngredients) {
    const ns = FUNCTIONAL_INGREDIENT_SECONDARY_MAP[token];
    if (ns && ns !== primary) {
      secondary = ns;
      break;
    }
  }
  return { primary, secondary };
}

// ---------------------------------------------------------------------------
// Aggregation interfaces
// ---------------------------------------------------------------------------

export interface NeedStatePerf {
  needState: NeedState;
  launchCount: number;
  winRate: number;
  avgQualityScore: number;
  avgVelocity: number;
  totalDollars: number;
  topInnoType: InnovationType;
}

export interface NeedStateTrendRow {
  month: string;
  [needState: string]: number | string;
}

export interface NeedStateInnoRow {
  needState: NeedState;
  "New to World": number;
  "Flavor Extension": number;
  "Format Extension": number;
  "Category Extension": number;
  "Pack Size Variant": number;
}

// ---------------------------------------------------------------------------
// Aggregation functions
// ---------------------------------------------------------------------------

function getDefaultLaunches(): Launch[] {
  // Lazy import to avoid circular dependency with launches.ts
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/data/launches").LAUNCHES as Launch[];
}

export function getNeedStatePerformance(launches?: Launch[]): NeedStatePerf[] {
  const data = launches ?? getDefaultLaunches();
  const grouped = new Map<NeedState, Launch[]>();

  for (const l of data) {
    const existing = grouped.get(l.needState) ?? [];
    existing.push(l);
    grouped.set(l.needState, existing);
  }

  const results: NeedStatePerf[] = [];

  for (const [needState, group] of grouped) {
    if (needState === "Broad Wellness") continue;

    const launchCount = group.length;
    const winners = group.filter((l) => l.launchQualityScore >= 70);
    const winRate = launchCount > 0 ? winners.length / launchCount : 0;
    const avgQualityScore =
      launchCount > 0
        ? group.reduce((sum, l) => sum + l.launchQualityScore, 0) / launchCount
        : 0;
    const avgVelocity =
      launchCount > 0
        ? group.reduce((sum, l) => sum + l.velocityLatest, 0) / launchCount
        : 0;
    const totalDollars = group.reduce((sum, l) => sum + (l.dollars52w ?? 0), 0);

    // Most common innovationType
    const innoCount = new Map<InnovationType, number>();
    for (const l of group) {
      innoCount.set(l.innovationType, (innoCount.get(l.innovationType) ?? 0) + 1);
    }
    let topInnoType: InnovationType = "Unclassified";
    let topCount = 0;
    for (const [inno, count] of innoCount) {
      if (count > topCount) {
        topCount = count;
        topInnoType = inno;
      }
    }

    results.push({ needState, launchCount, winRate, avgQualityScore, avgVelocity, totalDollars, topInnoType });
  }

  return results.sort((a, b) => b.launchCount - a.launchCount);
}

export function getNeedStateTrends(launches?: Launch[]): NeedStateTrendRow[] {
  const data = launches ?? getDefaultLaunches();
  // Last 12 months from DATA_SNAPSHOT_DATE
  const snapshot = new Date("2026-03-08");
  const cutoff = new Date(snapshot);
  cutoff.setMonth(cutoff.getMonth() - 12);

  const filtered = data.filter((l) => {
    const d = new Date(l.firstSeenDate);
    return d >= cutoff && d <= snapshot;
  });

  // Build month → needState → count
  const monthMap = new Map<string, Map<NeedState, number>>();

  for (const l of filtered) {
    const month = l.launchCohortMonth; // already YYYY-MM-DD (first of month)
    if (!monthMap.has(month)) {
      monthMap.set(month, new Map());
    }
    const nsMap = monthMap.get(month)!;
    nsMap.set(l.needState, (nsMap.get(l.needState) ?? 0) + 1);
  }

  // Build all months in range
  const months: string[] = [];
  const cur = new Date(cutoff);
  cur.setDate(1);
  while (cur <= snapshot) {
    months.push(cur.toISOString().split("T")[0]);
    cur.setMonth(cur.getMonth() + 1);
  }

  return months.map((month) => {
    const row: NeedStateTrendRow = { month };
    const nsMap = monthMap.get(month);
    for (const ns of NEED_STATE_LIST) {
      row[ns] = nsMap?.get(ns) ?? 0;
    }
    return row;
  });
}

export function getNeedStateByInnoType(launches?: Launch[]): NeedStateInnoRow[] {
  const data = launches ?? getDefaultLaunches();
  const grouped = new Map<NeedState, NeedStateInnoRow>();

  for (const l of data) {
    if (l.needState === "Broad Wellness") continue;

    if (!grouped.has(l.needState)) {
      grouped.set(l.needState, {
        needState: l.needState,
        "New to World": 0,
        "Flavor Extension": 0,
        "Format Extension": 0,
        "Category Extension": 0,
        "Pack Size Variant": 0,
      });
    }

    const row = grouped.get(l.needState)!;
    const inno = l.innovationType;
    if (
      inno === "New to World" ||
      inno === "Flavor Extension" ||
      inno === "Format Extension" ||
      inno === "Category Extension" ||
      inno === "Pack Size Variant"
    ) {
      row[inno] += 1;
    }
  }

  return Array.from(grouped.values());
}
