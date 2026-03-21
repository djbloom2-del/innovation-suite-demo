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
  CartesianGrid,
  LineChart,
  Line,
  Legend,
  ReferenceLine,
  Label,
} from "recharts";
import { fmt$, fmtPct, categoryColor, scoreHex } from "@/lib/utils";
import { LAUNCHES, getWinners } from "@/data/launches";
import { ATTR_KEYS, matchesAttr } from "@/data/attributes";
import { Trophy, Rocket, TrendingUp, Zap, AlertTriangle } from "lucide-react";

export default function BrandGrowthEngine() {
  const [selectedBrand, setSelectedBrand] = useState(BRANDS[0].name);
  const brand = useMemo(() => BRANDS.find((b) => b.name === selectedBrand)!, [selectedBrand]);
  const topBrands = getTopBrandsByGrowth(20);

  const growthPct = (brand.totalDollars - brand.totalDollarsPrior) / (brand.totalDollarsPrior || 1);
  const coreGrowth = brand.totalDollars - brand.totalDollarsPrior - brand.newItemDollars;

  // Brand-specific launches from LAUNCHES data
  const brandLaunches = useMemo(
    () => LAUNCHES.filter((l) => l.brand === selectedBrand),
    [selectedBrand]
  );

  // Revenue at Risk: launches with sharp 12w velocity declines
  const revenueAtRisk = useMemo(
    () => brandLaunches.filter((l) => l.survived12w && (l.growthRate12w ?? 0) < -0.15)
      .reduce((s, l) => s + l.dollarsLatest, 0),
    [brandLaunches]
  );

  // Attribute Portfolio Mix: for each attribute, count rate + win rate for this brand
  const attrPortfolio = useMemo(() => {
    if (brandLaunches.length === 0) return [];
    const brandWinRate = brandLaunches.length
      ? getWinners(brandLaunches).length / brandLaunches.length
      : 0;
    return ATTR_KEYS.map((attr) => {
      const withAttr  = brandLaunches.filter((l) => matchesAttr(l, attr));
      const winRate   = withAttr.length ? getWinners(withAttr).length / withAttr.length : 0;
      const pct       = brandLaunches.length ? withAttr.length / brandLaunches.length : 0;
      return { attr, count: withAttr.length, pct, winRate, lift: brandWinRate > 0 ? winRate / brandWinRate : 1 };
    }).sort((a, b) => b.pct - a.pct);
  }, [brandLaunches]);

  // Proper waterfall: stacked bar with transparent base + colored change
  // coreGrowth can be negative (core declined), shown as red bar
  const coreLabel = coreGrowth >= 0 ? "Core Growth" : "Core Decline";
  const waterfallData = [
    { name: "Prior Year",   invisible: 0,                                                    bar: brand.totalDollarsPrior, type: "total"    },
    { name: coreLabel,      invisible: brand.totalDollarsPrior + Math.min(0, coreGrowth),    bar: Math.abs(coreGrowth),    type: coreGrowth >= 0 ? "positive" : "negative" },
    { name: "New Items",    invisible: brand.coreDollars,                                     bar: brand.newItemDollars,    type: "positive"  },
    { name: "Current Year", invisible: 0,                                                    bar: brand.totalDollars,      type: "total"    },
  ];

  // New Item Contribution: sorted by pctGrowthFromNewItems desc, expressed as percent
  const newItemContribData = useMemo(
    () =>
      [...BRANDS]
        .sort((a, b) => b.pctGrowthFromNewItems - a.pctGrowthFromNewItems)
        .map((b) => ({
          name: b.name,
          share: parseFloat((b.pctGrowthFromNewItems * 100).toFixed(1)),
          totalDollars: b.totalDollars,
          isSelected: b.name === selectedBrand,
        })),
    [selectedBrand]
  );

  const scoreCards = [
    { icon: TrendingUp, label: "Total $ Growth", value: fmtPct(growthPct, 1), color: growthPct > 0 ? "text-green-600" : "text-red-500", bg: "bg-green-50" },
    { icon: Rocket, label: "New Item Share", value: fmtPct(brand.pctGrowthFromNewItems, 0), color: "text-blue-600", bg: "bg-blue-50" },
    { icon: Trophy, label: "Win Rate", value: fmtPct(brand.winRate, 0), color: "text-amber-600", bg: "bg-amber-50" },
    { icon: Zap, label: "$ per Launch", value: fmt$(brand.innovationScore), color: "text-purple-600", bg: "bg-purple-50" },
    { icon: AlertTriangle, label: "Revenue at Risk", value: fmt$(revenueAtRisk), color: revenueAtRisk > 0 ? "text-red-500" : "text-green-600", bg: "bg-red-50" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Brand Innovation Leaderboard — hero, full-width */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Brand Innovation Leaderboard</h2>
        <p className="text-xs text-slate-400 mb-4">Click a brand to explore its innovation portfolio</p>
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

      {/* Brand selector — secondary nav */}
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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

        {/* New Item Contribution horizontal bar chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">New Item Contribution</h2>
          <p className="text-xs text-slate-400 mb-4">
            New item $ as % of total brand dollars — healthy range is 15–40%
          </p>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              layout="vertical"
              data={newItemContribData}
              margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ payload, label }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-2 text-xs shadow-md">
                      <div className="font-semibold mb-1">{d.name}</div>
                      <div>{d.share.toFixed(1)}% of brand $ from new items</div>
                      <div className="text-slate-400">{fmt$(d.totalDollars)} total</div>
                    </div>
                  );
                }}
              />
              <ReferenceLine
                x={15}
                stroke="#64748b"
                strokeDasharray="4 3"
              >
                <Label value="Healthy Min" position="top" style={{ fontSize: 9, fill: "#64748b" }} />
              </ReferenceLine>
              <ReferenceLine
                x={40}
                stroke="#64748b"
                strokeDasharray="4 3"
              >
                <Label value="Healthy Max" position="top" style={{ fontSize: 9, fill: "#64748b" }} />
              </ReferenceLine>
              <Bar dataKey="share" radius={[0, 4, 4, 0]}>
                {newItemContribData.map((d, idx) => {
                  const share = d.share;
                  const fill =
                    share > 40 ? "#f59e0b" :
                    share >= 15 ? "#16a34a" :
                    "#94a3b8";
                  return (
                    <Cell
                      key={idx}
                      fill={fill}
                      stroke={d.isSelected ? "#2563eb" : "transparent"}
                      strokeWidth={d.isSelected ? 2 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
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

      {/* Attribute Portfolio Mix */}
      {attrPortfolio.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Attribute Portfolio Mix — {selectedBrand}</h2>
          <p className="text-xs text-slate-400 mb-4">
            Share of {selectedBrand} launches featuring each attribute + win rate vs. brand baseline
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left pb-2 text-slate-400 font-medium">Attribute</th>
                  <th className="text-right pb-2 text-slate-400 font-medium"># Launches</th>
                  <th className="text-right pb-2 text-slate-400 font-medium">Portfolio %</th>
                  <th className="text-left pb-2 text-slate-400 font-medium pl-4">Coverage</th>
                  <th className="text-right pb-2 text-slate-400 font-medium">Win Rate</th>
                  <th className="text-right pb-2 text-slate-400 font-medium">Lift</th>
                </tr>
              </thead>
              <tbody>
                {attrPortfolio.map((row) => {
                  const liftColor = row.lift >= 1.5 ? "text-green-600 font-semibold" : row.lift >= 1 ? "text-slate-600" : "text-amber-600";
                  return (
                    <tr key={row.attr} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 text-slate-700 font-medium">{row.attr}</td>
                      <td className="py-2 text-right text-slate-400">{row.count}</td>
                      <td className="py-2 text-right text-slate-600">{Math.round(row.pct * 100)}%</td>
                      <td className="py-2 pl-4">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${row.pct * 100}%`, backgroundColor: scoreHex(row.winRate * 100) }}
                          />
                        </div>
                      </td>
                      <td className="py-2 text-right font-semibold" style={{ color: scoreHex(row.winRate * 100) }}>
                        {Math.round(row.winRate * 100)}%
                      </td>
                      <td className={`py-2 text-right ${liftColor}`}>{row.lift.toFixed(1)}×</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {brandLaunches.length === 0 && (
            <div className="text-xs text-slate-400 italic text-center py-4">
              No matching LAUNCHES data for {selectedBrand}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
