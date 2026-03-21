import type { CohortRow, Category, Launch } from "@/lib/types";
import { LAUNCHES } from "./launches";
import { DATA_SNAPSHOT_DATE } from "@/lib/utils";

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
export function getMonthlyLaunchCounts(launches?: Launch[]): { month: string; count: number }[] {
  const source = launches ?? LAUNCHES;
  const now = new Date(DATA_SNAPSHOT_DATE);
  const counts = new Map<string, number>();

  for (let i = 17; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7) + "-01";
    counts.set(key, 0);
  }

  source.forEach((l) => {
    const key = l.launchCohortMonth;
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries()).map(([month, count]) => ({ month, count }));
}

// Attribute adoption over time — dollar-weighted (% of category $ from launches with attribute)
export function getAttributeAdoptionOverTime(): {
  month: string;
  organic: number;
  keto: number;
  protein: number;
  vegan: number;
  nonGmo: number;
}[] {
  const now = new Date(DATA_SNAPSHOT_DATE);
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

    // Dollar-weight by dollarsLatest so attribute share reflects revenue, not just launch count
    const totalDollars = monthLaunches.reduce((s, l) => s + l.dollarsLatest, 0);
    if (totalDollars === 0)
      return { month, organic: 0, keto: 0, protein: 0, vegan: 0, nonGmo: 0 };

    const dollarShare = (filter: (l: (typeof monthLaunches)[0]) => boolean) =>
      Math.round(
        (monthLaunches.filter(filter).reduce((s, l) => s + l.dollarsLatest, 0) / totalDollars) * 100
      );

    return {
      month,
      organic: dollarShare((l) => l.attributes.isOrganic),
      keto: dollarShare((l) => l.attributes.isKeto),
      protein: dollarShare((l) => l.attributes.isProteinFocused),
      vegan: dollarShare((l) => l.attributes.isVegan),
      nonGmo: dollarShare((l) => l.attributes.isNonGmo),
    };
  });
}

// Survival curve data — derived from actual LAUNCHES survival flags
export function getSurvivalCurveData(): {
  week: number;
  cohort1: number;
  cohort2: number;
  cohort3: number;
}[] {
  const weeks = [4, 8, 12, 16, 20, 26, 39, 52];

  // Three vintage cohorts by launch cohort month
  const cohortGroups = [
    LAUNCHES.filter((l) => l.launchCohortMonth >= "2025-01-01" && l.launchCohortMonth <= "2025-06-01"),
    LAUNCHES.filter((l) => l.launchCohortMonth >= "2024-07-01" && l.launchCohortMonth <= "2024-12-01"),
    LAUNCHES.filter((l) => l.launchCohortMonth >= "2024-01-01" && l.launchCohortMonth <= "2024-06-01"),
  ];

  function survivalAnchors(group: typeof LAUNCHES): {
    w12: number;
    w26: number | null;
    w52: number | null;
  } {
    if (group.length === 0) return { w12: 0, w26: null, w52: null };
    const w12 = group.filter((l) => l.survived12w).length / group.length;
    const eligible26 = group.filter((l) => l.survived26w !== null);
    const w26 =
      eligible26.length > 0
        ? eligible26.filter((l) => l.survived26w === true).length / eligible26.length
        : null;
    const eligible52 = group.filter((l) => l.survived52w !== null);
    const w52 =
      eligible52.length > 0
        ? eligible52.filter((l) => l.survived52w === true).length / eligible52.length
        : null;
    return { w12, w26, w52 };
  }

  function interpRate(
    week: number,
    anchors: { w12: number; w26: number | null; w52: number | null }
  ): number {
    const { w12, w26, w52 } = anchors;
    if (week <= 12) {
      // Linear from 1.0 at week 0 to w12 at week 12
      const t = week / 12;
      return Math.round((1 - t * (1 - w12)) * 100);
    }
    if (week <= 26) {
      if (w26 === null) return 0;
      const t = (week - 12) / (26 - 12);
      return Math.round((w12 + t * (w26 - w12)) * 100);
    }
    if (week <= 52) {
      if (w26 === null || w52 === null) return 0;
      const t = (week - 26) / (52 - 26);
      return Math.round((w26 + t * (w52 - w26)) * 100);
    }
    return 0;
  }

  const anchors = cohortGroups.map(survivalAnchors);

  return weeks.map((week) => ({
    week,
    cohort1: interpRate(week, anchors[0]),
    cohort2: interpRate(week, anchors[1]),
    cohort3: interpRate(week, anchors[2]),
  }));
}
