"use client";

import { useState, useMemo } from "react";
import { BRANDS, getTopBrandsByGrowth } from "@/data/brands";
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
  LineChart,
  Line,
  Legend,
} from "recharts";
import { fmt$, fmtPct, categoryColor } from "@/lib/utils";
import { Trophy, Rocket, TrendingUp, Zap } from "lucide-react";

export default function BrandGrowthEngine() {
  const [selectedBrand, setSelectedBrand] = useState(BRANDS[0].name);
  const brand = useMemo(() => BRANDS.find((b) => b.name === selectedBrand)!, [selectedBrand]);
  const topBrands = getTopBrandsByGrowth(12);

  const growthPct = (brand.totalDollars - brand.totalDollarsPrior) / (brand.totalDollarsPrior || 1);
  const coreGrowth = brand.totalDollars - brand.totalDollarsPrior - brand.newItemDollars;

  // Proper waterfall: stacked bar with transparent base + colored change
  // coreGrowth can be negative (core declined), shown as red bar
  const coreLabel = coreGrowth >= 0 ? "Core Growth" : "Core Decline";
  const waterfallData = [
    { name: "Prior Year",   invisible: 0,                                                    bar: brand.totalDollarsPrior, type: "total"    },
    { name: coreLabel,      invisible: brand.totalDollarsPrior + Math.min(0, coreGrowth),    bar: Math.abs(coreGrowth),    type: coreGrowth >= 0 ? "positive" : "negative" },
    { name: "New Items",    invisible: brand.coreDollars,                                     bar: brand.newItemDollars,    type: "positive"  },
    { name: "Current Year", invisible: 0,                                                    bar: brand.totalDollars,      type: "total"    },
  ];

  // Brand scatter: launch count vs win rate
  const scatterData = BRANDS.map((b) => ({
    x: b.launchCount,
    y: Math.round(b.winRate * 100),
    z: b.totalDollars / 1_000_000,
    name: b.name,
    isSelected: b.name === selectedBrand,
  }));

  const scoreCards = [
    { icon: TrendingUp, label: "Total $ Growth", value: fmtPct(growthPct, 1), color: growthPct > 0 ? "text-green-600" : "text-red-500", bg: "bg-green-50" },
    { icon: Rocket, label: "New Item Share", value: fmtPct(brand.pctGrowthFromNewItems, 0), color: "text-blue-600", bg: "bg-blue-50" },
    { icon: Trophy, label: "Win Rate", value: fmtPct(brand.winRate, 0), color: "text-amber-600", bg: "bg-amber-50" },
    { icon: Zap, label: "$ per Launch", value: fmt$(brand.innovationScore), color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Brand selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-500 font-medium shrink-0">Brand:</span>
        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400"
        >
          {BRANDS.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name} ({b.company})
            </option>
          ))}
        </select>
        <div className="text-xs text-slate-400">
          {brand.categories.join(" · ")} · {brand.launchCount} launches
        </div>
      </div>

      {/* Scorecard row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {scoreCards.map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`${bg} p-2 rounded-lg shrink-0`}>
              <Icon size={16} className={color} />
            </div>
            <div>
              <div className={`text-xl font-bold leading-tight ${color}`}>{value}</div>
              <div className="text-xs text-slate-500 leading-tight">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Growth decomposition */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Growth Decomposition</h2>
          <p className="text-xs text-slate-400 mb-4">
            How much of growth comes from core vs new items (&lt;52w)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={waterfallData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v/1e6).toFixed(1)}M`} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: any, name: any) => name === "bar" ? [fmt$(v as number), ""] : null}
                contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }}
              />
              <Bar dataKey="invisible" stackId="wf" fill="transparent" />
              <Bar dataKey="bar" stackId="wf" radius={[4, 4, 0, 0]}>
                {waterfallData.map((d, idx) => (
                  <Cell key={idx} fill={d.type === "total" ? "#1e40af" : d.type === "positive" ? "#2563eb" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${coreGrowth >= 0 ? "bg-[#2563eb]" : "bg-red-500"}`} />
              <span className="text-slate-500">{coreLabel}: {coreGrowth >= 0 ? "" : "-"}{fmt$(Math.abs(coreGrowth))}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#2563eb]" />
              <span className="text-slate-500">New items: {fmt$(brand.newItemDollars)}</span>
            </div>
          </div>
        </div>

        {/* Launch count vs win rate scatter */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Innovation Efficiency</h2>
          <p className="text-xs text-slate-400 mb-4">
            Launch volume vs win rate. Bubble = brand size. Selected brand highlighted.
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="x" name="Launches" tick={{ fontSize: 10 }} label={{ value: "# Launches", position: "insideBottom", offset: -4, fontSize: 10 }} />
              <YAxis dataKey="y" name="Win Rate" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} label={{ value: "Win Rate", angle: -90, position: "insideLeft", offset: 12, fontSize: 10 }} />
              <ZAxis dataKey="z" range={[30, 300]} />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-2 text-xs shadow-md">
                      <div className="font-semibold">{d.name}</div>
                      <div>{d.x} launches · {d.y}% win rate</div>
                    </div>
                  );
                }}
              />
              <Scatter
                data={scatterData}
                fill="#2563eb"
                fillOpacity={0.6}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quality trend over time */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Launch Quality Trend</h2>
        <p className="text-xs text-slate-400 mb-4">
          Median launch quality score by cohort quarter for {brand.name}
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={brand.cohortQualityTrend} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="quarter" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }} />
            <Line type="monotone" dataKey="medianScore" stroke="#2563eb" strokeWidth={2} dot={{ r: 4, fill: "#2563eb" }} name="Median Quality Score" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top brands table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Brand Innovation Leaderboard</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                {["Brand", "Company", "Total $", "New Item $", "New Item Share", "Launches", "Win Rate", "$/Launch"].map((h) => (
                  <th key={h} className="text-left pb-2 text-slate-400 font-medium pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topBrands.map((b) => (
                <tr
                  key={b.name}
                  className={`border-b border-slate-50 cursor-pointer hover:bg-slate-50 ${b.name === selectedBrand ? "bg-blue-50" : ""}`}
                  onClick={() => setSelectedBrand(b.name)}
                >
                  <td className="py-2 font-medium text-slate-700 pr-4">{b.name}</td>
                  <td className="py-2 text-slate-400 pr-4">{b.company}</td>
                  <td className="py-2 pr-4">{fmt$(b.totalDollars)}</td>
                  <td className="py-2 text-blue-600 font-medium pr-4">{fmt$(b.newItemDollars)}</td>
                  <td className="py-2 text-green-600 font-medium pr-4">{Math.round(b.pctGrowthFromNewItems * 100)}%</td>
                  <td className="py-2 pr-4">{b.launchCount}</td>
                  <td className="py-2 pr-4">{Math.round(b.winRate * 100)}%</td>
                  <td className="py-2">{fmt$(b.innovationScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
