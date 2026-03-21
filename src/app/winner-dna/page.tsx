"use client";

import { useState, useMemo } from "react";
import type { Category, Retailer } from "@/lib/types";
import { CATEGORIES } from "@/data/categories";
import {
  getTopAttributesByWinRate,
  ATTR_KEYS,
  type AttrKey,
  matchesAttr,
  getAttributeDemandSignals,
  type AttributeDemandSignal,
} from "@/data/attributes";
import { LAUNCHES, getWinners } from "@/data/launches";
import { INNOVATION_TYPE_META, INNOVATION_TYPES } from "@/lib/innovation";
import { fmt$, fmtPct, scoreBg, scoreHex, OUTCOME_META, LAUNCH_OUTCOMES } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ReferenceArea,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  Label,
} from "recharts";
import { Zap, ListFilter, ShieldCheck, BarChart2, SlidersHorizontal, Info } from "lucide-react";
import { AttributeIntelligenceSection } from "@/components/winner-dna/AttributeIntelligenceSection";

const ATTR_COLORS = [
  "#2563eb","#16a34a","#7c3aed","#d97706","#0891b2","#db2777","#059669","#9333ea",
];

const SIGNAL_COLORS: Record<string, string> = {
  "Demand Driver": "#10b981",
  "Share Shift":   "#f59e0b",
  "Niche Leader":  "#3b82f6",
  "Fading":        "#94a3b8",
};

const RETAILERS: Retailer[] = ["Natural", "Conventional", "Club", "Mass"];

function medianVal(vals: number[]): number {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function halfYear(dateStr: string): string {
  const [year, month] = dateStr.split("-").map(Number);
  return `${year} ${month <= 6 ? "H1" : "H2"}`;
}

// ────────────────────────────────────────────────────────────────

export default function WinnerDNA() {
  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<"dna" | "trends">("dna");

  // ── DNA tab state ──
  const [category, setCategory] = useState<Category>("Bars");
  const [selectedAttrs, setSelectedAttrs] = useState<AttrKey[]>([]);

  // ── Trends tab state ──
  const [trendsRetailer, setTrendsRetailer] = useState<Retailer | "">("");
  const [trendsCategory, setTrendsCategory] = useState<Category | "">("");
  const [trendsSubcategory, setTrendsSubcategory] = useState<string>("");
  const [trendsBrand, setTrendsBrand] = useState<string>("");
  const [trendsShowAttrs, setTrendsShowAttrs] = useState<AttrKey[]>([]);

  // ── DNA tab data ──
  const topAttrs = useMemo(
    () => getTopAttributesByWinRate(category, 12),
    [category]
  );

  const attrScorecard = useMemo(() => {
    const catLaunches = LAUNCHES.filter((l) => l.category === category);
    const catWinners  = getWinners(catLaunches);
    const catWinRate  = catLaunches.length ? catWinners.length / catLaunches.length : 0;
    const catAvgVelocity = catLaunches.length
      ? catLaunches.reduce((s, l) => s + l.velocityLatest, 0) / catLaunches.length
      : 0;

    return ATTR_KEYS.map((attr) => {
      const withAttr    = catLaunches.filter((l) => matchesAttr(l, attr));
      const attrWinners = getWinners(withAttr);
      const winRate     = withAttr.length ? attrWinners.length / withAttr.length : 0;
      const survived26  = withAttr.filter((l) => l.survived26w !== null);
      const survivalRate = survived26.length
        ? survived26.filter((l) => l.survived26w).length / survived26.length
        : 0;
      const priceIdx = withAttr.length
        ? withAttr.reduce((s, l) => s + l.priceIndexVsCategory, 0) / withAttr.length
        : 1;
      const promoDep = withAttr.length
        ? withAttr.reduce((s, l) => s + l.promoDependency, 0) / withAttr.length
        : 0;
      const velIdx = withAttr.length > 0 && catAvgVelocity > 0
        ? (withAttr.reduce((s, l) => s + l.velocityLatest, 0) / withAttr.length) / catAvgVelocity
        : 1;
      return { attr, count: withAttr.length, winRate, survivalRate, priceIdx, promoDep, catWinRate, velIdx };
    }).sort((a, b) => b.winRate - a.winRate);
  }, [category]);

  const barData = topAttrs.map((a) => ({
    name: `${a.attributeName}`,
    winRate: Math.round(a.winRate * 100),
    overindex: +(a.overindexVsAll.toFixed(2)),
    launches: a.launchCount,
  }));

  const formData = useMemo(() => {
    const catLaunches = LAUNCHES.filter((l) => l.category === category);
    const catWinners  = getWinners(catLaunches);
    const catWinRate  = catLaunches.length ? catWinners.length / catLaunches.length : 0;
    const totalDollars = catLaunches.reduce((s, l) => s + l.dollarsLatest, 0);

    const formMap = new Map<string, { total: number; winners: number; dollars: number }>();
    catLaunches.forEach((l) => {
      const f = l.attributes.form;
      if (!formMap.has(f)) formMap.set(f, { total: 0, winners: 0, dollars: 0 });
      const entry = formMap.get(f)!;
      entry.total += 1;
      entry.dollars += l.dollarsLatest;
      if (l.launchQualityScore >= 70) entry.winners += 1;
    });

    return Array.from(formMap.entries())
      .map(([form, { total, winners, dollars }]) => ({
        form,
        count: total,
        winRate: total > 0 ? winners / total : 0,
        lift: catWinRate > 0 ? (total > 0 ? winners / total : 0) / catWinRate : 1,
        dollarShare: totalDollars > 0 ? dollars / totalDollars : 0,
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }, [category]);

  const funcIngredData = useMemo(() => {
    const catLaunches = LAUNCHES.filter((l) => l.category === category);
    const catWinRate  = catLaunches.length
      ? getWinners(catLaunches).length / catLaunches.length
      : 0;

    const ingredMap = new Map<string, { total: number; winners: number; velocitySum: number }>();
    catLaunches
      .filter((l) => l.attributes.functionalIngredient !== null)
      .forEach((l) => {
        const k = l.attributes.functionalIngredient!;
        if (!ingredMap.has(k)) ingredMap.set(k, { total: 0, winners: 0, velocitySum: 0 });
        const e = ingredMap.get(k)!;
        e.total += 1;
        e.velocitySum += l.velocityLatest;
        if (l.launchQualityScore >= 70) e.winners += 1;
      });

    return Array.from(ingredMap.entries())
      .map(([ingred, { total, winners, velocitySum }]) => ({
        ingred,
        count: total,
        winRate: total > 0 ? winners / total : 0,
        lift: catWinRate > 0 ? (total > 0 ? winners / total : 0) / catWinRate : 1,
        avgVelocity: total > 0 ? velocitySum / total : 0,
      }))
      .sort((a, b) => b.lift - a.lift);
  }, [category]);

  const comboTableData = useMemo(() => {
    const catLaunches = LAUNCHES.filter(l => l.category === category);
    const catWinners  = getWinners(catLaunches);
    const catBaseline = catLaunches.length ? catWinners.length / catLaunches.length : 0;

    const rows: { label: string; count: number; winRate: number; lift: number; attrCount: number }[] = [];

    // 2-attribute pairs
    for (let i = 0; i < ATTR_KEYS.length; i++) {
      for (let j = i + 1; j < ATTR_KEYS.length; j++) {
        const a = ATTR_KEYS[i];
        const b = ATTR_KEYS[j];
        const withBoth = catLaunches.filter(l => matchesAttr(l, a) && matchesAttr(l, b));
        const winRate  = withBoth.length ? getWinners(withBoth).length / withBoth.length : 0;
        const lift     = catBaseline > 0 ? winRate / catBaseline : 1;
        rows.push({ label: `${a} + ${b}`, count: withBoth.length, winRate, lift, attrCount: 2 });
      }
    }

    // 3-attribute triples
    for (let i = 0; i < ATTR_KEYS.length - 2; i++) {
      for (let j = i + 1; j < ATTR_KEYS.length - 1; j++) {
        for (let k = j + 1; k < ATTR_KEYS.length; k++) {
          const a1 = ATTR_KEYS[i] as string, a2 = ATTR_KEYS[j] as string, a3 = ATTR_KEYS[k] as string;
          const matching = catLaunches.filter(
            (l) => matchesAttr(l, a1 as any) && matchesAttr(l, a2 as any) && matchesAttr(l, a3 as any)
          );
          if (matching.length < 2) continue;
          const winners = matching.filter((l) => l.launchQualityScore >= 70);
          const wr = winners.length / matching.length;
          rows.push({
            label: [a1, a2, a3].join(" + "),
            count: matching.length,
            winRate: wr,
            lift: +(wr / catBaseline).toFixed(2),
            attrCount: 3,
          });
        }
      }
    }

    return rows.sort((a, b) => b.lift - a.lift).slice(0, 15);
  }, [category]);

  const explorerData = useMemo(() => {
    const catLaunches = LAUNCHES.filter(l => l.category === category);
    const catWinners  = getWinners(catLaunches);
    const catWinRate  = catLaunches.length ? catWinners.length / catLaunches.length : 0;

    const matched = selectedAttrs.length === 0
      ? catLaunches
      : catLaunches.filter(l => selectedAttrs.every(a => matchesAttr(l, a)));
    const matchedWinners = getWinners(matched);
    const comboWinRate   = matched.length ? matchedWinners.length / matched.length : 0;
    const lift           = catWinRate > 0 ? comboWinRate / catWinRate : 1;
    const med26w         = medianVal(matched.filter(l => l.dollars26w != null).map(l => l.dollars26w!));

    const singleStats = ATTR_KEYS.map(attr => {
      const sub    = catLaunches.filter(l => matchesAttr(l, attr));
      const subWin = getWinners(sub);
      return { attr, winRate: sub.length ? subWin.length / sub.length : 0, count: sub.length };
    });

    const chartData: { name: string; winRate: number; isCombo: boolean }[] = ATTR_KEYS.map((attr, i) => ({
      name: attr,
      winRate: Math.round(singleStats[i].winRate * 100),
      isCombo: false,
    }));
    if (selectedAttrs.length >= 1) {
      chartData.push({ name: "Combination ★", winRate: Math.round(comboWinRate * 100), isCombo: true });
    }

    const topMatched = [...matched]
      .sort((a, b) => b.launchQualityScore - a.launchQualityScore)
      .slice(0, 10);

    return { catLaunches, catWinRate, matched, comboWinRate, lift, med26w, singleStats, chartData, topMatched };
  }, [selectedAttrs, category]);

  function toggleAttr(attr: AttrKey) {
    setSelectedAttrs(prev =>
      prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]
    );
  }

  const liftColor = explorerData.lift >= 2
    ? "text-green-600"
    : explorerData.lift >= 1.5
    ? "text-amber-600"
    : "text-slate-700";
  const winRateColor = explorerData.comboWinRate > explorerData.catWinRate
    ? "text-green-600"
    : "text-slate-700";

  const lifecycleData = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const catL = LAUNCHES.filter((l) => l.category === cat);
      const row: Record<string, number | string> = { category: cat };
      LAUNCH_OUTCOMES.forEach((o) => {
        row[o] = catL.filter((l) => l.launchOutcome === o).length;
      });
      return row;
    });
  }, []);

  const innovationData = useMemo(() => {
    const catLaunches = LAUNCHES.filter((l) => l.category === category);
    return INNOVATION_TYPES
      .filter((t) => t !== "Unclassified")
      .map((type) => {
        const group = catLaunches.filter((l) => l.innovationType === type);
        const withOutcome = group.filter((l) =>
          l.launchOutcome !== "Early Stage" && l.launchOutcome !== "Year 1"
        );
        const winRate = withOutcome.length > 0
          ? withOutcome.filter((l) =>
              l.launchOutcome === "Successful" || l.launchOutcome === "Sustaining"
            ).length / withOutcome.length
          : 0;
        const avgScore = group.length > 0
          ? group.reduce((s, l) => s + l.launchQualityScore, 0) / group.length
          : 0;
        const meta = INNOVATION_TYPE_META[type];
        return {
          type,
          label: meta.shortLabel,
          fullLabel: meta.label,
          count: group.length,
          winRate: Math.round(winRate * 100),
          avgScore: Math.round(avgScore),
          color: meta.chartColor,
          pct: catLaunches.length > 0
            ? Math.round((group.length / catLaunches.length) * 100)
            : 0,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [category]);

  // ── Trends tab data ──

  const trendsFiltered = useMemo(() => {
    return LAUNCHES.filter((l) => {
      if (trendsRetailer && l.retailer !== trendsRetailer) return false;
      if (trendsCategory && l.category !== trendsCategory) return false;
      if (trendsSubcategory && l.subcategory !== trendsSubcategory) return false;
      if (trendsBrand && l.brand !== trendsBrand) return false;
      return true;
    });
  }, [trendsRetailer, trendsCategory, trendsSubcategory, trendsBrand]);

  const trendsSubcategoryOptions = useMemo(() => {
    const base = LAUNCHES.filter((l) => {
      if (trendsRetailer && l.retailer !== trendsRetailer) return false;
      if (trendsCategory && l.category !== trendsCategory) return false;
      return true;
    });
    return [...new Set(base.map((l) => l.subcategory))].sort();
  }, [trendsRetailer, trendsCategory]);

  const trendsBrandOptions = useMemo(() => {
    const base = LAUNCHES.filter((l) => {
      if (trendsRetailer && l.retailer !== trendsRetailer) return false;
      if (trendsCategory && l.category !== trendsCategory) return false;
      if (trendsSubcategory && l.subcategory !== trendsSubcategory) return false;
      return true;
    });
    return [...new Set(base.map((l) => l.brand))].sort();
  }, [trendsRetailer, trendsCategory, trendsSubcategory]);

  const trendsAttrData = useMemo(() => {
    const total = trendsFiltered.length;
    if (total === 0) return ATTR_KEYS.map((attr) => ({ attr, count: 0, share: 0, dollarSize: 0, shareGrowth: 0, dollarGrowth: 0, trend: "flat" as const }));

    const snapshot = new Date("2026-03-08");
    const recentCutoff = new Date(snapshot);
    recentCutoff.setMonth(recentCutoff.getMonth() - 9);
    const priorCutoff = new Date(recentCutoff);
    priorCutoff.setMonth(priorCutoff.getMonth() - 9);

    const recentAll = trendsFiltered.filter((l) => new Date(l.firstSeenDate) >= recentCutoff);
    const priorAll = trendsFiltered.filter(
      (l) => new Date(l.firstSeenDate) >= priorCutoff && new Date(l.firstSeenDate) < recentCutoff
    );

    const recentDollarTotal = recentAll.reduce((s, l) => s + l.dollarsLatest, 0);
    const priorDollarTotal = priorAll.reduce((s, l) => s + l.dollarsLatest, 0);

    const attrsToCompute = trendsShowAttrs.length > 0 ? trendsShowAttrs : ATTR_KEYS;

    return attrsToCompute.map((attr) => {
      const withAttr = trendsFiltered.filter((l) => matchesAttr(l, attr));
      const share = total > 0 ? withAttr.length / total : 0;
      const dollarSize = withAttr.reduce((s, l) => s + l.dollarsLatest, 0);

      const recentWithAttr = recentAll.filter((l) => matchesAttr(l, attr));
      const priorWithAttr = priorAll.filter((l) => matchesAttr(l, attr));

      const recentShare = recentAll.length > 0 ? recentWithAttr.length / recentAll.length : 0;
      const priorShare = priorAll.length > 0 ? priorWithAttr.length / priorAll.length : 0;
      const shareGrowth = recentShare - priorShare;

      const recentDollarShare = recentDollarTotal > 0 ? recentWithAttr.reduce((s, l) => s + l.dollarsLatest, 0) / recentDollarTotal : 0;
      const priorDollarShare = priorDollarTotal > 0 ? priorWithAttr.reduce((s, l) => s + l.dollarsLatest, 0) / priorDollarTotal : 0;
      const dollarGrowth = priorDollarShare > 0 ? (recentDollarShare - priorDollarShare) / priorDollarShare : 0;

      const trend: "up" | "flat" | "down" = shareGrowth > 0.02 ? "up" : shareGrowth < -0.02 ? "down" : "flat";

      return { attr, count: withAttr.length, share, dollarSize, shareGrowth, dollarGrowth, trend };
    });
  }, [trendsFiltered, trendsShowAttrs]);

  const trendChartData = useMemo(() => {
    const periods = [...new Set(LAUNCHES.map((l) => halfYear(l.launchCohortMonth)))].sort();
    const attrsToShow = trendsShowAttrs.length > 0 ? trendsShowAttrs : ATTR_KEYS.slice(0, 4);
    return periods.map((period) => {
      const periodLaunches = trendsFiltered.filter(
        (l) => halfYear(l.launchCohortMonth) === period
      );
      const tot = periodLaunches.length;
      const row: Record<string, number | string> = { period };
      attrsToShow.forEach((attr) => {
        const cnt = periodLaunches.filter((l) => matchesAttr(l, attr)).length;
        row[attr] = tot > 0 ? Math.round((cnt / tot) * 100) : 0;
      });
      return row;
    });
  }, [trendsFiltered, trendsShowAttrs]);

  const trendsCombinationLaunches = useMemo(() => {
    if (trendsShowAttrs.length < 2) return [];
    return trendsFiltered
      .filter((l) => trendsShowAttrs.every((a) => matchesAttr(l, a)))
      .sort((a, b) => b.velocityLatest - a.velocityLatest);
  }, [trendsFiltered, trendsShowAttrs]);

  const demandSignals = useMemo(
    () => getAttributeDemandSignals(trendsCategory || null),
    [trendsCategory]
  );

  function toggleTrendsAttr(attr: AttrKey) {
    setTrendsShowAttrs((prev) =>
      prev.includes(attr) ? prev.filter((a) => a !== attr) : [...prev, attr]
    );
  }

  const chartAttrsToShow = trendsShowAttrs.length > 0 ? trendsShowAttrs : ATTR_KEYS.slice(0, 4);

  // Baseline win rate % for the Attribute Win Rate chart tooltip
  const baselineWinRatePct = attrScorecard.length > 0 ? Math.round(attrScorecard[0].catWinRate * 100) : 0;

  // Custom tooltip for Attribute Win Rate chart
  const AttrWinRateTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm text-xs max-w-[200px]">
        <p className="font-semibold text-slate-700 mb-1">{d.name}</p>
        <p className="text-slate-600">
          <span className="font-medium text-green-600">{d.winRate}%</span> of {category} launches
          with this attribute reach quality score ≥ 70
        </p>
        <p className="text-slate-400 mt-1">
          {d.overindex}× the {category} average ({baselineWinRatePct}%)
        </p>
        <p className="text-slate-400">Based on {d.launches} launches</p>
      </div>
    );
  };

  // ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Tab switcher */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 flex items-center gap-1 w-fit">
        <button
          onClick={() => setActiveTab("dna")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "dna"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          Attribute DNA
        </button>
        <button
          onClick={() => setActiveTab("trends")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
            activeTab === "trends"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <SlidersHorizontal size={13} />
          Attribute Trends
        </button>
      </div>

      {/* ═══════════════════════════════════════════ DNA TAB ══════════════════════════════════════════ */}
      {activeTab === "dna" && (
        <>
          {/* Category filter bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">Category:</span>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    category === c
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Attribute Win Rate */}
            <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-1">
                Attribute Win Rate — {category}
              </h2>
              <p className="text-xs text-slate-400 mb-3">
                Win rate = % of launches with this attribute that achieve quality score ≥ 70. Overindex = vs. category baseline.
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={barData} layout="vertical" margin={{ left: 12, right: 60, top: 0, bottom: 20 }}>
                  <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]}>
                    <Label value="Win Rate (%)" position="insideBottom" offset={-4} style={{ fontSize: 10, fill: '#94a3b8' }} />
                  </XAxis>
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
                  <Tooltip content={<AttrWinRateTooltip />} />
                  <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                    {barData.map((_, idx) => (
                      <Cell key={idx} fill={ATTR_COLORS[idx % ATTR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Attribute Scorecard */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={14} className="text-blue-500" />
                <h2 className="text-sm font-semibold text-slate-700">Attribute Scorecard</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Win rate, survival, price premium &amp; promo dependency per claim — {category}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left pb-2 text-slate-400 font-medium">Attribute</th>
                      <th className="text-right pb-2 text-slate-400 font-medium">#</th>
                      <th className="text-right pb-2 text-slate-400 font-medium">Win%</th>
                      <th className="text-right pb-2 text-slate-400 font-medium">Surv@26w</th>
                      <th className="text-right pb-2 text-slate-400 font-medium">Price</th>
                      <th className="text-right pb-2 text-slate-400 font-medium">Promo</th>
                      <th className="text-right pb-2 text-slate-400 font-medium">Vel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attrScorecard.map((row) => {
                      const wrColor = row.winRate >= row.catWinRate + 0.05
                        ? "text-green-600 font-semibold"
                        : row.winRate >= row.catWinRate - 0.05
                        ? "text-slate-600"
                        : "text-red-500";
                      const survColor = row.survivalRate >= 0.7
                        ? "text-green-600 font-semibold"
                        : row.survivalRate >= 0.5
                        ? "text-amber-600"
                        : "text-red-500";
                      const priceColor = row.priceIdx > 1.1
                        ? "text-green-600 font-semibold"
                        : row.priceIdx < 0.9
                        ? "text-amber-600"
                        : "text-slate-600";
                      const promoColor = row.promoDep < 0.2
                        ? "text-green-600 font-semibold"
                        : row.promoDep <= 0.35
                        ? "text-amber-600"
                        : "text-red-500";
                      const velColor = row.velIdx >= 1.15
                        ? "text-green-600 font-semibold"
                        : row.velIdx >= 0.85
                        ? "text-slate-500"
                        : "text-amber-600";
                      return (
                        <tr key={row.attr} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-2 text-slate-700 font-medium">{row.attr}</td>
                          <td className="py-2 text-right text-slate-400">{row.count}</td>
                          <td className={`py-2 text-right ${wrColor}`}>{Math.round(row.winRate * 100)}%</td>
                          <td className={`py-2 text-right ${survColor}`}>
                            {row.survivalRate > 0 ? Math.round(row.survivalRate * 100) + "%" : "—"}
                          </td>
                          <td className={`py-2 text-right ${priceColor}`}>{row.priceIdx.toFixed(2)}×</td>
                          <td className={`py-2 text-right ${promoColor}`}>{fmtPct(row.promoDep, 0)}</td>
                          <td className={`py-2 text-right ${velColor}`}>{row.velIdx.toFixed(2)}×</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200">
                      <td colSpan={2} className="pt-2 text-[10px] text-slate-400">Category baseline</td>
                      <td className="pt-2 text-right text-[10px] text-slate-500 font-medium">
                        {attrScorecard.length > 0 ? Math.round(attrScorecard[0].catWinRate * 100) + "%" : "—"}
                      </td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-400">
                <span><span className="text-green-600 font-semibold">Green</span> = above threshold</span>
                <span><span className="text-amber-600">Amber</span> = mid range</span>
                <span><span className="text-red-500">Red</span> = watch</span>
              </div>
            </div>
          </div>

          {/* Attribute Combination Performance table */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={14} className="text-blue-500" />
              <h2 className="text-sm font-semibold text-slate-700">Attribute Combination Performance — {category}</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Two- and three-attribute combinations ranked by win-rate lift vs. category baseline. Computed live from {category} launches.
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left pb-2 text-slate-400 font-medium">Combination</th>
                  <th className="text-right pb-2 text-slate-400 font-medium"># Launches</th>
                  <th className="text-right pb-2 text-slate-400 font-medium">
                    Success Rate{" "}
                    <span title="% of launches with this combination that achieve quality score ≥ 70">
                      <Info size={12} className="inline mb-0.5 text-slate-400" />
                    </span>
                  </th>
                  <th className="text-right pb-2 text-slate-400 font-medium">Lift</th>
                  <th className="text-right pb-2 text-slate-400 font-medium">vs. Baseline</th>
                </tr>
              </thead>
              <tbody>
                {comboTableData.map((row, i) => {
                  const liftColor = row.lift >= 2 ? "text-green-600 font-semibold" : row.lift >= 1.3 ? "text-amber-600" : "text-slate-500";
                  const diffPct   = Math.round((row.winRate - (comboTableData[0]?.lift > 0 ? comboTableData[0].winRate / comboTableData[0].lift : 0)) * 100);
                  return (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 text-slate-700 font-medium">
                        {row.label}
                        {row.attrCount === 2
                          ? <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded ml-1">2</span>
                          : <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1 rounded ml-1">3</span>
                        }
                      </td>
                      <td className="py-2 text-right text-slate-400">{row.count}</td>
                      <td className="py-2 text-right text-green-600 font-semibold">{Math.round(row.winRate * 100)}%</td>
                      <td className={`py-2 text-right ${liftColor}`}>{row.lift.toFixed(1)}×</td>
                      <td className="py-2 text-right text-slate-400">{diffPct >= 0 ? "+" : ""}{diffPct}pp</td>
                    </tr>
                  );
                })}
                {comboTableData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 text-xs italic">
                      Not enough data to compute combinations for this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Form Factor + Functional Ingredient panels */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 size={14} className="text-blue-500" />
                <h2 className="text-sm font-semibold text-slate-700">Form Factor Win Rate — {category}</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Win rate and dollar share by product form · sorted by win rate
              </p>
              <ResponsiveContainer width="100%" height={Math.max(180, formData.length * 32)}>
                <BarChart data={formData} layout="vertical" margin={{ left: 8, right: 56, top: 0, bottom: 0 }}>
                  <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 1]} />
                  <YAxis type="category" dataKey="form" tick={{ fontSize: 11 }} width={96} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: any, name: any) =>
                      name === "winRate" ? [`${Math.round(v * 100)}%`, "Win Rate"] : [`${Math.round(v * 100)}%`, "Dollar Share"]
                    }
                    contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="winRate" radius={[0, 4, 4, 0]} name="winRate">
                    {formData.map((d, idx) => (
                      <Cell key={idx} fill={d.winRate >= 0.4 ? "#16a34a" : d.winRate >= 0.25 ? "#2563eb" : "#cbd5e1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left pb-1.5 text-slate-400 font-medium">Form</th>
                      <th className="text-right pb-1.5 text-slate-400 font-medium">#</th>
                      <th className="text-right pb-1.5 text-slate-400 font-medium">Win%</th>
                      <th className="text-right pb-1.5 text-slate-400 font-medium">Lift</th>
                      <th className="text-right pb-1.5 text-slate-400 font-medium">$Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.map((row) => (
                      <tr key={row.form} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-1.5 text-slate-700 font-medium truncate max-w-[110px]">{row.form}</td>
                        <td className="py-1.5 text-right text-slate-400">{row.count}</td>
                        <td className={`py-1.5 text-right font-semibold ${row.winRate >= 0.3 ? "text-green-600" : "text-slate-500"}`}>
                          {Math.round(row.winRate * 100)}%
                        </td>
                        <td className={`py-1.5 text-right ${row.lift >= 1.5 ? "text-green-600 font-semibold" : row.lift >= 1 ? "text-slate-600" : "text-amber-600"}`}>
                          {row.lift.toFixed(1)}×
                        </td>
                        <td className="py-1.5 text-right text-slate-400">{Math.round(row.dollarShare * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-blue-500" />
                <h2 className="text-sm font-semibold text-slate-700">Functional Ingredient Performance — {category}</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Launches featuring a functional ingredient · ranked by win-rate lift vs. category baseline
              </p>
              {funcIngredData.length === 0 ? (
                <div className="text-xs text-slate-400 italic text-center py-8">
                  No launches with functional ingredients in {category}.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left pb-2 text-slate-400 font-medium">Ingredient</th>
                        <th className="text-right pb-2 text-slate-400 font-medium">#</th>
                        <th className="text-right pb-2 text-slate-400 font-medium">Win%</th>
                        <th className="text-right pb-2 text-slate-400 font-medium">Lift</th>
                        <th className="text-right pb-2 text-slate-400 font-medium">Avg Vel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funcIngredData.map((row) => {
                        const liftColor = row.lift >= 2 ? "text-green-600 font-semibold" : row.lift >= 1.3 ? "text-amber-600" : "text-slate-500";
                        const wrColor  = row.winRate >= 0.4 ? "text-green-600 font-semibold" : "text-slate-600";
                        return (
                          <tr key={row.ingred} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-2 text-slate-700 font-medium">{row.ingred}</td>
                            <td className="py-2 text-right text-slate-400">{row.count}</td>
                            <td className={`py-2 text-right ${wrColor}`}>{Math.round(row.winRate * 100)}%</td>
                            <td className={`py-2 text-right ${liftColor}`}>{row.lift.toFixed(1)}×</td>
                            <td className="py-2 text-right text-slate-600 font-medium">{fmt$(row.avgVelocity)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Attribute Combination Explorer */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <ListFilter size={14} className="text-blue-500 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-700">Attribute Combination Explorer</h2>
                  <p className="text-xs text-slate-400">
                    Select attributes to see how combinations compound win rates vs. individual attributes
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap mb-4">
              {ATTR_KEYS.map(attr => (
                <button
                  key={attr}
                  onClick={() => toggleAttr(attr)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedAttrs.includes(attr)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                  }`}
                >
                  {attr}
                </button>
              ))}
              {selectedAttrs.length > 0 && (
                <button
                  onClick={() => setSelectedAttrs([])}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-600 border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {selectedAttrs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 text-slate-400 text-sm gap-2">
                <ListFilter size={20} className="opacity-30" />
                <span>Select one or more attributes above to explore how combinations affect win rates</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Matching Launches</div>
                    <div className="text-xl font-bold text-slate-700 leading-tight">
                      {explorerData.matched.length}
                      <span className="text-xs font-normal text-slate-400 ml-1">/ {explorerData.catLaunches.length}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">in {category}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Win Rate</div>
                    <div className={`text-xl font-bold leading-tight ${winRateColor}`}>
                      {Math.round(explorerData.comboWinRate * 100)}%
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      baseline {Math.round(explorerData.catWinRate * 100)}%
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Lift vs. Baseline</div>
                    <div className={`text-xl font-bold leading-tight ${liftColor}`}>
                      {explorerData.lift.toFixed(1)}×
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {selectedAttrs.length} attribute{selectedAttrs.length > 1 ? "s" : ""} combined
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Median $26w</div>
                    <div className="text-xl font-bold text-slate-700 leading-tight">
                      {fmt$(explorerData.med26w)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">for matching launches</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
                  <div className="xl:col-span-3">
                    <p className="text-xs text-slate-500 font-medium mb-2">
                      Win rate comparison — individual attributes vs. combination
                      <span className="ml-1 text-slate-400 font-normal">(dashed = category baseline)</span>
                    </p>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={explorerData.chartData} layout="vertical" margin={{ left: 8, right: 44, top: 0, bottom: 0 }}>
                        <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v: any) => [`${v}%`, "Win Rate"]} contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }} />
                        <ReferenceLine
                          x={Math.round(explorerData.catWinRate * 100)}
                          stroke="#94a3b8"
                          strokeDasharray="4 3"
                          label={{ value: "baseline", position: "insideTopRight", fontSize: 9, fill: "#94a3b8" }}
                        />
                        <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                          {explorerData.chartData.map((d, idx) => (
                            <Cell key={idx} fill={d.isCombo ? "#2563eb" : "#cbd5e1"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="xl:col-span-2">
                    <p className="text-xs text-slate-500 font-medium mb-2">
                      Matching launches — top by quality score
                    </p>
                    {explorerData.matched.length === 0 ? (
                      <div className="text-xs text-slate-400 italic">
                        No launches match this combination in {category}.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {explorerData.topMatched.map(l => (
                          <div key={l.upc} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-slate-700 truncate leading-tight">{l.description}</div>
                              <div className="text-[10px] text-slate-400 leading-tight">{l.brand}</div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${scoreBg(l.launchQualityScore)}`}>
                                {l.launchQualityScore}
                              </span>
                              {l.dollars26w != null && (
                                <span className="text-[10px] text-slate-500">{fmt$(l.dollars26w)}</span>
                              )}
                              {l.survived26w && (
                                <span className="text-[10px] text-green-600 font-semibold">✓26w</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Innovation Type Performance */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-0.5">
              Innovation Type Performance
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Win rates and launch mix by innovation type — {category}
            </p>

            {innovationData.every((d) => d.count === 0) ? (
              <p className="text-xs text-slate-400 italic">No data for current filter selection.</p>
            ) : (
              <div className="grid grid-cols-2 gap-6">

                {/* Left panel: Launch mix */}
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-3">Launch Mix</div>
                  <div className="space-y-2">
                    {innovationData.map((d) => (
                      <div key={d.type} className="flex items-center gap-2">
                        <div className="w-20 shrink-0 text-xs text-slate-600 truncate">{d.label}</div>
                        <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${d.pct}%`,
                              backgroundColor: d.color,
                              minWidth: d.count > 0 ? "4px" : "0",
                            }}
                          />
                        </div>
                        <div className="w-16 text-right text-xs text-slate-500 shrink-0">
                          {d.count} <span className="text-slate-400">({d.pct}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right panel: Win rate by type */}
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-3">Success Rate (Y2+)</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart
                      data={innovationData}
                      layout="vertical"
                      margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
                    >
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
                      <Tooltip
                        formatter={(v: any) => [`${v}%`, "Success Rate"]}
                        contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }}
                      />
                      <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                        {innovationData.map((d) => (
                          <Cell key={d.type} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Only launches with Y2+ data (≥104w) included in success rate
                  </p>
                </div>

              </div>
            )}
          </div>

          {/* Launch Lifecycle Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-0.5">Launch Lifecycle Distribution</h3>
            <p className="text-xs text-slate-400 mb-4">
              How launches distribute across lifecycle stages — all categories
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={lifecycleData} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {LAUNCH_OUTCOMES.map((o) => (
                  <Bar key={o} dataKey={o} stackId="a" fill={OUTCOME_META[o].hex} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-3">
              {LAUNCH_OUTCOMES.map((o) => (
                <div key={o} className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: OUTCOME_META[o].hex }} />
                  {OUTCOME_META[o].label}
                </div>
              ))}
            </div>
          </div>

        </>
      )}

      {/* ════════════════════════════════════════ ATTRIBUTE TRENDS TAB ════════════════════════════════════════ */}
      {activeTab === "trends" && (
        <div className="space-y-5">
          {/* Filter Panel */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <SlidersHorizontal size={14} className="text-blue-500" />
              <h2 className="text-sm font-semibold text-slate-700">Filters</h2>
              <span className="text-[10px] text-slate-400 ml-auto">
                {trendsFiltered.length} of {LAUNCHES.length} launches
              </span>
            </div>

            {/* Retailer */}
            <div className="flex items-start gap-3 flex-wrap">
              <span className="text-xs text-slate-500 font-medium mt-1 w-20 shrink-0">Channel:</span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => { setTrendsRetailer(""); setTrendsSubcategory(""); setTrendsBrand(""); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    !trendsRetailer ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >All</button>
                {RETAILERS.map((r) => (
                  <button
                    key={r}
                    onClick={() => { setTrendsRetailer(r); setTrendsSubcategory(""); setTrendsBrand(""); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      trendsRetailer === r ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >{r}</button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="flex items-start gap-3 flex-wrap">
              <span className="text-xs text-slate-500 font-medium mt-1 w-20 shrink-0">Category:</span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => { setTrendsCategory(""); setTrendsSubcategory(""); setTrendsBrand(""); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    !trendsCategory ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >All</button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setTrendsCategory(c); setTrendsSubcategory(""); setTrendsBrand(""); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      trendsCategory === c ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >{c}</button>
                ))}
              </div>
            </div>

            {/* Subcategory + Brand */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Subcategory:</span>
                <select
                  value={trendsSubcategory}
                  onChange={(e) => { setTrendsSubcategory(e.target.value); setTrendsBrand(""); }}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
                >
                  <option value="">All</option>
                  {trendsSubcategoryOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Brand:</span>
                <select
                  value={trendsBrand}
                  onChange={(e) => setTrendsBrand(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
                >
                  <option value="">All</option>
                  {trendsBrandOptions.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              {(trendsRetailer || trendsCategory || trendsSubcategory || trendsBrand || trendsShowAttrs.length > 0) && (
                <button
                  onClick={() => {
                    setTrendsRetailer(""); setTrendsCategory(""); setTrendsSubcategory("");
                    setTrendsBrand(""); setTrendsShowAttrs([]);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Reset all
                </button>
              )}
            </div>

            {/* Attribute selector */}
            <div className="flex items-start gap-3 flex-wrap">
              <span className="text-xs text-slate-500 font-medium mt-1 w-20 shrink-0">Attributes:</span>
              <div className="flex gap-1.5 flex-wrap">
                {ATTR_KEYS.map((attr, i) => (
                  <button
                    key={attr}
                    onClick={() => toggleTrendsAttr(attr)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      trendsShowAttrs.includes(attr)
                        ? "text-white border-transparent"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                    }`}
                    style={trendsShowAttrs.includes(attr) ? { backgroundColor: ATTR_COLORS[i % ATTR_COLORS.length] } : {}}
                  >
                    {attr}
                  </button>
                ))}
                {trendsShowAttrs.length > 0 && (
                  <button
                    onClick={() => setTrendsShowAttrs([])}
                    className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-600 border border-slate-200"
                  >
                    Show all
                  </button>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-1.5">
                {trendsShowAttrs.length === 0 ? "Showing all 6 attributes" : `${trendsShowAttrs.length} selected`}
                {trendsShowAttrs.length >= 2 && " · combination view below"}
              </span>
            </div>
          </div>

          {/* Metrics Table + Trend Chart */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Attribute Metrics Table */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-1">Attribute Metrics</h2>
              <p className="text-xs text-slate-400 mb-4">
                Share, dollar size, and growth vs. prior 9-month period · filtered market
              </p>
              {trendsFiltered.length === 0 ? (
                <div className="text-xs text-slate-400 italic text-center py-8">
                  No launches match the selected filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left pb-2 text-slate-400 font-medium">Attribute</th>
                        <th className="text-right pb-2 text-slate-400 font-medium">#</th>
                        <th className="text-right pb-2 text-slate-400 font-medium">Share</th>
                        <th className="text-right pb-2 text-slate-400 font-medium">$ Size</th>
                        <th className="text-right pb-2 text-slate-400 font-medium">$ Δ</th>
                        <th className="text-right pb-2 text-slate-400 font-medium">Shr Δ</th>
                        <th className="text-center pb-2 text-slate-400 font-medium">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendsAttrData.map((row, i) => {
                        const attrColor = ATTR_COLORS[
                          (trendsShowAttrs.length > 0 ? trendsShowAttrs : ATTR_KEYS).indexOf(row.attr) % ATTR_COLORS.length
                        ];
                        const dollarGrowthColor = row.dollarGrowth > 0.05 ? "text-green-600 font-semibold" : row.dollarGrowth < -0.05 ? "text-red-500" : "text-slate-500";
                        const shareGrowthColor = row.shareGrowth > 0.02 ? "text-green-600 font-semibold" : row.shareGrowth < -0.02 ? "text-red-500" : "text-slate-500";
                        return (
                          <tr key={row.attr} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: attrColor }} />
                                <span className="font-medium text-slate-700">{row.attr}</span>
                              </div>
                            </td>
                            <td className="py-2 text-right text-slate-400">{row.count}</td>
                            <td className="py-2 text-right text-slate-600 font-medium tabular-nums">
                              {Math.round(row.share * 100)}%
                            </td>
                            <td className="py-2 text-right text-slate-600 tabular-nums">
                              {fmt$(row.dollarSize)}
                            </td>
                            <td className={`py-2 text-right tabular-nums ${dollarGrowthColor}`}>
                              {row.dollarGrowth > 0 ? "+" : ""}{Math.round(row.dollarGrowth * 100)}%
                            </td>
                            <td className={`py-2 text-right tabular-nums ${shareGrowthColor}`}>
                              {row.shareGrowth > 0 ? "+" : ""}{(row.shareGrowth * 100).toFixed(1)}pp
                            </td>
                            <td className="py-2 text-center">
                              {row.trend === "up" ? (
                                <span className="text-green-600 font-bold">▲</span>
                              ) : row.trend === "down" ? (
                                <span className="text-red-500 font-bold">▼</span>
                              ) : (
                                <span className="text-slate-400">→</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-slate-400 mt-3">
                    Δ columns compare recent 9-month cohort vs. prior 9-month cohort
                  </p>
                </div>
              )}
            </div>

            {/* Penetration Trend Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-1">Attribute Penetration Over Time</h2>
              <p className="text-xs text-slate-400 mb-4">
                % of filtered launches carrying each attribute · by cohort half-year
                {trendsShowAttrs.length === 0 && <span className="ml-1">(top 4 shown)</span>}
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                    width={34}
                  />
                  <Tooltip
                    formatter={(v: any, name: any) => [`${v}%`, name]}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {chartAttrsToShow.map((attr, i) => (
                    <Line
                      key={attr}
                      type="monotone"
                      dataKey={attr}
                      stroke={ATTR_COLORS[i % ATTR_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Combination View — only when 2+ attrs selected */}
          {trendsShowAttrs.length >= 2 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-blue-500" />
                <h2 className="text-sm font-semibold text-slate-700">
                  Combination View: {trendsShowAttrs.join(" + ")}
                </h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Products carrying ALL selected attributes — with individual attribute context
              </p>

              {/* Individual attr mini-cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
                {trendsAttrData.map((row, i) => {
                  const color = ATTR_COLORS[i % ATTR_COLORS.length];
                  return (
                    <div key={row.attr} className="rounded-lg p-2.5 border border-slate-100 bg-slate-50 text-center">
                      <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{row.attr}</div>
                      <div className="text-base font-bold text-slate-700">{Math.round(row.share * 100)}%</div>
                      <div className="text-[9px] text-slate-400">share</div>
                      <div className="text-[9px] mt-0.5" style={{ color }}>
                        {row.trend === "up" ? "▲ rising" : row.trend === "down" ? "▼ falling" : "→ stable"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Intersection products */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-slate-700">
                  {trendsCombinationLaunches.length} launches match all selected attributes
                </span>
                <span className="text-[10px] text-slate-400">
                  ({trendsFiltered.length > 0 ? Math.round(trendsCombinationLaunches.length / trendsFiltered.length * 100) : 0}% of filtered set)
                </span>
              </div>

              {trendsCombinationLaunches.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-6 text-center">
                  No launches in the current filtered set carry all {trendsShowAttrs.length} selected attributes.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left pb-2 text-slate-400 font-medium">Brand / Product</th>
                        <th className="text-left pb-2 text-slate-400 font-medium">Subcategory</th>
                        <th className="text-left pb-2 text-slate-400 font-medium">Channel</th>
                        <th className="text-right pb-2 text-slate-400 font-medium">Velocity</th>
                        <th className="text-right pb-2 text-slate-400 font-medium">$4w</th>
                        <th className="text-right pb-2 text-slate-400 font-medium">QS</th>
                        <th className="text-right pb-2 text-slate-400 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendsCombinationLaunches.map((l) => {
                        const qs = l.launchQualityScore;
                        const statusLabel = qs >= 70 ? "Winner" : qs >= 50 ? "Steady" : "Fader";
                        const statusCls = qs >= 70 ? "bg-green-100 text-green-700" : qs >= 50 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500";
                        return (
                          <tr key={l.upc} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-2 pr-2">
                              <div className="font-medium text-slate-700 truncate max-w-[180px]">{l.description}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{l.brand}</div>
                            </td>
                            <td className="py-2 text-slate-500 truncate max-w-[120px]">{l.subcategory}</td>
                            <td className="py-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                                {l.retailer}
                              </span>
                            </td>
                            <td className="py-2 text-right font-medium text-slate-700 tabular-nums">
                              ${l.velocityLatest.toFixed(1)}
                            </td>
                            <td className="py-2 text-right text-slate-500 tabular-nums">
                              {fmt$(l.dollars4w)}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: scoreHex(qs) + "22", color: scoreHex(qs) }}
                              >
                                {qs}
                              </span>
                            </td>
                            <td className="py-2 text-right">
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${statusCls}`}>
                                {statusLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Attribute Demand Signals */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 size={14} className="text-emerald-500" />
              <h2 className="text-sm font-semibold text-slate-700">Attribute Demand Signals</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Is attribute growth driving category growth, or just shifting share?
              Bubbles sized by launch count.
            </p>

            {/* Scatter chart */}
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="penetrationRate"
                  type="number"
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  label={{ value: "Penetration Rate", position: "insideBottom", offset: -10, style: { fontSize: 10, fill: "#94a3b8" } }}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  dataKey="categoryGrowthContrib"
                  type="number"
                  tickFormatter={(v) => `${(v * 100).toFixed(1)}pp`}
                  label={{ value: "Growth Contrib (pp)", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#94a3b8" } }}
                  tick={{ fontSize: 10 }}
                  width={60}
                />
                <ZAxis dataKey="launchCount" range={[40, 400]} />
                {/* Quadrant labels */}
                <ReferenceArea x1={0.5} x2={1} y1={0} y2={0.1} fill="none"
                  label={{ value: "Demand Drivers", position: "insideTopRight", fontSize: 9, fill: "#10b981", fontWeight: 600 }} />
                <ReferenceArea x1={0.5} x2={1} y1={-0.1} y2={0} fill="none"
                  label={{ value: "Share Shift", position: "insideBottomRight", fontSize: 9, fill: "#f59e0b", fontWeight: 600 }} />
                <ReferenceArea x1={0} x2={0.5} y1={0} y2={0.1} fill="none"
                  label={{ value: "Niche Leaders", position: "insideTopLeft", fontSize: 9, fill: "#3b82f6", fontWeight: 600 }} />
                <ReferenceArea x1={0} x2={0.5} y1={-0.1} y2={0} fill="none"
                  label={{ value: "Fading", position: "insideBottomLeft", fontSize: 9, fill: "#94a3b8", fontWeight: 600 }} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
                <Tooltip
                  content={(props: any) => {
                    const { active, payload } = props;
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as AttributeDemandSignal;
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm text-xs">
                        <div className="font-semibold text-slate-800 mb-1">{d.attributeName}</div>
                        <div className="text-slate-500">{d.category}</div>
                        <div className="mt-1 space-y-0.5">
                          <div>Penetration: {(d.penetrationRate * 100).toFixed(0)}%</div>
                          <div>Growth Contrib: {(d.categoryGrowthContrib * 100).toFixed(1)}pp</div>
                          <div>Launches: {d.launchCount}</div>
                          <div className="font-semibold mt-1" style={{ color: SIGNAL_COLORS[d.signal] }}>{d.signal}</div>
                        </div>
                      </div>
                    );
                  }}
                />
                {/* One Scatter series per signal type, each with its own color */}
                {(["Demand Driver", "Share Shift", "Niche Leader", "Fading"] as Array<AttributeDemandSignal["signal"]>).map((sig) => {
                  const data = demandSignals.filter((d) => d.signal === sig);
                  return (
                    <Scatter
                      key={sig}
                      name={sig}
                      data={data}
                      fill={SIGNAL_COLORS[sig]}
                      fillOpacity={0.7}
                    />
                  );
                })}
              </ScatterChart>
            </ResponsiveContainer>

            {/* Custom legend */}
            <div className="flex flex-wrap gap-4 justify-center mt-2 text-[10px]">
              {(["Demand Driver", "Share Shift", "Niche Leader", "Fading"] as const).map((label) => (
                <div key={label} className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SIGNAL_COLORS[label] }} />
                  <span className="text-slate-500">{label}</span>
                </div>
              ))}
            </div>

            {/* Signal table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left pb-2 text-slate-400 font-medium">Attribute</th>
                    <th className="text-left pb-2 text-slate-400 font-medium">Category</th>
                    <th className="text-right pb-2 text-slate-400 font-medium">Trend</th>
                    <th className="text-right pb-2 text-slate-400 font-medium">Penetration</th>
                    <th className="text-right pb-2 text-slate-400 font-medium">Growth Contrib</th>
                    <th className="text-right pb-2 text-slate-400 font-medium">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {[...demandSignals]
                    .sort((a, b) => b.categoryGrowthContrib - a.categoryGrowthContrib)
                    .map((d) => {
                      const signalCls: Record<string, string> = {
                        "Demand Driver": "bg-emerald-100 text-emerald-700",
                        "Share Shift": "bg-amber-100 text-amber-700",
                        "Niche Leader": "bg-blue-100 text-blue-700",
                        "Fading": "bg-slate-100 text-slate-500",
                      };
                      const trendCls = d.trend === "rising" ? "bg-emerald-50 text-emerald-600" : d.trend === "declining" ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-500";
                      return (
                        <tr key={`${d.attributeName}-${d.category}`} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-2 font-medium text-slate-700">{d.attributeName}</td>
                          <td className="py-2 text-slate-500">{d.category}</td>
                          <td className="py-2 text-right">
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${trendCls}`}>{d.trend}</span>
                          </td>
                          <td className="py-2 text-right text-slate-600 tabular-nums">{(d.penetrationRate * 100).toFixed(0)}%</td>
                          <td className="py-2 text-right text-slate-600 tabular-nums">{(d.categoryGrowthContrib * 100).toFixed(1)}pp</td>
                          <td className="py-2 text-right">
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${signalCls[d.signal]}`}>{d.signal}</span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      <AttributeIntelligenceSection />
    </div>
  );
}
