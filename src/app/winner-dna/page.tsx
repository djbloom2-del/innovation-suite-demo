"use client";

import { useState, useMemo } from "react";
import type { Category } from "@/lib/types";
import { CATEGORIES } from "@/data/categories";
import {
  getTopAttributesByWinRate,
  ATTR_KEYS,
  type AttrKey,
  matchesAttr,
} from "@/data/attributes";
import { LAUNCHES, getWinners } from "@/data/launches";
import { fmt$, fmtPct, scoreBg, scoreHex } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { Zap, ListFilter, ShieldCheck, BarChart2 } from "lucide-react";

const ATTR_COLORS = [
  "#2563eb","#16a34a","#7c3aed","#d97706","#0891b2","#db2777","#059669","#9333ea",
];

function medianVal(vals: number[]): number {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
// ────────────────────────────────────────────────────────────────

export default function WinnerDNA() {
  const [category, setCategory] = useState<Category>("Bars");

  // ── Explorer state ──
  const [selectedAttrs, setSelectedAttrs] = useState<AttrKey[]>([]);

  const topAttrs = useMemo(
    () => getTopAttributesByWinRate(category, 12),
    [category]
  );

  // ── Attribute Scorecard ──
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
      // Velocity index: avg velocity of attr launches vs. all cat launches
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

  // ── Form Factor analysis ──
  const formData = useMemo(() => {
    const catLaunches = LAUNCHES.filter((l) => l.category === category);
    const catWinners  = getWinners(catLaunches);
    const catWinRate  = catLaunches.length ? catWinners.length / catLaunches.length : 0;

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
        dollarShare: catLaunches.reduce((s, l) => s + l.dollarsLatest, 0) > 0
          ? dollars / catLaunches.reduce((s, l) => s + l.dollarsLatest, 0)
          : 0,
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }, [category]);

  // ── Functional Ingredient analysis ──
  const funcIngredData = useMemo(() => {
    const catLaunches = LAUNCHES.filter((l) => l.category === category);
    const catWinRate  = catLaunches.length
      ? getWinners(catLaunches).length / catLaunches.length
      : 0;

    const ingredMap = new Map<string, { total: number; winners: number; avgVelocity: number; velocitySum: number }>();
    catLaunches
      .filter((l) => l.attributes.functionalIngredient !== null)
      .forEach((l) => {
        const k = l.attributes.functionalIngredient!;
        if (!ingredMap.has(k)) ingredMap.set(k, { total: 0, winners: 0, avgVelocity: 0, velocitySum: 0 });
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

  // ── Dynamic 2-attribute combo table (all C(6,2)=15 pairs, filtered by category) ──
  const comboTableData = useMemo(() => {
    const catLaunches = LAUNCHES.filter(l => l.category === category);
    const catWinners  = getWinners(catLaunches);
    const catWinRate  = catLaunches.length ? catWinners.length / catLaunches.length : 0;

    const pairs: { label: string; count: number; winRate: number; lift: number }[] = [];
    for (let i = 0; i < ATTR_KEYS.length; i++) {
      for (let j = i + 1; j < ATTR_KEYS.length; j++) {
        const a = ATTR_KEYS[i];
        const b = ATTR_KEYS[j];
        const withBoth = catLaunches.filter(l => matchesAttr(l, a) && matchesAttr(l, b));
        const winRate  = withBoth.length ? getWinners(withBoth).length / withBoth.length : 0;
        const lift     = catWinRate > 0 ? winRate / catWinRate : 1;
        pairs.push({ label: `${a} + ${b}`, count: withBoth.length, winRate, lift });
      }
    }
    return pairs.sort((a, b) => b.lift - a.lift).slice(0, 10);
  }, [category]);

  // ── Explorer data ──
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

    // Per-attribute standalone win rates (for comparison chart)
    const singleStats = ATTR_KEYS.map(attr => {
      const sub    = catLaunches.filter(l => matchesAttr(l, attr));
      const subWin = getWinners(sub);
      return { attr, winRate: sub.length ? subWin.length / sub.length : 0, count: sub.length };
    });

    // Chart rows: one per attribute + a "Combination ★" row when 2+ selected
    const chartData: { name: string; winRate: number; isCombo: boolean }[] = ATTR_KEYS.map((attr, i) => ({
      name: attr,
      winRate: Math.round(singleStats[i].winRate * 100),
      isCombo: false,
    }));
    if (selectedAttrs.length >= 1) {
      chartData.push({ name: "Combination ★", winRate: Math.round(comboWinRate * 100), isCombo: true });
    }

    // Top 10 matching launches by quality score
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

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Filter bar */}
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
        {/* Win Rate by Attribute — col span 2 */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">
            Win Rate by Attribute — {category}
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            % of launches with this attribute that reach top-quartile quality score.
            Overindex = win rate ÷ category baseline.
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barData} layout="vertical" margin={{ left: 12, right: 60, top: 0, bottom: 0 }}>
              <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: any, name: any) =>
                  name === "winRate" ? [`${v}%`, "Win Rate"] : [v + "×", "Overindex"]
                }
                contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }}
              />
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

      {/* Dynamic 2-attribute combo table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={14} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700">Attribute Combination Performance — {category}</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          All two-attribute pairs ranked by win-rate lift vs. category baseline. Computed live from {category} launches.
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left pb-2 text-slate-400 font-medium">Combination</th>
              <th className="text-right pb-2 text-slate-400 font-medium"># Launches</th>
              <th className="text-right pb-2 text-slate-400 font-medium">Win %</th>
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
                  <td className="py-2 text-slate-700 font-medium">{row.label}</td>
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

      {/* ── Form Factor + Functional Ingredient panels ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Form Factor bar chart */}
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
          {/* Form factor table */}
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

        {/* Functional Ingredient breakdown */}
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

      {/* ── Attribute Combination Explorer ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        {/* Header row */}
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

        {/* Attribute toggle pills */}
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
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-36 text-slate-400 text-sm gap-2">
            <ListFilter size={20} className="opacity-30" />
            <span>Select one or more attributes above to explore how combinations affect win rates</span>
          </div>
        ) : (
          <>
            {/* KPI strip */}
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

            {/* Comparison chart + matching launches */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
              {/* Horizontal bar chart: single attrs vs. combination */}
              <div className="xl:col-span-3">
                <p className="text-xs text-slate-500 font-medium mb-2">
                  Win rate comparison — individual attributes vs. combination
                  <span className="ml-1 text-slate-400 font-normal">(dashed = category baseline)</span>
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={explorerData.chartData}
                    layout="vertical"
                    margin={{ left: 8, right: 44, top: 0, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 100]}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={100}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: any) => [`${v}%`, "Win Rate"]}
                      contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }}
                    />
                    <ReferenceLine
                      x={Math.round(explorerData.catWinRate * 100)}
                      stroke="#94a3b8"
                      strokeDasharray="4 3"
                      label={{
                        value: "baseline",
                        position: "insideTopRight",
                        fontSize: 9,
                        fill: "#94a3b8",
                      }}
                    />
                    <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                      {explorerData.chartData.map((d, idx) => (
                        <Cell
                          key={idx}
                          fill={d.isCombo ? "#2563eb" : "#cbd5e1"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Matching launches list */}
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
                      <div
                        key={l.upc}
                        className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-700 truncate leading-tight">
                            {l.description}
                          </div>
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
    </div>
  );
}
