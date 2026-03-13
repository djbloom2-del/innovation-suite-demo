"use client";

import { useMemo, useState } from "react";
import {
  WHITESPACE_OPPORTUNITIES,
  getWhitespaceBubbleData,
} from "@/data/whitespace";
import { getRisingUnderpenetrated, ATTRIBUTE_PERFORMANCE } from "@/data/attributes";
import { CATEGORY_BENCHMARKS, CATEGORIES } from "@/data/categories";
import type { WhitespaceOpportunity } from "@/lib/types";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { fmt$, fmtPct, categoryColor } from "@/lib/utils";
import { Lightbulb, TrendingUp, Target, LayoutGrid } from "lucide-react";

// ─── Module-scope constants ──────────────────────────────────────────────────

const HEATMAP_ATTRS = ["Non-GMO", "Gluten-Free", "Protein", "Organic", "Vegan", "Keto"] as const;

const QUADRANT_LABELS = [
  { x: 2.5, y: 28, text: "Open & Growing", color: "#16a34a", desc: "Best Whitespace" },
  { x: 7.5, y: 28, text: "Crowded & Growing", color: "#d97706", desc: "Competitive" },
  { x: 2.5, y: 8, text: "Open & Declining", color: "#6b7280", desc: "Niche" },
  { x: 7.5, y: 8, text: "Crowded & Declining", color: "#dc2626", desc: "Avoid" },
];

function computePrize(opp: WhitespaceOpportunity): number {
  const b = CATEGORY_BENCHMARKS.find((bm) => bm.category === opp.category)!;
  const additionalLaunches = Math.max(
    1,
    Math.round(b.launchCountLast12m * (0.5 - opp.penetrationRate))
  );
  const medianRevenue = b.medianVelocity26w * b.medianTdp12w * 26;
  return additionalLaunches * opp.winRate * medianRevenue;
}

function WhitespaceBadge({ score }: { score: number }) {
  const color =
    score >= 85
      ? "bg-green-100 text-green-700"
      : score >= 75
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-700";
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
      {score}
    </span>
  );
}

function trendColor(trend: string): string {
  if (trend === "rising")   return "#16a34a";
  if (trend === "declining") return "#dc2626";
  return "#2563eb";
}

function trendChipClass(trend: string): string {
  if (trend === "rising")   return "bg-green-100 text-green-700";
  if (trend === "declining") return "bg-red-100 text-red-700";
  return "bg-blue-100 text-blue-700";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhitespaceLab() {
  // ── Section 1 data (unchanged) ──────────────────────────────────────────
  const bubbleData  = useMemo(() => getWhitespaceBubbleData(), []);
  const risingAttrs = useMemo(() => getRisingUnderpenetrated(), []);
  const opportunities = WHITESPACE_OPPORTUNITIES.sort(
    (a, b) => b.whitespaceScore - a.whitespaceScore
  );

  // ── State for new sections ───────────────────────────────────────────────
  const [quadrantCat, setQuadrantCat] = useState<string>("All");
  const [explorerCat, setExplorerCat] = useState<string>("All");
  const [trendFilter, setTrendFilter] = useState<string>("All");
  const [sortBy, setSortBy]           = useState<"winRate" | "penetrationGap" | "overindex">("winRate");

  // ── useMemo: Attribute Quadrant Map ─────────────────────────────────────
  const quadrantData = useMemo(() => {
    const attrs =
      quadrantCat === "All"
        ? ATTRIBUTE_PERFORMANCE
        : ATTRIBUTE_PERFORMANCE.filter((a) => a.category === quadrantCat);

    if (quadrantCat === "All") {
      // Average across categories per unique attr:value pair
      const map = new Map<
        string,
        { sumWr: number; sumPen: number; count: number; trend: string; overindex: number }
      >();
      attrs.forEach((a) => {
        const key = `${a.attributeName}:${a.attributeValue}`;
        const ex  = map.get(key);
        if (ex) {
          ex.sumWr  += a.winRate;
          ex.sumPen += a.penetrationRate;
          ex.count  += 1;
        } else {
          map.set(key, {
            sumWr:    a.winRate,
            sumPen:   a.penetrationRate,
            count:    1,
            trend:    a.trend,
            overindex: a.overindexVsAll,
          });
        }
      });
      return Array.from(map.entries()).map(([key, v]) => ({
        name:            key.split(":")[1] ?? key,
        label:           key.split(":")[0],
        winRate:         v.sumWr  / v.count,
        penetrationRate: v.sumPen / v.count,
        trend:           v.trend,
        overindex:       v.overindex,
      }));
    }

    return attrs.map((a) => ({
      name:            a.attributeValue,
      label:           a.attributeName,
      winRate:         a.winRate,
      penetrationRate: a.penetrationRate,
      trend:           a.trend,
      overindex:       a.overindexVsAll,
    }));
  }, [quadrantCat]);

  // ── useMemo: Heatmap lookup ──────────────────────────────────────────────
  const heatmapLookup = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    ATTRIBUTE_PERFORMANCE.forEach((a) => {
      const key = `${a.attributeName}:${a.attributeValue}`;
      if (!map.has(key)) map.set(key, new Map());
      map.get(key)!.set(a.category, a.winRate);
    });
    return map;
  }, []);

  // ── useMemo: Explorer results ────────────────────────────────────────────
  const explorerResults = useMemo(() => {
    let r = [...ATTRIBUTE_PERFORMANCE];
    if (explorerCat !== "All")  r = r.filter((a) => a.category === explorerCat);
    if (trendFilter !== "All")  r = r.filter((a) => a.trend === trendFilter.toLowerCase());
    r.sort((a, b) => {
      if (sortBy === "winRate")        return b.winRate - a.winRate;
      if (sortBy === "penetrationGap") return a.penetrationRate - b.penetrationRate;
      if (sortBy === "overindex")      return b.overindexVsAll - a.overindexVsAll;
      return 0;
    });
    return r.slice(0, 15);
  }, [explorerCat, trendFilter, sortBy]);

  // ── Pill helpers ──────────────────────────────────────────────────────────
  const pillCls = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
      active
        ? "bg-blue-600 text-white"
        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Section 1: Category Whitespace Map + Attribute Gap Signals (unchanged) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Bubble chart */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Category Whitespace Map</h2>
          <p className="text-xs text-slate-400 mb-4">
            Crowding vs. growth rate. Bubble size = category total $. Find the open growing quadrant.
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 20, right: 24, bottom: 24, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="crowding"
                name="Crowding"
                type="number"
                domain={[0, 10]}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                label={{ value: "← Less Crowded   More Crowded →", position: "insideBottom", offset: -12, fontSize: 10, fill: "#94a3b8" }}
              />
              <YAxis
                dataKey="growthRate"
                name="Growth Rate"
                type="number"
                domain={[0, 35]}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
                label={{ value: "Growth Rate", angle: -90, position: "insideLeft", offset: 12, fontSize: 10, fill: "#94a3b8" }}
              />
              <ZAxis dataKey="totalDollars" range={[600, 3000]} />
              <ReferenceLine x={5} stroke="#e2e8f0" strokeDasharray="4 2" />
              <ReferenceLine y={15} stroke="#e2e8f0" strokeDasharray="4 2" />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs shadow-md">
                      <div className="font-semibold text-slate-800 mb-1">{d.category}</div>
                      <div className="text-slate-500">Crowding: {d.crowding.toFixed(1)}</div>
                      <div className="text-slate-500">Growth: {d.growthRate.toFixed(0)}%</div>
                      <div className="text-slate-500">Size: {fmt$(d.totalDollars)}</div>
                      <div className="text-slate-500">Avg Quality: {d.avgQualityScore}</div>
                    </div>
                  );
                }}
              />
              <Scatter
                data={bubbleData}
                shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  const r = Math.sqrt((props.size ?? 600) / Math.PI);
                  const color = categoryColor(payload.category);
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.7} stroke={color} strokeWidth={1.5} />
                      <text x={cx} y={cy + r + 12} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={500}>
                        {payload.category}
                      </text>
                    </g>
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {QUADRANT_LABELS.map((q) => (
              <div key={q.text} className="flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: q.color }} />
                <span className="font-medium" style={{ color: q.color }}>{q.text}</span>
                <span className="text-slate-400">— {q.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rising underpenetrated attributes */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Attribute Gap Signals</h2>
          <p className="text-xs text-slate-400 mb-4">
            High win rate, low penetration — underserved demand
          </p>
          <div className="space-y-3">
            {risingAttrs.slice(0, 8).map((attr) => (
              <div key={`${attr.category}-${attr.attributeName}`} className="border border-slate-100 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">{attr.attributeName}: {attr.attributeValue}</div>
                    <div className="text-[10px] text-slate-400">{attr.category}</div>
                  </div>
                  <TrendingUp size={13} className="text-green-500 shrink-0 mt-0.5" />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <div className="text-[10px] text-slate-400">Win Rate</div>
                    <div className="text-sm font-bold text-green-600">{fmtPct(attr.winRate, 0)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Penetration</div>
                    <div className="text-sm font-bold text-slate-700">{fmtPct(attr.penetrationRate, 0)}</div>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${attr.penetrationRate * 100}%` }}
                  />
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">{Math.round(attr.penetrationRate * 100)}% of launches feature this</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 2: Attribute Opportunity Quadrant Map ──────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Attribute Opportunity Quadrant</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Win rate vs. penetration — top-left = highest opportunity (winning but underpenetrated)
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["All", ...CATEGORIES].map((cat) => (
              <button key={cat} onClick={() => setQuadrantCat(cat)} className={pillCls(quadrantCat === cat)}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 10, right: 24, bottom: 28, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="penetrationRate"
              name="Penetration"
              type="number"
              domain={[0, 0.65]}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              axisLine={false}
              tickLine={false}
              label={{ value: "← Lower Penetration   Higher Penetration →", position: "insideBottom", offset: -14, fontSize: 10, fill: "#94a3b8" }}
            />
            <YAxis
              dataKey="winRate"
              name="Win Rate"
              type="number"
              domain={[0, 0.85]}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              axisLine={false}
              tickLine={false}
              label={{ value: "Win Rate", angle: -90, position: "insideLeft", offset: 10, fontSize: 10, fill: "#94a3b8" }}
            />
            <ZAxis range={[60, 60]} />
            {/* Quadrant dividers */}
            <ReferenceLine x={0.3}  stroke="#e2e8f0" strokeDasharray="4 2" />
            <ReferenceLine y={0.35} stroke="#e2e8f0" strokeDasharray="4 2" />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs shadow-md">
                    <div className="font-semibold text-slate-800 mb-1">{d.name}</div>
                    <div className="text-slate-500">{d.label}</div>
                    <div className="text-slate-500 mt-1">Win Rate: {Math.round(d.winRate * 100)}%</div>
                    <div className="text-slate-500">Penetration: {Math.round(d.penetrationRate * 100)}%</div>
                    <div className="text-slate-500">Overindex: {d.overindex.toFixed(1)}×</div>
                  </div>
                );
              }}
            />
            <Scatter
              data={quadrantData}
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                const color  = trendColor(payload.trend);
                const isHigh = payload.penetrationRate < 0.25 && payload.winRate > 0.5;
                return (
                  <g>
                    <circle
                      cx={cx} cy={cy} r={isHigh ? 7 : 5}
                      fill={color} fillOpacity={0.75}
                      stroke={color} strokeWidth={isHigh ? 2 : 1}
                    />
                    {isHigh && (
                      <text
                        x={cx} y={cy - 10}
                        textAnchor="middle"
                        fontSize={9}
                        fill="#1e293b"
                        fontWeight={600}
                      >
                        {payload.name}
                      </text>
                    )}
                  </g>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>

        {/* Quadrant corner labels */}
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="text-[10px] font-semibold text-green-600">★ Top-left: High Win Rate + Low Penetration = Best Opportunity</div>
          <div className="text-[10px] font-medium text-amber-600">Top-right: High Win Rate + High Penetration = Established</div>
          <div className="text-[10px] font-medium text-slate-400">Bottom-left: Low Win Rate + Low Penetration = Monitor</div>
          <div className="text-[10px] font-medium text-red-400">Bottom-right: Low Win Rate + High Penetration = Low Priority</div>
        </div>

        {/* Trend legend */}
        <div className="mt-3 flex gap-4">
          {[
            { label: "Rising",   color: "#16a34a" },
            { label: "Stable",   color: "#2563eb" },
            { label: "Declining",color: "#dc2626" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Interactive Whitespace Explorer ─────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <LayoutGrid size={15} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700">Whitespace Explorer</h2>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-4">
          {/* Category pills */}
          <div className="flex flex-wrap gap-1">
            {["All", ...CATEGORIES].map((cat) => (
              <button key={cat} onClick={() => setExplorerCat(cat)} className={pillCls(explorerCat === cat)}>
                {cat}
              </button>
            ))}
          </div>
          {/* Trend pills */}
          <div className="flex flex-wrap gap-1">
            {["All", "Rising", "Stable", "Declining"].map((t) => (
              <button key={t} onClick={() => setTrendFilter(t)} className={pillCls(trendFilter === t)}>
                {t}
              </button>
            ))}
          </div>
          {/* Sort selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "winRate" | "penetrationGap" | "overindex")}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="winRate">Sort: Win Rate</option>
            <option value="penetrationGap">Sort: Penetration Gap</option>
            <option value="overindex">Sort: Overindex</option>
          </select>
        </div>

        {/* Results table */}
        <div className="border border-slate-100 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Attribute</div>
            <div className="col-span-3">Win Rate</div>
            <div className="col-span-2">Penetration</div>
            <div className="col-span-1 text-center">OI</div>
            <div className="col-span-1 text-center">Trend</div>
          </div>
          {explorerResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              No attributes match the current filters.
            </div>
          ) : (
            explorerResults.map((attr, i) => {
              const oiColor =
                attr.overindexVsAll >= 2   ? "text-green-600" :
                attr.overindexVsAll >= 1.5 ? "text-amber-600" : "text-slate-500";
              return (
                <div
                  key={`${attr.category}-${attr.attributeName}-${attr.attributeValue}`}
                  className="grid grid-cols-12 gap-2 px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors items-center"
                >
                  {/* Rank */}
                  <div className="col-span-1 text-[10px] text-slate-400">#{i + 1}</div>
                  {/* Attribute */}
                  <div className="col-span-4">
                    <div className="text-xs font-semibold text-slate-700 leading-tight">{attr.attributeName}: {attr.attributeValue}</div>
                    <span
                      className="text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white mt-0.5 inline-block"
                      style={{ backgroundColor: categoryColor(attr.category) }}
                    >
                      {attr.category}
                    </span>
                  </div>
                  {/* Win Rate */}
                  <div className="col-span-3">
                    <div className="text-xs font-bold text-green-600 mb-1">{Math.round(attr.winRate * 100)}%</div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: `${attr.winRate * 100}%` }} />
                    </div>
                  </div>
                  {/* Penetration */}
                  <div className="col-span-2">
                    <div className="text-xs font-semibold text-slate-600 mb-1">{Math.round(attr.penetrationRate * 100)}%</div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${attr.penetrationRate * 100}%` }} />
                    </div>
                  </div>
                  {/* Overindex */}
                  <div className={`col-span-1 text-center text-xs font-bold ${oiColor}`}>
                    {attr.overindexVsAll.toFixed(1)}×
                  </div>
                  {/* Trend */}
                  <div className="col-span-1 flex justify-center">
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full capitalize ${trendChipClass(attr.trend)}`}>
                      {attr.trend.charAt(0).toUpperCase() + attr.trend.slice(1, 3)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="mt-2 text-[10px] text-slate-400 text-right">
          Showing {explorerResults.length} of {ATTRIBUTE_PERFORMANCE.length} attributes
        </div>
      </div>

      {/* ── Section 4: Category × Attribute Heatmap ────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Target size={14} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Win Rate by Category & Attribute</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Each cell = win rate for that attribute in that category. Green = high win rate, red = low.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-xs min-w-[480px]">
            <thead>
              <tr>
                <th className="text-left text-[10px] text-slate-500 font-semibold py-1 px-2 w-32">Attribute</th>
                {CATEGORIES.map((cat) => (
                  <th
                    key={cat}
                    className="text-center text-[10px] font-semibold py-1 px-2"
                    style={{ color: categoryColor(cat) }}
                  >
                    {cat}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HEATMAP_ATTRS.map((attr) => (
                <tr key={attr}>
                  <td className="text-[11px] font-medium text-slate-600 py-1.5 px-2 whitespace-nowrap">{attr}</td>
                  {CATEGORIES.map((cat) => {
                    const v = heatmapLookup.get(`${attr}:true`)?.get(cat);
                    const cellCls =
                      v == null
                        ? "bg-slate-50 text-slate-300"
                        : v >= 0.6
                        ? "bg-green-100 text-green-800"
                        : v >= 0.45
                        ? "bg-blue-100 text-blue-800"
                        : v >= 0.3
                        ? "bg-amber-50 text-amber-800"
                        : "bg-red-50 text-red-800";
                    return (
                      <td
                        key={cat}
                        className={`text-center rounded-lg py-2 px-2 font-semibold text-[11px] ${cellCls}`}
                      >
                        {v != null ? `${Math.round(v * 100)}%` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Footer: category avg win rates */}
              <tr className="border-t border-slate-100">
                <td className="text-[10px] font-bold text-slate-500 py-1.5 px-2 pt-3">Cat. Avg</td>
                {CATEGORIES.map((cat) => {
                  const b = CATEGORY_BENCHMARKS.find((bm) => bm.category === cat)!;
                  return (
                    <td key={cat} className="text-center bg-slate-100 rounded-lg py-2 px-2 text-[11px] font-bold text-slate-600">
                      {Math.round(b.winRate * 100)}%
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex gap-4 flex-wrap">
          {[
            { label: "≥60% win rate",  cls: "bg-green-100 text-green-800" },
            { label: "45–59%",          cls: "bg-blue-100 text-blue-800" },
            { label: "30–44%",          cls: "bg-amber-50 text-amber-800" },
            { label: "<30%",            cls: "bg-red-50 text-red-800" },
            { label: "No data",         cls: "bg-slate-50 text-slate-400" },
          ].map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <div className={`w-5 h-3 rounded text-center text-[8px] font-bold leading-3 ${cls}`} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 5: Innovation Opportunity Briefs (with Est. Prize) ────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={15} className="text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-700">Innovation Opportunity Briefs</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {opportunities.map((opp) => (
            <div
              key={`${opp.category}-${opp.attributeValue}`}
              className="border border-slate-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: categoryColor(opp.category) }}
                    >
                      {opp.category}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-800 mt-1">
                    {opp.attributeValue}
                  </div>
                  <div className="text-[10px] text-slate-400">{opp.attributeName}</div>
                </div>
                <WhitespaceBadge score={opp.whitespaceScore} />
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-3">{opp.description}</p>

              {/* 4-column stat grid (was 3) */}
              <div className="grid grid-cols-4 gap-1 pt-3 border-t border-slate-50">
                <div className="text-center">
                  <div className="text-xs font-bold text-green-600">{fmtPct(opp.winRate, 0)}</div>
                  <div className="text-[9px] text-slate-400">Win Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-slate-700">{fmtPct(opp.penetrationRate, 0)}</div>
                  <div className="text-[9px] text-slate-400">Penetration</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-blue-600">{Math.round(opp.growthSignal * 100)}%</div>
                  <div className="text-[9px] text-slate-400">Growth Signal</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-purple-600">{fmt$(computePrize(opp))}</div>
                  <div className="text-[9px] text-slate-400">Est. Prize</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
