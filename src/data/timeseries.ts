import { LAUNCHES } from "./launches";
import type { Launch, WeeklyPeriod } from "@/lib/types";

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function addDays(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const PATTERN_CURVES: Record<Launch["patternType"], (week: number) => number> = {
  winner: (w) => {
    if (w <= 4) return 0.6 + w * 0.1;
    if (w <= 12) return 1.0 + (w - 4) * 0.04;
    if (w <= 26) return 1.32 + (w - 12) * 0.015;
    return Math.min(1.32 + 14 * 0.015 + (w - 26) * 0.008, 2.2);
  },
  steady: (w) => {
    if (w <= 4) return 0.6 + w * 0.08;
    if (w <= 12) return 0.92 + (w - 4) * 0.02;
    return Math.min(1.08 + (w - 12) * 0.004, 1.3);
  },
  fader: (w) => {
    if (w <= 4) return 0.5 + w * 0.12;
    if (w <= 12) return 0.98 + (w - 4) * 0.01;
    if (w <= 26) return 1.06 - (w - 12) * 0.04;
    return Math.max(1.06 - 14 * 0.04 - (w - 26) * 0.02, 0.15);
  },
  sleeper: (w) => {
    if (w <= 8) return 0.5 + w * 0.06;
    if (w <= 20) return 0.98 + (w - 8) * 0.03;
    return Math.min(1.34 + (w - 20) * 0.02, 1.9);
  },
};

const TDP_CURVES: Record<Launch["patternType"], (week: number) => number> = {
  winner: (w) => Math.min(0.3 + w * 0.06, 1.85),
  steady: (w) => Math.min(0.35 + w * 0.035, 1.35),
  fader: (w) => {
    if (w <= 10) return 0.35 + w * 0.04;
    return Math.max(0.75 + (w - 10) * -0.02, 0.25);
  },
  sleeper: (w) => Math.min(0.3 + w * 0.04 + (w > 16 ? (w - 16) * 0.03 : 0), 1.55),
};

function generatePeriods(launch: Launch): WeeklyPeriod[] {
  const r = rng(parseInt(launch.upc.slice(-4)) * 7);
  const periods: WeeklyPeriod[] = [];

  const maxWeeks = Math.min(launch.ageWeeks, 52);
  const velocityCurve = PATTERN_CURVES[launch.patternType];
  const tdpCurve = TDP_CURVES[launch.patternType];

  const baseVelocity = launch.velocityLatest / velocityCurve(maxWeeks);
  const baseTdp = launch.tdpLatest / tdpCurve(maxWeeks);

  for (let w = 1; w <= maxWeeks; w++) {
    const jitter = 0.88 + r() * 0.24;
    const velocity = baseVelocity * velocityCurve(w) * jitter;
    const tdp = Math.max(50, baseTdp * tdpCurve(w) * (0.92 + r() * 0.16));
    const storesSelling = Math.round(tdp * (0.85 + r() * 0.3));
    const dollars = (velocity * storesSelling * 4) / 52;
    const promoJitter = 0.8 + r() * 0.4;

    periods.push({
      upc: launch.upc,
      endDate: addDays(launch.firstSeenDate, w * 7),
      ageWeeks: w,
      dollars: Math.max(0, dollars),
      velocity: Math.max(0, velocity),
      tdp: Math.round(tdp),
      storesSelling: Math.max(1, storesSelling),
      price: launch.priceLatest * (0.97 + r() * 0.06),
      promoDependency: Math.min(0.85, launch.promoDependency * promoJitter),
    });
  }

  return periods;
}

// Build time series map lazily
const _cache = new Map<string, WeeklyPeriod[]>();

export function getTimeSeries(upc: string): WeeklyPeriod[] {
  if (_cache.has(upc)) return _cache.get(upc)!;
  const launch = LAUNCHES.find((l) => l.upc === upc);
  if (!launch) return [];
  const series = generatePeriods(launch);
  _cache.set(upc, series);
  return series;
}

export function getAllTimeSeries(): Map<string, WeeklyPeriod[]> {
  LAUNCHES.forEach((l) => getTimeSeries(l.upc));
  return _cache;
}
