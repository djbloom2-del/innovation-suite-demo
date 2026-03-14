"use client";

import { useState, useMemo } from "react";
import type { Launch, LaunchFilters } from "@/lib/types";
import { LAUNCHES } from "@/data/launches";
import { CATEGORIES, CATEGORY_BENCHMARKS } from "@/data/categories";
import { applyLaunchFilters, DEFAULT_FILTERS } from "@/lib/filters";
import { categoryColor, fmtMonth, scoreHex, fmtPct } from "@/lib/utils";
import { LaunchFilterPanel } from "@/components/launches/LaunchFilters";
import { LaunchCard } from "@/components/launches/LaunchCard";
import { LaunchDetailDrawer } from "@/components/launches/LaunchDetailDrawer";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ReferenceLine,
} from "recharts";

const TIMEFRAMES = [
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
  { label: "18M", months: 18 },
  { label: "24M", months: 24 },
];

export default function LaunchExplorer() {
  const [filters, setFilters] = useState<LaunchFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Launch | null>(null);
  const [chartCat, setChartCat] = useState<string>("All");
  const [timeframe, setTimeframe] = useState<number>(12);

  const filtered = useMemo(() => applyLaunchFilters(LAUNCHES, filters), [filters]);

  // Build monthly chart data
  const chartData = useMemo(() => {
    const now = new Date("2026-03-08");
    const cutoff = new Date(now.getFullYear(), now.getMonth() - timeframe + 1, 1);
    const cutoffStr = cutoff.toISOString().slice(0, 7) + "-01";

    const base = LAUNCHES.filter((l) => {
      if (chartCat !== "All" && l.category !== chartCat) return false;
      return l.launchCohortMonth >= cutoffStr;
    });

    const monthMap: Record<string, Record<string, number>> = {};
    base.forEach((l) => {
      const m = l.launchCohortMonth.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = {};
      monthMap[m][l.category] = (monthMap[m][l.category] || 0) + 1;
    });

    const months: string[] = [];
    const cursor = new Date(cutoff);
    while (cursor <= now) {
      months.push(cursor.toISOString().slice(0, 7));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return months.map((m) => {
      const cats = monthMap[m] || {};
      const total = Object.values(cats).reduce((s, v) => s + v, 0);
      return { month: m, label: fmtMonth(m), total, ...cats };
    });
  }, [chartCat, timeframe]);

  // Price × Promo scatter data from filtered launches
  const scatterData = useMemo(
    () =>
      filtered.map((l) => ({
        x: +l.priceIndexVsCategory.toFixed(2),
        y: +l.promoDependency.toFixed(2),
        qs: l.launchQualityScore,
        name: l.description,
        cat: l.category,
        brand: l.brand,
      })),
    [filtered]
  );

  // Cohort benchmark summary strip for filtered launches
  const benchmarkStrip = useMemo(() => {
    if (filtered.length === 0) return null;
    const avgVelocity = filtered.reduce((s, l) => s + l.velocityLatest, 0) / filtered.length;
    const avgQS = filtered.reduce((s, l) => s + l.launchQualityScore, 0) / filtered.length;
    const avgPromo = filtered.reduce((s, l) => s + l.promoDependency, 0) / filtered.length;
    const survived12 = filtered.filter((l) => l.survived12w).length / filtered.length;

    // Blended benchmarks from visible categories
    const cats = [...new Set(filtered.map((l) => l.category))];
    const benchmarks = CATEGORY_BENCHMARKS.filter((b) => cats.includes(b.category));
    const blendedMedianVel =
      benchmarks.length > 0
        ? benchmarks.reduce((s, b) => s + b.medianVelocity12w, 0) / benchmarks.length
        : null;
    const blendedSurv12 =
      benchmarks.length > 0
        ? benchmarks.reduce((s, b) => s + b.survivalRate12w, 0) / benchmarks.length
        : null;
    const blendedAvgQS =
      benchmarks.length > 0
        ? benchmarks.reduce((s, b) => s + b.avgLaunchQualityScore, 0) / benchmarks.length
        : null;

    return { avgVelocity, avgQS, avgPromo, survived12, blendedMedianVel, blendedSurv12, blendedAvgQS };
  }, [filtered]);

  const activeCats = chartCat === "All" ? [...CATEGORIES] : [chartCat];

  return (
    <div className="flex gap-5 max-w-7xl mx-auto">
      <LaunchFilterPanel filters={filters} onChange={setFilters} total={filtered.length} />

      <div className="flex-1 min-w-0 space-y-4">
        {/* Innovation Tracker */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">New Items Over Time</h2>
              <p className="text-xs text-slate-400">Launch volume by month</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 flex-wrap">
                {["All", ...CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setChartCat(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      chartCat === cat
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    style={
                      chartCat === cat && cat !== "All"
                        ? { backgroundColor: categoryColor(cat as (typeof CATEGORIES)[number]) }
                        : undefined
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {TIMEFRAMES.map(({ label, months }) => (
                  <button
                    key={label}
                    onClick={() => setTimeframe(months)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      timeframe === months
                        ? "bg-slate-700 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={timeframe <= 12 ? 0 : 1}
              />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }}
                content={({ payload, label }) => {
                  if (!payload?.length) return null;
                  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs shadow-md">
                      <div className="font-semibold text-slate-700 mb-1">
                        {label} — {total} launches
                      </div>
                      {payload.map((p: any) => (
                        <div key={p.dataKey} className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ backgroundColor: p.fill }}
                          />
                          <span className="text-slate-500">
                            {p.dataKey}: {p.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              {activeCats.map((cat) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  stackId="launches"
                  fill={categoryColor(cat as (typeof CATEGORIES)[number])}
                  radius={
                    activeCats.indexOf(cat) === activeCats.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>

          {chartCat === "All" && (
            <div className="mt-2 flex flex-wrap gap-3">
              {CATEGORIES.map((cat) => (
                <div key={cat} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: categoryColor(cat) }} />
                  {cat}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Price × Promo scatter + Cohort benchmark strip */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {/* Scatter: Price Index vs Promo Dependency */}
          <div className="xl:col-span-3 bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-0.5">
              Price vs. Promo Dependency
            </h2>
            <p className="text-xs text-slate-400 mb-3">
              Each dot = one launch. X = price vs. category avg · Y = % sold on promo · color = quality score
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart margin={{ top: 4, right: 16, bottom: 16, left: -10 }}>
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={[0.6, 1.6]}
                  tickFormatter={(v) => `${v.toFixed(1)}×`}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "Price Index vs. Cat Avg", position: "insideBottom", fontSize: 9, fill: "#94a3b8", dy: 14 }}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  domain={[0, 0.8]}
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "Promo %", angle: -90, position: "insideLeft", fontSize: 9, fill: "#94a3b8", dx: 10 }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload as (typeof scatterData)[0];
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs shadow-md max-w-[200px]">
                        <div className="font-semibold text-slate-700 leading-snug mb-1">{d.name}</div>
                        <div className="text-slate-500">{d.brand} · {d.cat}</div>
                        <div className="text-slate-600 mt-1">
                          Price: {d.x.toFixed(2)}× · Promo: {Math.round(d.y * 100)}%
                        </div>
                        <div className="font-semibold mt-0.5" style={{ color: scoreHex(d.qs) }}>
                          QS: {d.qs}
                        </div>
                      </div>
                    );
                  }}
                />
                {/* Target zone lines */}
                <ReferenceLine x={1.0} stroke="#cbd5e1" strokeDasharray="4 2" label={{ value: "cat avg", fontSize: 9, fill: "#94a3b8" }} />
                <ReferenceLine y={0.3} stroke="#fbbf24" strokeDasharray="4 2" label={{ value: "30% promo", fontSize: 9, fill: "#94a3b8", position: "right" }} />
                <Scatter
                  data={scatterData}
                  shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={scoreHex(payload.qs)}
                        fillOpacity={0.75}
                        stroke="white"
                        strokeWidth={1}
                      />
                    );
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
            {/* QS color legend */}
            <div className="flex flex-wrap gap-3 mt-1 text-[9px] text-slate-400">
              {[{ label: "QS 75+", color: "#16a34a" }, { label: "QS 50–74", color: "#2563eb" }, { label: "QS 25–49", color: "#d97706" }, { label: "QS <25", color: "#dc2626" }].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Cohort benchmark strip */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-0.5">
              Filtered Set vs. Benchmarks
            </h2>
            <p className="text-xs text-slate-400 mb-3">
              {filtered.length} launches vs. category medians
            </p>
            {benchmarkStrip ? (
              <div className="space-y-3">
                {[
                  {
                    label: "Avg Velocity",
                    value: `$${benchmarkStrip.avgVelocity.toFixed(0)}/store`,
                    benchmark: benchmarkStrip.blendedMedianVel
                      ? `cat median $${benchmarkStrip.blendedMedianVel.toFixed(0)}`
                      : null,
                    ratio: benchmarkStrip.blendedMedianVel
                      ? benchmarkStrip.avgVelocity / benchmarkStrip.blendedMedianVel
                      : null,
                  },
                  {
                    label: "Avg Quality Score",
                    value: benchmarkStrip.avgQS.toFixed(0),
                    benchmark: benchmarkStrip.blendedAvgQS
                      ? `cat avg ${benchmarkStrip.blendedAvgQS.toFixed(0)}`
                      : null,
                    ratio: benchmarkStrip.blendedAvgQS
                      ? benchmarkStrip.avgQS / benchmarkStrip.blendedAvgQS
                      : null,
                  },
                  {
                    label: "12w Survival Rate",
                    value: fmtPct(benchmarkStrip.survived12, 0),
                    benchmark: benchmarkStrip.blendedSurv12
                      ? `cat benchmark ${fmtPct(benchmarkStrip.blendedSurv12, 0)}`
                      : null,
                    ratio: benchmarkStrip.blendedSurv12
                      ? benchmarkStrip.survived12 / benchmarkStrip.blendedSurv12
                      : null,
                  },
                  {
                    label: "Avg Promo Dep.",
                    value: fmtPct(benchmarkStrip.avgPromo, 0),
                    benchmark: "target <30%",
                    ratio: benchmarkStrip.avgPromo < 0.3 ? 1.1 : 0.9, // green if under threshold
                  },
                ].map(({ label, value, benchmark, ratio }) => {
                  const good = ratio !== null && ratio >= 1.0;
                  return (
                    <div key={label} className="flex items-start justify-between gap-2 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                      <div>
                        <div className="text-[10px] text-slate-400">{label}</div>
                        <div className={`text-sm font-bold ${good ? "text-green-600" : "text-amber-600"}`}>
                          {value}
                        </div>
                        {benchmark && (
                          <div className="text-[9px] text-slate-400">{benchmark}</div>
                        )}
                      </div>
                      {ratio !== null && (
                        <div className={`text-xs font-semibold px-1.5 py-0.5 rounded ${good ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                          {ratio >= 1 ? "▲" : "▼"} {Math.round(Math.abs(ratio - 1) * 100)}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">Apply filters to see benchmark comparison.</div>
            )}
          </div>
        </div>

        {/* Launch cards */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-sm">
            No launches match your filters. Try clearing some criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((l) => (
              <LaunchCard key={l.upc} launch={l} onClick={setSelected} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <LaunchDetailDrawer launch={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
