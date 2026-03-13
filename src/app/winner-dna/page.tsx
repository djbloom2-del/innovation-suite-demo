"use client";

import { useState, useMemo } from "react";
import type { Category } from "@/lib/types";
import { CATEGORIES } from "@/data/categories";
import {
  getAttributePerfByCategory,
  getTopAttributesByWinRate,
  getRisingUnderpenetrated,
  ATTRIBUTE_COMBOS,
} from "@/data/attributes";
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
  Legend,
} from "recharts";
import { TrendingUp, Zap } from "lucide-react";

const ATTR_COLORS = [
  "#2563eb","#16a34a","#7c3aed","#d97706","#0891b2","#db2777","#059669","#9333ea",
];

export default function WinnerDNA() {
  const [category, setCategory] = useState<Category>("Bars");

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

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
        <span className="text-xs text-slate-500 font-medium">Category:</span>
        <div className="flex gap-2">
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
              <XAxis dataKey="x" name="Launches" tick={{ fontSize: 10 }} label={{ value: "Launch Count", position: "insideBottom", offset: -4, fontSize: 10 }} />
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
    </div>
  );
}
