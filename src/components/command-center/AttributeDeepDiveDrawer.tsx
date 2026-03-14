"use client";

import type { Launch } from "@/lib/types";
import { LAUNCHES } from "@/data/launches";
import { X, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { fmt$, fmtPct, categoryColor } from "@/lib/utils";

interface Props {
  launches: Launch[];
  ingredientName: string;
  onClose: () => void;
}

function halfYear(dateStr: string): string {
  const [year, month] = dateStr.split("-").map(Number);
  return `${year} ${month <= 6 ? "H1" : "H2"}`;
}

function outcomeLabel(l: Launch) {
  if (l.launchQualityScore >= 70) return { label: "Winner", cls: "bg-green-100 text-green-700" };
  if (l.launchQualityScore >= 50) return { label: "Steady", cls: "bg-blue-100 text-blue-700" };
  return { label: "Fader", cls: "bg-slate-100 text-slate-500" };
}

export function AttributeDeepDiveDrawer({ launches, ingredientName, onClose }: Props) {
  const winCount = launches.filter((l) => l.launchQualityScore >= 70).length;
  const winRate = launches.length > 0 ? winCount / launches.length : 0;
  const avgVelocity =
    launches.length > 0
      ? launches.reduce((s, l) => s + l.velocityLatest, 0) / launches.length
      : 0;

  // Most-represented category
  const catCounts: Record<string, number> = {};
  launches.forEach((l) => {
    catCounts[l.category] = (catCounts[l.category] ?? 0) + 1;
  });
  const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  // Trend chart: ingredient $ share by half-year cohort
  const allPeriods = [...new Set(LAUNCHES.map((l) => halfYear(l.launchCohortMonth)))].sort();
  const chartData = allPeriods.map((period) => {
    const periodLaunches = LAUNCHES.filter(
      (l) => halfYear(l.launchCohortMonth) === period
    );
    const totalDollars = periodLaunches.reduce((s, l) => s + l.dollarsLatest, 0);
    const ingredDollars = periodLaunches
      .filter((l) => l.attributes.functionalIngredient === ingredientName)
      .reduce((s, l) => s + l.dollarsLatest, 0);
    const share =
      totalDollars > 0 ? Math.round((ingredDollars / totalDollars) * 1000) / 10 : 0;
    const count = periodLaunches.filter(
      (l) => l.attributes.functionalIngredient === ingredientName
    ).length;
    return { period, share, count };
  });

  // Top launches sorted by velocity
  const sorted = [...launches].sort((a, b) => b.velocityLatest - a.velocityLatest);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-xl bg-white shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start gap-3 z-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <TrendingUp size={16} className="text-purple-500 shrink-0" />
              <span className="text-sm font-semibold text-slate-800 leading-snug">
                {ingredientName}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                Trend Signal
              </span>
              {topCategory && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: categoryColor(topCategory as Launch["category"]) }}
                >
                  {topCategory}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
              <span>
                <span className="font-semibold text-slate-700">{launches.length}</span> launches
              </span>
              <span>
                <span
                  className={`font-semibold ${winRate >= 0.6 ? "text-green-600" : winRate >= 0.4 ? "text-amber-600" : "text-slate-600"}`}
                >
                  {Math.round(winRate * 100)}%
                </span>{" "}
                win rate
              </span>
              <span>
                Avg velocity{" "}
                <span className="font-semibold text-slate-700">
                  ${avgVelocity.toFixed(1)}/store
                </span>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 mt-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Adoption Trend Chart */}
          <section>
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
              $ Share of Category Revenue — by Cohort
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                  formatter={(v: any) => [`${v}%`, "$ Share"]}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <Line
                  type="monotone"
                  dataKey="share"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#a855f7" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-slate-400 mt-1">
              Share of total new-item dollars attributed to {ingredientName} launches, by launch cohort half-year
            </p>
          </section>

          {/* KPI cards */}
          <section className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-slate-800">{launches.length}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Total Launches</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-700">{Math.round(winRate * 100)}%</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Win Rate</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-700">
                {fmt$(launches.reduce((s, l) => s + l.dollarsLatest, 0))}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Combined $</div>
            </div>
          </section>

          {/* Top launches table */}
          <section>
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
              All {ingredientName} Launches — by Velocity
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-[10px] text-slate-400 font-medium pb-2">Product</th>
                    <th className="text-right text-[10px] text-slate-400 font-medium pb-2 pr-1">Vel</th>
                    <th className="text-right text-[10px] text-slate-400 font-medium pb-2 pr-1">QS</th>
                    <th className="text-right text-[10px] text-slate-400 font-medium pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((l) => {
                    const o = outcomeLabel(l);
                    return (
                      <tr key={l.upc} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 pr-2">
                          <div className="font-medium text-slate-700 truncate max-w-[200px]">
                            {l.description}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {l.brand} ·{" "}
                            <span
                              className="font-medium"
                              style={{ color: categoryColor(l.category) }}
                            >
                              {l.category}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 text-right pr-1 text-slate-600 font-medium tabular-nums">
                          ${l.velocityLatest.toFixed(1)}
                        </td>
                        <td className="py-2 text-right pr-1 text-slate-600 tabular-nums">
                          {l.launchQualityScore}
                        </td>
                        <td className="py-2 text-right">
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${o.cls}`}
                          >
                            {o.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
