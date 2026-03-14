"use client";

import { useState, useMemo } from "react";
import type { Category } from "@/lib/types";
import { CATEGORIES } from "@/data/categories";
import { LAUNCHES } from "@/data/launches";
import {
  getMonthlyLaunchCounts,
  getSurvivalCurveData,
  getAttributeAdoptionOverTime,
  buildCohortRows,
} from "@/data/cohorts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { categoryColor, fmtMonth, fmt$ } from "@/lib/utils";

const ATTR_COLORS: Record<string, string> = {
  protein: "#2563eb",
  organic: "#16a34a",
  nonGmo: "#0891b2",
  keto: "#7c3aed",
  vegan: "#d97706",
};

const ATTR_LABELS: Record<string, string> = {
  protein: "Protein",
  organic: "Organic",
  nonGmo: "Non-GMO",
  keto: "Keto",
  vegan: "Vegan",
};

export default function TrendEvolution() {
  const [selectedCategory, setSelectedCategory] = useState<Category | "All">("All");

  const monthlyCounts = useMemo(() => getMonthlyLaunchCounts(), []);
  const survivalData = useMemo(() => getSurvivalCurveData(), []);
  const adoptionData = useMemo(() => getAttributeAdoptionOverTime(), []);
  const cohortRows = useMemo(() => buildCohortRows(), []);

  // Heatmap: category × cohort month, color = medianScore
  const heatmapMonths = useMemo(() => {
    const months = Array.from(new Set(cohortRows.map((r) => r.cohortMonth))).sort();
    return months.slice(-12); // last 12 months
  }, [cohortRows]);

  const heatmapData = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const row: Record<string, string | number> = { category: cat };
      heatmapMonths.forEach((m) => {
        const match = cohortRows.find((r) => r.category === cat && r.cohortMonth === m);
        row[m] = match?.medianScore ?? 0;
      });
      return row;
    });
  }, [cohortRows, heatmapMonths]);

  function scoreToColor(score: number): string {
    if (score === 0) return "#f8fafc";
    if (score >= 65) return "#1d4ed8";
    if (score >= 50) return "#3b82f6";
    if (score >= 35) return "#93c5fd";
    return "#dbeafe";
  }

  const chartCounts = monthlyCounts.map((d) => ({
    ...d,
    month: fmtMonth(d.month),
  }));

  const adoptionChartData = adoptionData.map((d) => ({
    ...d,
    month: fmtMonth(d.month),
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Category filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-medium shrink-0">Category:</span>
        {(["All", ...CATEGORIES] as (Category | "All")[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              selectedCategory === cat
                ? "bg-blue-600 text-white border-blue-600"
                : "text-slate-600 border-slate-200 hover:border-blue-300"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Cohort launch volume */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Launch Volume by Cohort</h2>
          <p className="text-xs text-slate-400 mb-4">
            New product launches entering market per month (last 18 months)
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartCounts} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }}
                formatter={(v: any) => [v, "Launches"]}
              />
              <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} fillOpacity={0.85} name="Launches" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Survival curves */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Survival Curves by Cohort Vintage</h2>
          <p className="text-xs text-slate-400 mb-4">
            % of launches still active at each age milestone · 3 cohort vintages
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={survivalData} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `W${v}`}
              />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }}
                formatter={(v: any, name: any) => [`${v}%`, name]}
              />
              <Legend iconType="line" wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="cohort1" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="2025 H1" />
              <Line type="monotone" dataKey="cohort2" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} name="2024 H2" />
              <Line type="monotone" dataKey="cohort3" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} name="2024 H1" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend heatmap */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Quality Score Heatmap</h2>
        <p className="text-xs text-slate-400 mb-4">
          Median launch quality score by category × cohort month · darker = higher quality
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="text-left text-slate-500 font-medium pb-1 pr-3 w-28">Category</th>
                {heatmapMonths.map((m) => (
                  <th key={m} className="text-center text-slate-400 font-normal pb-1 min-w-[52px]">
                    {fmtMonth(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row) => (
                <tr key={row.category as string}>
                  <td className="text-slate-600 font-medium pr-3 py-0.5">{row.category}</td>
                  {heatmapMonths.map((m) => {
                    const score = row[m] as number;
                    return (
                      <td key={m} className="text-center py-0.5">
                        <div
                          className="rounded px-1 py-1.5 text-center text-[10px] font-medium"
                          style={{
                            backgroundColor: scoreToColor(score),
                            color: score >= 50 ? "white" : "#64748b",
                          }}
                        >
                          {score > 0 ? score : "—"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <span>Score:</span>
          {[
            { label: "<35", color: "#dbeafe" },
            { label: "35–50", color: "#93c5fd" },
            { label: "50–65", color: "#3b82f6" },
            { label: "65+", color: "#1d4ed8" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-6 h-3 rounded" style={{ backgroundColor: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cohort Velocity Ramp table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Cohort Velocity Ramp</h2>
        <p className="text-xs text-slate-400 mb-4">
          Average dollars at 4w, 12w, and 26w by launch vintage — shows how quickly each cohort ramps sales
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left pb-2 text-slate-400 font-medium">Vintage</th>
                <th className="text-right pb-2 text-slate-400 font-medium"># Launches</th>
                <th className="text-right pb-2 text-slate-400 font-medium">Avg $4w</th>
                <th className="text-right pb-2 text-slate-400 font-medium">Avg $12w</th>
                <th className="text-right pb-2 text-slate-400 font-medium">Avg $26w</th>
                <th className="text-right pb-2 text-slate-400 font-medium">Ramp 4→26w</th>
                <th className="text-right pb-2 text-slate-400 font-medium">Median QS</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  { label: "2025 H1", start: "2025-01-01", end: "2025-06-01" },
                  { label: "2024 H2", start: "2024-07-01", end: "2024-12-01" },
                  { label: "2024 H1", start: "2024-01-01", end: "2024-06-01" },
                ] as const
              ).map(({ label, start, end }) => {
                const launches = LAUNCHES.filter(
                  (l) => l.launchCohortMonth >= start && l.launchCohortMonth <= end
                );
                if (launches.length === 0) return null;
                const avg4w  = launches.reduce((s, l) => s + l.dollars4w, 0) / launches.length;
                const avg12w = launches.reduce((s, l) => s + l.dollars12w, 0) / launches.length;
                const withD26 = launches.filter((l) => l.dollars26w !== null);
                const avg26w = withD26.length > 0
                  ? withD26.reduce((s, l) => s + (l.dollars26w ?? 0), 0) / withD26.length
                  : null;
                const ramp = avg4w > 0 && avg26w !== null ? avg26w / avg4w : null;
                const scores = [...launches].map((l) => l.launchQualityScore).sort((a, b) => a - b);
                const medianQS = scores[Math.floor(scores.length / 2)] ?? 0;
                return (
                  <tr key={label} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2.5 font-semibold text-slate-700">{label}</td>
                    <td className="py-2.5 text-right text-slate-400">{launches.length}</td>
                    <td className="py-2.5 text-right text-slate-600">{fmt$(avg4w)}</td>
                    <td className="py-2.5 text-right text-slate-600">{fmt$(avg12w)}</td>
                    <td className="py-2.5 text-right text-slate-600">
                      {avg26w !== null ? fmt$(avg26w) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`py-2.5 text-right font-semibold ${ramp !== null && ramp >= 1.5 ? "text-green-600" : "text-amber-600"}`}>
                      {ramp !== null ? `${ramp.toFixed(1)}×` : "—"}
                    </td>
                    <td className="py-2.5 text-right text-slate-600">{medianQS}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[10px] text-slate-400">
          Ramp = avg$26w ÷ avg$4w · &gt;1.5× indicates strong distribution-driven revenue growth
        </div>
      </div>

      {/* Attribute adoption over time */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Attribute Adoption Trends</h2>
        <p className="text-xs text-slate-400 mb-4">
          % of new launches featuring each attribute · 12-month rolling view
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={adoptionChartData} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }}
              formatter={(v: any, name: any) => [`${v}%`, ATTR_LABELS[name as string] ?? name]}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} formatter={(v) => ATTR_LABELS[v] ?? v} />
            {Object.entries(ATTR_COLORS).map(([key, color]) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                fill={color}
                fillOpacity={0.08}
                strokeWidth={2}
                dot={false}
                name={key}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
