import type { WhitespaceOpportunity, Category } from "@/lib/types";
import { CATEGORY_BENCHMARKS } from "./categories";

export const WHITESPACE_OPPORTUNITIES: WhitespaceOpportunity[] = [
  {
    category: "Supplements",
    attributeName: "Form",
    attributeValue: "Gummies",
    winRate: 0.68,
    penetrationRate: 0.22,
    growthSignal: 0.88,
    whitespaceScore: 84,
    description:
      "Gummy formats command 68% winner rate in Supplements but appear in only 22% of launches. Rapid adoption trend and strong retailer shelf space allocation.",
  },
  {
    category: "Beverages",
    attributeName: "Functional Ingredient",
    attributeValue: "Adaptogens",
    winRate: 0.62,
    penetrationRate: 0.14,
    growthSignal: 0.94,
    whitespaceScore: 82,
    description:
      "Adaptogen-positioned beverages are winning at 62% but only 14% of new beverage launches include adaptogens. Fastest-growing functional claim YoY.",
  },
  {
    category: "Frozen Meals",
    attributeName: "Health Focus",
    attributeValue: "High Protein",
    winRate: 0.58,
    penetrationRate: 0.18,
    growthSignal: 0.80,
    whitespaceScore: 76,
    description:
      "High-protein frozen meals are under-launched (18%) relative to their 58% win rate. Adjacent-category spillover from protein bars and supplements signals demand.",
  },
  {
    category: "Snacks",
    attributeName: "Health Focus",
    attributeValue: "Plant-Based Protein",
    winRate: 0.55,
    penetrationRate: 0.24,
    growthSignal: 0.76,
    whitespaceScore: 72,
    description:
      "Plant-protein snacks outperform the category average win rate by 2.3×. Still only 24% category penetration despite strong growth momentum.",
  },
  {
    category: "Bars",
    attributeName: "Functional Ingredient",
    attributeValue: "Ashwagandha",
    winRate: 0.71,
    penetrationRate: 0.06,
    growthSignal: 0.90,
    whitespaceScore: 88,
    description:
      "Ashwagandha appears in just 6% of bar launches but shows a 71% win rate among those that include it. Deeply underpenetrated with high trending search volume.",
  },
];

// Category bubble chart data
export function getWhitespaceBubbleData() {
  return CATEGORY_BENCHMARKS.map((b) => ({
    category: b.category,
    crowding: b.crowdingScore,
    growthRate: b.growthRate * 100,
    totalDollars: b.totalDollars,
    avgQualityScore: b.avgLaunchQualityScore,
    launchCount: b.launchCountLast12m,
    whitespaceQuadrant: getCategoryQuadrant(b.crowdingScore, b.growthRate),
  }));
}

function getCategoryQuadrant(
  crowding: number,
  growthRate: number
): "open-growing" | "crowded-growing" | "open-declining" | "crowded-declining" {
  const crowdMid = 5;
  const growthMid = 0.15;
  if (crowding < crowdMid && growthRate > growthMid) return "open-growing";
  if (crowding >= crowdMid && growthRate > growthMid) return "crowded-growing";
  if (crowding < crowdMid && growthRate <= growthMid) return "open-declining";
  return "crowded-declining";
}
