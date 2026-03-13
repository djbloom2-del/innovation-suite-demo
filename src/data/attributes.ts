import type { AttributePerf, AttributeCombo, Category } from "@/lib/types";
import { LAUNCHES, getWinners } from "./launches";

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
