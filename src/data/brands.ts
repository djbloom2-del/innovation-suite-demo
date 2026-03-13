import type { Brand } from "@/lib/types";
import { LAUNCHES } from "./launches";

function buildBrand(
  name: string,
  company: string,
  coreDollars: number,
  priorTotal: number
): Brand {
  const launches = LAUNCHES.filter((l) => l.brand === name);
  const categories = [...new Set(launches.map((l) => l.category))] as Brand["categories"];
  const newItemDollars = launches.reduce((s, l) => s + l.dollarsLatest, 0);
  const totalDollars = coreDollars + newItemDollars;
  const totalGrowth = totalDollars - priorTotal;
  const winners = launches.filter((l) => l.launchQualityScore >= 70);

  return {
    name,
    company,
    categories,
    totalDollars,
    coreDollars,
    newItemDollars,
    totalDollarsPrior: priorTotal,
    pctGrowthFromNewItems: totalGrowth > 0 ? Math.min(newItemDollars / totalGrowth, 1.5) : 0,
    launchCount: launches.length,
    winnerCount: winners.length,
    winRate: launches.length > 0 ? winners.length / launches.length : 0,
    innovationScore: launches.length > 0 ? newItemDollars / launches.length : 0,
    cohortQualityTrend: [
      { quarter: "Q2 2025", medianScore: 44 + Math.round(name.length * 1.5) % 20 },
      { quarter: "Q3 2025", medianScore: 48 + Math.round(name.length * 1.8) % 18 },
      { quarter: "Q4 2025", medianScore: 52 + Math.round(name.length * 2.1) % 22 },
      { quarter: "Q1 2026", medianScore: 56 + Math.round(name.length * 2.3) % 18 },
    ],
  };
}

export const BRANDS: Brand[] = [
  buildBrand("PeakBar", "Peak Performance Brands", 18_400_000, 22_100_000),
  buildBrand("Elevate", "Elevate Natural Foods", 9_200_000, 10_800_000),
  buildBrand("WildRoots", "WildRoots Co.", 6_100_000, 7_400_000),
  buildBrand("PlantPower", "Elevate Natural Foods", 14_800_000, 16_900_000),
  buildBrand("Clarity Energy", "Clarity Wellness", 22_600_000, 24_000_000),
  buildBrand("VoltPure", "Clarity Wellness", 11_300_000, 12_800_000),
  buildBrand("AquaZen", "Clarity Wellness", 8_700_000, 9_500_000),
  buildBrand("MindFuel", "Clarity Wellness", 5_400_000, 5_800_000),
  buildBrand("CrispLite", "Elevate Natural Foods", 7_900_000, 8_500_000),
  buildBrand("BeanBurst", "Elevate Natural Foods", 5_100_000, 5_300_000),
  buildBrand("PureChip", "WildRoots Co.", 3_800_000, 4_100_000),
  buildBrand("VitaGlow", "Clarity Wellness", 28_400_000, 29_200_000),
  buildBrand("MuscleMend", "Peak Performance Brands", 16_200_000, 17_800_000),
  buildBrand("FocusPeak", "Clarity Wellness", 9_100_000, 9_300_000),
  buildBrand("SleepEase", "Clarity Wellness", 19_800_000, 20_100_000),
  buildBrand("ProbioBalance", "Elevate Natural Foods", 12_300_000, 12_900_000),
  buildBrand("FreshBowl", "FreshBowl Meals", 14_600_000, 15_900_000),
  buildBrand("CleanEats", "FreshBowl Meals", 8_900_000, 9_800_000),
  buildBrand("SlimFit", "FreshBowl Meals", 6_200_000, 6_800_000),
  buildBrand("PlantHarvest", "Elevate Natural Foods", 7_400_000, 7_900_000),
];

export function getBrand(name: string): Brand | undefined {
  return BRANDS.find((b) => b.name === name);
}

export function getTopBrandsByGrowth(topN = 8): Brand[] {
  return [...BRANDS]
    .sort((a, b) => {
      const growthA = (a.totalDollars - a.totalDollarsPrior) / (a.totalDollarsPrior || 1);
      const growthB = (b.totalDollars - b.totalDollarsPrior) / (b.totalDollarsPrior || 1);
      return growthB - growthA;
    })
    .slice(0, topN);
}

export function getBrandsByCompany(company: string): Brand[] {
  return BRANDS.filter((b) => b.company === company);
}

export const COMPANIES = [...new Set(BRANDS.map((b) => b.company))];
