import type { AttributePerf, AttributeCombo, Category, AttributeIntelRecord, ComboIntelRecord } from "@/lib/types";
import type { Launch } from "@/lib/types";
import { LAUNCHES, getWinners } from "./launches";

// ─── Shared attribute keys + matcher (used by winner-dna and whitespace pages) ─
export const ATTR_KEYS = ["Organic", "Non-GMO", "Gluten-Free", "Vegan", "Keto", "Protein"] as const;
export type AttrKey = typeof ATTR_KEYS[number];

export function matchesAttr(l: Launch, attr: AttrKey): boolean {
  const a = l.attributes;
  if (attr === "Organic")     return a.isOrganic;
  if (attr === "Non-GMO")     return a.isNonGmo;
  if (attr === "Gluten-Free") return a.isGlutenFree;
  if (attr === "Vegan")       return a.isVegan;
  if (attr === "Keto")        return a.isKeto;
  if (attr === "Protein")     return a.isProteinFocused;
  return false;
}

function buildAttributePerf(
  attrName: string,
  attrValue: string,
  category: Category,
  trend: AttributePerf["trend"]
): AttributePerf {
  const catLaunches = LAUNCHES.filter((l) => l.category === category);
  const winners = getWinners(catLaunches);
  const winnerUpcs = new Set(winners.map((w) => w.upc));

  const withAttr = catLaunches.filter((l) => {
    const a = l.attributes;
    if (attrName === "Organic") return a.isOrganic === (attrValue === "true");
    if (attrName === "Non-GMO") return a.isNonGmo === (attrValue === "true");
    if (attrName === "Gluten-Free") return a.isGlutenFree === (attrValue === "true");
    if (attrName === "Vegan") return a.isVegan === (attrValue === "true");
    if (attrName === "Keto") return a.isKeto === (attrValue === "true");
    if (attrName === "Protein") return a.isProteinFocused === (attrValue === "true");
    if (attrName === "Form") return a.form === attrValue;
    if (attrName === "Functional Ingredient") return a.functionalIngredient === attrValue;
    if (attrName === "Health Focus") return a.healthFocus === attrValue;
    return false;
  });

  const winnerCount = withAttr.filter((l) => winnerUpcs.has(l.upc)).length;
  const overallWinRate = catLaunches.length > 0 ? winners.length / catLaunches.length : 0;
  const winRate = withAttr.length > 0 ? winnerCount / withAttr.length : 0;
  const penetrationRate = catLaunches.length > 0 ? withAttr.length / catLaunches.length : 0;

  return {
    attributeName: attrName,
    attributeValue: attrValue,
    category,
    launchCount: withAttr.length,
    winnerCount,
    winRate,
    overindexVsAll: overallWinRate > 0 ? winRate / overallWinRate : 1,
    medianVelocity: withAttr.length > 0
      ? withAttr.reduce((s, l) => s + l.velocityLatest, 0) / withAttr.length
      : 0,
    medianPriceIndex: withAttr.length > 0
      ? withAttr.reduce((s, l) => s + l.priceIndexVsCategory, 0) / withAttr.length
      : 1,
    medianPromoDependency: withAttr.length > 0
      ? withAttr.reduce((s, l) => s + l.promoDependency, 0) / withAttr.length
      : 0,
    trend,
    penetrationRate,
  };
}

export const ATTRIBUTE_PERFORMANCE: AttributePerf[] = [
  // Bars
  buildAttributePerf("Non-GMO", "true", "Bars", "rising"),
  buildAttributePerf("Gluten-Free", "true", "Bars", "stable"),
  buildAttributePerf("Protein", "true", "Bars", "rising"),
  buildAttributePerf("Organic", "true", "Bars", "rising"),
  buildAttributePerf("Vegan", "true", "Bars", "stable"),
  buildAttributePerf("Keto", "true", "Bars", "rising"),
  // Beverages
  buildAttributePerf("Non-GMO", "true", "Beverages", "rising"),
  buildAttributePerf("Organic", "true", "Beverages", "rising"),
  buildAttributePerf("Vegan", "true", "Beverages", "stable"),
  buildAttributePerf("Keto", "true", "Beverages", "rising"),
  buildAttributePerf("Gluten-Free", "true", "Beverages", "stable"),
  buildAttributePerf("Protein", "true", "Beverages", "stable"),
  // Snacks
  buildAttributePerf("Non-GMO", "true", "Snacks", "rising"),
  buildAttributePerf("Gluten-Free", "true", "Snacks", "rising"),
  buildAttributePerf("Vegan", "true", "Snacks", "rising"),
  buildAttributePerf("Protein", "true", "Snacks", "rising"),
  buildAttributePerf("Keto", "true", "Snacks", "rising"),
  buildAttributePerf("Organic", "true", "Snacks", "stable"),
  // Supplements
  buildAttributePerf("Non-GMO", "true", "Supplements", "stable"),
  buildAttributePerf("Vegan", "true", "Supplements", "rising"),
  buildAttributePerf("Gluten-Free", "true", "Supplements", "stable"),
  buildAttributePerf("Keto", "true", "Supplements", "rising"),
  // Frozen Meals
  buildAttributePerf("Non-GMO", "true", "Frozen Meals", "stable"),
  buildAttributePerf("Gluten-Free", "true", "Frozen Meals", "rising"),
  buildAttributePerf("Vegan", "true", "Frozen Meals", "rising"),
  buildAttributePerf("Protein", "true", "Frozen Meals", "rising"),
  buildAttributePerf("Keto", "true", "Frozen Meals", "rising"),
  buildAttributePerf("Organic", "true", "Frozen Meals", "stable"),
];

export const ATTRIBUTE_COMBOS: AttributeCombo[] = [
  { attributes: ["Non-GMO", "Gluten-Free", "Protein"], launchCount: 22, winnerCount: 12, winRate: 0.55, medianDollars26w: 420_000, lift: 2.4 },
  { attributes: ["Organic", "Vegan"], launchCount: 18, winnerCount: 9, winRate: 0.50, medianDollars26w: 340_000, lift: 2.1 },
  { attributes: ["Keto", "Non-GMO"], launchCount: 15, winnerCount: 7, winRate: 0.47, medianDollars26w: 310_000, lift: 2.0 },
  { attributes: ["Vegan", "Protein"], launchCount: 14, winnerCount: 6, winRate: 0.43, medianDollars26w: 290_000, lift: 1.8 },
  { attributes: ["Organic", "Gluten-Free"], launchCount: 20, winnerCount: 8, winRate: 0.40, medianDollars26w: 265_000, lift: 1.7 },
  { attributes: ["Non-GMO", "Vegan", "Gluten-Free"], launchCount: 12, winnerCount: 5, winRate: 0.42, medianDollars26w: 280_000, lift: 1.75 },
  { attributes: ["Keto", "Protein"], launchCount: 10, winnerCount: 4, winRate: 0.40, medianDollars26w: 250_000, lift: 1.68 },
  { attributes: ["Organic", "Non-GMO", "Vegan"], launchCount: 9, winnerCount: 4, winRate: 0.44, medianDollars26w: 320_000, lift: 1.85 },
  { attributes: ["Functional", "Non-GMO"], launchCount: 11, winnerCount: 5, winRate: 0.45, medianDollars26w: 305_000, lift: 1.9 },
  { attributes: ["Vegan", "Organic", "Gluten-Free"], launchCount: 8, winnerCount: 4, winRate: 0.50, medianDollars26w: 360_000, lift: 2.1 },
];

export function getAttributePerfByCategory(category: Category): AttributePerf[] {
  return ATTRIBUTE_PERFORMANCE.filter((a) => a.category === category);
}

export function getTopAttributesByWinRate(category?: Category, topN = 10): AttributePerf[] {
  const filtered = category
    ? ATTRIBUTE_PERFORMANCE.filter((a) => a.category === category)
    : ATTRIBUTE_PERFORMANCE;
  return [...filtered].sort((a, b) => b.winRate - a.winRate).slice(0, topN);
}

export function getRisingUnderpenetrated(category?: Category): AttributePerf[] {
  const filtered = category
    ? ATTRIBUTE_PERFORMANCE.filter((a) => a.category === category && a.trend === "rising" && a.penetrationRate < 0.35)
    : ATTRIBUTE_PERFORMANCE.filter((a) => a.trend === "rising" && a.penetrationRate < 0.35);
  return filtered.sort((a, b) => b.winRate - a.winRate);
}

// ─── Attribute Demand Signals ─────────────────────────────────────────────────

export interface AttributeDemandSignal {
  attributeName: string;
  attributeValue: string;
  category: Category;
  penetrationRate: number;
  trend: "rising" | "stable" | "declining";
  launchCount: number;
  attrDollarShare: number;
  attrWeightedGrowth: number;
  categoryGrowthContrib: number;
  signal: "Demand Driver" | "Share Shift" | "Niche Leader" | "Fading";
}

export function getAttributeDemandSignals(category: Category | null): AttributeDemandSignal[] {
  const entries = category === null
    ? ATTRIBUTE_PERFORMANCE
    : ATTRIBUTE_PERFORMANCE.filter((ap) => ap.category === category);

  return entries.map((ap): AttributeDemandSignal => {
    const catLaunches = LAUNCHES.filter((l) => l.category === ap.category);
    const matchingLaunches = catLaunches.filter((l) => {
      const a = l.attributes;
      if (ap.attributeName === "Organic")     return a.isOrganic === (ap.attributeValue === "true");
      if (ap.attributeName === "Non-GMO")     return a.isNonGmo === (ap.attributeValue === "true");
      if (ap.attributeName === "Gluten-Free") return a.isGlutenFree === (ap.attributeValue === "true");
      if (ap.attributeName === "Vegan")       return a.isVegan === (ap.attributeValue === "true");
      if (ap.attributeName === "Keto")        return a.isKeto === (ap.attributeValue === "true");
      if (ap.attributeName === "Protein")     return a.isProteinFocused === (ap.attributeValue === "true");
      if (ap.attributeName === "Form")        return a.form === ap.attributeValue;
      if (ap.attributeName === "Functional Ingredient") return a.functionalIngredient === ap.attributeValue;
      if (ap.attributeName === "Health Focus") return a.healthFocus === ap.attributeValue;
      return false;
    });

    const categoryDollars = catLaunches.reduce((sum, l) => sum + l.dollarsLatest, 0);
    const attrDollars = matchingLaunches.reduce((sum, l) => sum + l.dollarsLatest, 0);

    const attrDollarShare = categoryDollars === 0 ? 0 : attrDollars / categoryDollars;

    const attrWeightedGrowth = attrDollars === 0
      ? 0
      : matchingLaunches.reduce((sum, l) => sum + (l.growthRate12w ?? 0) * l.dollarsLatest, 0) / attrDollars;

    const categoryGrowthContrib = attrDollarShare * attrWeightedGrowth;

    let signal: AttributeDemandSignal["signal"];
    if (ap.trend === "rising" && categoryGrowthContrib > 0) {
      signal = "Demand Driver";
    } else if (ap.trend === "rising" && categoryGrowthContrib <= 0) {
      signal = "Share Shift";
    } else if (ap.trend !== "rising" && categoryGrowthContrib > 0) {
      signal = "Niche Leader";
    } else {
      signal = "Fading";
    }

    return {
      attributeName: ap.attributeName,
      attributeValue: ap.attributeValue,
      category: ap.category,
      penetrationRate: ap.penetrationRate,
      trend: ap.trend,
      launchCount: matchingLaunches.length,
      attrDollarShare,
      attrWeightedGrowth,
      categoryGrowthContrib,
      signal,
    };
  });
}

// ─── Dynamic attribute matcher (scales to any attribute universe) ─────────────
export function matchesAttrDynamic(l: Launch, attrName: string): boolean {
  const a = l.attributes;
  if (attrName === "Organic")     return a.isOrganic;
  if (attrName === "Non-GMO")     return a.isNonGmo;
  if (attrName === "Gluten-Free") return a.isGlutenFree;
  if (attrName === "Vegan")       return a.isVegan;
  if (attrName === "Keto")        return a.isKeto;
  if (attrName === "Protein")     return a.isProteinFocused;
  // Future SPINS attributes added here — no UI changes required
  return false;
}

// ─── Combination enumeration helper ──────────────────────────────────────────
function combosOf<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [
    ...combosOf(rest, k - 1).map((c) => [first, ...c]),
    ...combosOf(rest, k),
  ];
}

// ─── Core intelligence computation ───────────────────────────────────────────

/**
 * Computes Innovation Index, win rate, lift, and marginal contribution for
 * every attribute in `attrs`, plus all 2-attr and 3-attr subsets.
 *
 * @param catLaunches  All launches filtered to a single category
 * @param attrs        User-pinned attribute names (any strings)
 */
export function computeAttributeIntelligence(
  catLaunches: Launch[],
  attrs: string[],
): { singles: AttributeIntelRecord[]; combos: ComboIntelRecord[] } {
  if (attrs.length === 0) return { singles: [], combos: [] };

  const winners    = getWinners(catLaunches);
  const winnerSet  = new Set(winners.map((w) => w.upc));
  const baselineWR = catLaunches.length > 0 ? winners.length / catLaunches.length : 0;

  const newItems      = catLaunches.filter((l) => l.ageWeeks < 52);
  const totalNew$     = newItems.reduce((s, l) => s + l.dollarsLatest, 0);
  const totalExisting$= catLaunches.filter((l) => l.ageWeeks >= 52).reduce((s, l) => s + l.dollarsLatest, 0);

  function wrOf(pool: Launch[]): number {
    if (!pool.length) return 0;
    return pool.filter((l) => winnerSet.has(l.upc)).length / pool.length;
  }

  function innovIdx(pool: Launch[]): number {
    const newWith      = pool.filter((l) => l.ageWeeks < 52);
    const existWith    = pool.filter((l) => l.ageWeeks >= 52);
    const newShare     = totalNew$      > 0 ? newWith.reduce((s, l)   => s + l.dollarsLatest, 0) / totalNew$      : 0;
    const existShare   = totalExisting$ > 0 ? existWith.reduce((s, l) => s + l.dollarsLatest, 0) / totalExisting$ : 0;
    if (existShare === 0) return newShare > 0 ? 200 : 100;
    return Math.round((newShare / existShare) * 100);
  }

  // Full-combo win rate (used for marginal contribution)
  const fullCombo   = catLaunches.filter((l) => attrs.every((a) => matchesAttrDynamic(l, a)));
  const fullComboWR = wrOf(fullCombo);

  // Singles
  const singles: AttributeIntelRecord[] = attrs.map((attr) => {
    const withAttr  = catLaunches.filter((l) => matchesAttrDynamic(l, attr));
    // Set of all pinned attrs except this one
    const rest      = attrs.filter((a) => a !== attr);
    const withoutAttr = rest.length > 0
      ? catLaunches.filter((l) => rest.every((a) => matchesAttrDynamic(l, a)))
      : catLaunches;

    const newWith    = withAttr.filter((l) => l.ageWeeks < 52);
    const existWith  = withAttr.filter((l) => l.ageWeeks >= 52);
    const newShare   = totalNew$      > 0 ? newWith.reduce((s, l)   => s + l.dollarsLatest, 0) / totalNew$      : 0;
    const existShare = totalExisting$ > 0 ? existWith.reduce((s, l) => s + l.dollarsLatest, 0) / totalExisting$ : 0;

    return {
      attr,
      innovationIndex:         innovIdx(withAttr),
      winRate:                 wrOf(withAttr),
      baselineWinRate:         baselineWR,
      lift:                    baselineWR > 0 ? wrOf(withAttr) / baselineWR : 1,
      newItemDollarShare:      newShare,
      existingItemDollarShare: existShare,
      launchCount:             withAttr.length,
      penetrationRate:         catLaunches.length > 0 ? withAttr.length / catLaunches.length : 0,
      // marginalContribution: how much does fullComboWR drop when we remove this attr?
      marginalContribution:    attrs.length >= 2 ? fullComboWR - wrOf(withoutAttr) : 0,
    };
  });

  // 2-attr and 3-attr combos
  const comboSets = [...combosOf(attrs, 2), ...combosOf(attrs, 3)];
  const combos: ComboIntelRecord[] = comboSets.map((set) => {
    const matched = catLaunches.filter((l) => set.every((a) => matchesAttrDynamic(l, a)));
    const newWith    = matched.filter((l) => l.ageWeeks < 52);
    const existWith  = matched.filter((l) => l.ageWeeks >= 52);
    return {
      attrs:                   set,
      innovationIndex:         innovIdx(matched),
      winRate:                 wrOf(matched),
      lift:                    baselineWR > 0 ? wrOf(matched) / baselineWR : 1,
      launchCount:             matched.length,
      newItemDollarShare:      totalNew$      > 0 ? newWith.reduce((s, l)   => s + l.dollarsLatest, 0) / totalNew$      : 0,
      existingItemDollarShare: totalExisting$ > 0 ? existWith.reduce((s, l) => s + l.dollarsLatest, 0) / totalExisting$ : 0,
    };
  });

  return { singles, combos };
}

/**
 * Returns all ATTR_KEYS ranked by Innovation Index for a given category.
 * Used for the "nothing pinned" default table view.
 */
export function getTopSinglesByInnovationIndex(
  catLaunches: Launch[],
): AttributeIntelRecord[] {
  const allAttrs = [...ATTR_KEYS] as string[];
  const { singles } = computeAttributeIntelligence(catLaunches, allAttrs);
  return singles.sort((a, b) => b.innovationIndex - a.innovationIndex);
}
