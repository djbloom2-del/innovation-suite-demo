"use client";

import { useState, useMemo } from "react";
import type { Launch, LaunchFilters } from "@/lib/types";
import { LAUNCHES } from "@/data/launches";
import { CATEGORIES } from "@/data/categories";
import { applyLaunchFilters, DEFAULT_FILTERS } from "@/lib/filters";
import { categoryColor } from "@/lib/utils";
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
} from "recharts";

const TIMEFRAMES = [
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
  { label: "18M", months: 18 },
  { label: "24M", months: 24 },
];

function formatMonth(isoMonth: string): string {
  const [year, month] = isoMonth.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

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

    // Build map: month → { category → count }
    const monthMap: Record<string, Record<string, number>> = {};
    base.forEach((l) => {
      const m = l.launchCohortMonth.slice(0, 7); // "YYYY-MM"
      if (!monthMap[m]) monthMap[m] = {};
      monthMap[m][l.category] = (monthMap[m][l.category] || 0) + 1;
    });

    // Fill every month in range (even empty ones)
    const months: string[] = [];
    const cursor = new Date(cutoff);
    while (cursor <= now) {
      months.push(cursor.toISOString().slice(0, 7));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return months.map((m) => {
      const cats = monthMap[m] || {};
      const total = Object.values(cats).reduce((s, v) => s + v, 0);
      return { month: m, label: formatMonth(m), total, ...cats };
    });
  }, [chartCat, timeframe]);

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
              {/* Category pills */}
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
                        ? { backgroundColor: categoryColor(cat as typeof CATEGORIES[number]) }
                        : undefined
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {/* Timeframe pills */}
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
              <YAxis
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }}
                content={({ payload, label }) => {
                  if (!payload?.length) return null;
                  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs shadow-md">
                      <div className="font-semibold text-slate-700 mb-1">{label} — {total} launches</div>
                      {payload.map((p: any) => (
                        <div key={p.dataKey} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: p.fill }} />
                          <span className="text-slate-500">{p.dataKey}: {p.value}</span>
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
                  fill={categoryColor(cat as typeof CATEGORIES[number])}
                  radius={activeCats.indexOf(cat) === activeCats.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>

          {/* Category color legend (only shown for "All") */}
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
