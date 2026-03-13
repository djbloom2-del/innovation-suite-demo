"use client";

import { useState, useMemo } from "react";
import type { Category, Launch } from "@/lib/types";
import { CATEGORIES } from "@/data/categories";
import {
  getTopAttributesByWinRate,
  getRisingUnderpenetrated,
  ATTRIBUTE_COMBOS,
} from "@/data/attributes";
import { LAUNCHES, getWinners } from "@/data/launches";
import { fmt$, scoreBg } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { TrendingUp, Zap, ListFilter } from "lucide-react";

const ATTR_COLORS = [
  "#2563eb","#16a34a","#7c3aed","#d97706","#0891b2","#db2777","#059669","#9333ea",
];

// ── Attribute Combo Explorer helpers ────────────────────────────
const ATTR_KEYS = ["Organic","Non-GMO","Gluten-Free","Vegan","Keto","Protein"] as const;
type AttrKey = typeof ATTR_KEYS[number];

function matchesAttr(l: Launch, attr: AttrKey): boolean {
  const a = l.attributes;
  if (attr === "Organic")     return a.isOrganic;
  if (attr === "Non-GMO")     return a.isNonGmo;
  if (attr === "Gluten-Free") return a.isGlutenFree;
  if (attr === "Vegan")       return a.isVegan;
  if (attr === "Keto")        return a.isKeto;
  if (attr === "Protein")     return a.isProteinFocused;
  return false;
}

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
  const [explorerCat, setExplorerCat] = useState<Category>("Bars");

  const topAttrs = useMemo(
    () => getTopAttributesByWinRate(category, 12),
    [category]
  );
  const rising = useMemo(() => getRisingUnderpenetrated(category), [category]);

  const barData = topAttrs.map((a) => ({
    name: `${a.attributeName}`,
    winRate: Math.round(a.winRate * 100),
    overindex: +(a.overindexVsAll.toFixed(2)),
    launches: a.launchCount,
  }));

  const comboData = ATTRIBUTE_COMBOS.map((c) => ({
    x: c.launchCount,
    y: Math.round(c.winRate * 100),
    z: Math.round(c.medianDollars26w / 1000),
    name: c.attributes.join(" + "),
    lift: c.lift,
  }));

  // ── Explorer data ──
  const explorerData = useMemo(() => {
    const catLaunches = LAUNCHES.filter(l => l.category === explorerCat);
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
  }, [selectedAttrs, explorerCat]);

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

        {/* Rising but underpenetrated */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-green-500" />
            <h2 className="text-sm font-semibold text-slate-700">Rising, Underpenetrated</h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            High win rate, trend=rising, &lt;35% of launches.
          </p>
          {rising.length === 0 ? (
            <p className="text-xs text-slate-400">None found for this category.</p>
          ) : (
            <div className="space-y-3">
              {rising.slice(0, 6).map((a, i) => (
                <div key={i} className="p-3 bg-green-50 border border-green-100 rounded-lg">
                  <div className="text-xs font-semibold text-green-800">{a.attributeName}</div>
                  <div className="text-[10px] text-green-600 mt-0.5">
                    Win rate: {Math.round(a.winRate * 100)}% · Only in{" "}
                    {Math.round(a.penetrationRate * 100)}% of launches
                  </div>
                  <div className="text-[10px] text-green-500">
                    {a.overindexVsAll.toFixed(1)}× overindex
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attribute Combo bubble chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={14} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700">Attribute Combination Performance</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          X = # of launches with combo · Y = win rate · Bubble = median 26w dollars ($K)
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="x" name="Launches" type="number" domain={[0, 25]} ticks={[0, 5, 10, 15, 20, 25]} tick={{ fontSize: 10 }} label={{ value: "Launch Count", position: "insideBottom", offset: -4, fontSize: 10 }} />
              <YAxis dataKey="y" name="Win Rate" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} label={{ value: "Win Rate %", angle: -90, position: "insideLeft", offset: 12, fontSize: 10 }} />
              <ZAxis dataKey="z" range={[40, 400]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs shadow-md">
                      <div className="font-semibold text-slate-700 mb-1">{d.name}</div>
                      <div className="text-slate-500">Launches: {d.x}</div>
                      <div className="text-slate-500">Win Rate: {d.y}%</div>
                      <div className="text-slate-500">Median 26w $: ${d.z}K</div>
                      <div className="text-blue-600 font-medium">Lift: {d.lift.toFixed(1)}×</div>
                    </div>
                  );
                }}
              />
              <Scatter data={comboData} fill="#2563eb" fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>

          {/* Combo table */}
          <div className="overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left pb-2 text-slate-400 font-medium">Combination</th>
                  <th className="text-right pb-2 text-slate-400 font-medium">Win %</th>
                  <th className="text-right pb-2 text-slate-400 font-medium">Lift</th>
                  <th className="text-right pb-2 text-slate-400 font-medium">26w $</th>
                </tr>
              </thead>
              <tbody>
                {ATTRIBUTE_COMBOS.sort((a, b) => b.lift - a.lift).map((c, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 text-slate-700 font-medium">{c.attributes.join(" + ")}</td>
                    <td className="py-2 text-right text-green-600 font-semibold">{Math.round(c.winRate * 100)}%</td>
                    <td className="py-2 text-right text-blue-600 font-semibold">{c.lift.toFixed(1)}×</td>
                    <td className="py-2 text-right text-slate-500">${(c.medianDollars26w / 1000).toFixed(0)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          {/* Explorer category pills */}
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setExplorerCat(c)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  explorerCat === c
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c}
              </button>
            ))}
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
                <div className="text-[10px] text-slate-400 mt-0.5">in {explorerCat}</div>
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
                    No launches match this combination in {explorerCat}.
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
