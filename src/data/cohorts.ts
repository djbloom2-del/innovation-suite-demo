import type { CohortRow, Category } from "@/lib/types";
import { LAUNCHES } from "./launches";

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7) + "-01";
}

export function buildCohortRows(): CohortRow[] {
  const groups = new Map<string, typeof LAUNCHES>();

  LAUNCHES.forEach((l) => {
    const key = `${l.category}::${l.launchCohortMonth}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  });

  const rows: CohortRow[] = [];
  groups.forEach((launches, key) => {
    const [category, cohortMonth] = key.split("::") as [Category, string];
    const survived12 = launches.filter((l) => l.survived12w).length;
    const survived26 = launches.filter((l) => l.survived26w === true).length;
    const eligible26 = launches.filter((l) => l.survived26w !== null).length;
    const scores = launches.map((l) => l.launchQualityScore).sort((a, b) => a - b);
    const medianScore = scores[Math.floor(scores.length / 2)] ?? 0;
    const v12wLaunches = launches.filter((l) => l.dollars12w > 0);

    rows.push({
      cohortMonth,
      category,
      launchCount: launches.length,
      medianScore,
      survivalRate12w: launches.length > 0 ? survived12 / launches.length : 0,
      survivalRate26w: eligible26 > 0 ? survived26 / eligible26 : 0,
      avgVelocity12w:
        v12wLaunches.length > 0
          ? v12wLaunches.reduce((s, l) => s + l.velocityLatest, 0) / v12wLaunches.length
          : 0,
    });
  });

  return rows.sort(
    (a, b) => new Date(a.cohortMonth).getTime() - new Date(b.cohortMonth).getTime()
  );
}

export const COHORT_ROWS: CohortRow[] = buildCohortRows();

// Monthly launch counts for trend chart (last 18 months)
export function getMonthlyLaunchCounts(): { month: string; count: number }[] {
  const now = new Date("2026-03-08");
  const counts = new Map<string, number>();

  for (let i = 17; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7) + "-01";
    counts.set(key, 0);
  }

  LAUNCHES.forEach((l) => {
    const key = l.launchCohortMonth;
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries()).map(([month, count]) => ({ month, count }));
}

// Attribute adoption over time (for stacked area chart)
export function getAttributeAdoptionOverTime(): {
  month: string;
  organic: number;
  keto: number;
  protein: number;
  vegan: number;
  nonGmo: number;
}[] {
  const now = new Date("2026-03-08");
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7) + "-01");
  }

  return months.map((month) => {
    const monthLaunches = LAUNCHES.filter((l) => {
      const ld = new Date(l.firstSeenDate);
      const md = new Date(month);
      return (
        ld.getFullYear() === md.getFullYear() && ld.getMonth() === md.getMonth()
      );
    });
    if (monthLaunches.length === 0)
      return { month, organic: 0, keto: 0, protein: 0, vegan: 0, nonGmo: 0 };
    const total = monthLaunches.length;
    return {
      month,
      organic: Math.round((monthLaunches.filter((l) => l.attributes.isOrganic).length / total) * 100),
      keto: Math.round((monthLaunches.filter((l) => l.attributes.isKeto).length / total) * 100),
      protein: Math.round((monthLaunches.filter((l) => l.attributes.isProteinFocused).length / total) * 100),
      vegan: Math.round((monthLaunches.filter((l) => l.attributes.isVegan).length / total) * 100),
      nonGmo: Math.round((monthLaunches.filter((l) => l.attributes.isNonGmo).length / total) * 100),
    };
  });
}

// Survival curve data
export function getSurvivalCurveData(): {
  week: number;
  cohort1: number;
  cohort2: number;
  cohort3: number;
}[] {
  const weeks = [4, 8, 12, 16, 20, 26, 39, 52];
  const cohortLaunches = [
    LAUNCHES.filter((l) => {
      const m = l.launchCohortMonth;
      return m >= "2025-01-01" && m <= "2025-06-01";
    }),
    LAUNCHES.filter((l) => {
      const m = l.launchCohortMonth;
      return m >= "2024-07-01" && m <= "2024-12-01";
    }),
    LAUNCHES.filter((l) => {
      const m = l.launchCohortMonth;
      return m >= "2024-01-01" && m <= "2024-06-01";
    }),
  ];

  const baseRates = [
    [0.92, 0.88, 0.84, 0.80, 0.76, 0.68, 0.58, null],
    [0.91, 0.86, 0.80, 0.74, 0.70, 0.62, 0.52, 0.43],
    [0.90, 0.84, 0.78, 0.72, 0.67, 0.59, 0.48, 0.40],
  ];

  return weeks.map((week, wi) => ({
    week,
    cohort1: baseRates[0][wi] !== null ? Math.round((baseRates[0][wi] as number) * 100) : 0,
    cohort2: Math.round((baseRates[1][wi] as number) * 100),
    cohort3: Math.round((baseRates[2][wi] as number) * 100),
  }));
}
