"use client";

import { useState, useMemo } from "react";
import type { Category, InnovationType } from "@/lib/types";
import { CATEGORIES } from "@/data/categories";
import { LAUNCHES } from "@/data/launches";
import {
  getNeedStatePerformance,
  getNeedStateTrends,
  getNeedStateByInnoType,
  NEED_STATE_META,
} from "@/data/needStates";
import { INNOVATION_TYPE_META } from "@/lib/innovation";
import { getMonthlyLaunchCounts } from "@/data/cohorts";
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
  Cell,
  LabelList,
} from "recharts";
import { fmtMonth, fmt$ } from "@/lib/utils";

// ── Custom Tooltips ──────────────────────────────────────────────────────────

const NsLandscapeTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-slate-800">{d.needState}</p>
      <p className="text-slate-600">Launches: <span className="font-medium text-slate-800">{d.launchCount}</span></p>
      <p className="text-slate-600">Win Rate: <span className="font-medium text-slate-800">{(d.winRate).toFixed(0)}%</span></p>
      <p className="text-slate-600">Avg Quality Score: <span className="font-medium text-slate-800">{d.avgQualityScore.toFixed(0)}</span></p>
      <p className="text-slate-600">Avg Velocity: <span className="font-medium text-slate-800">{fmt$(d.avgVelocity)}/store</span></p>
    </div>
  );
};

const InnoWinTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-slate-800">{d.innoType}</p>
      <p className="text-slate-600">Count: <span className="font-medium text-slate-800">{d.count}</span></p>
      <p className="text-slate-600">Win Rate: <span className="font-medium text-slate-800">{d.winRate.toFixed(0)}%</span></p>
      <p className="text-slate-600">Avg Quality Score: <span className="font-medium text-slate-800">{d.avgQualityScore.toFixed(0)}</span></p>
    </div>
  );
};

const InnoVolumeTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-slate-800">{d.innoType}</p>
      <p className="text-slate-600">Launches: <span className="font-medium text-slate-800">{d.count}</span></p>
    </div>
  );
};

const MonthlyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      <p className="text-slate-600">Launches: <span className="font-medium text-slate-800">{payload[0].value}</span></p>
    </div>
  );
};

// ── Helper ───────────────────────────────────────────────────────────────────

function cellBg(count: number): string {
  if (count === 0) return "bg-slate-50 text-slate-300";
  if (count <= 2) return "bg-blue-100 text-blue-700";
  if (count <= 4) return "bg-blue-300 text-blue-900";
  return "bg-blue-500 text-white";
}

// ── The 5 innovation types we care about (no Unclassified) ───────────────────
type CoreInnoType = "New to World" | "Flavor Extension" | "Format Extension" | "Category Extension" | "Pack Size Variant";

const INNO_TYPES: CoreInnoType[] = [
  "New to World",
  "Flavor Extension",
  "Format Extension",
  "Category Extension",
  "Pack Size Variant",
];

const INNO_TYPE_SHORT: Partial<Record<CoreInnoType, string>> = {
  "Flavor Extension": "Flavor Ext.",
  "Format Extension": "Format Ext.",
  "Category Extension": "Category Ext.",
  "Pack Size Variant": "Pack Size",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TrendEvolution() {
  const [selectedCategory, setSelectedCategory] = useState<Category | "All">("All");

  const filteredLaunches = useMemo(
    () =>
      selectedCategory === "All"
        ? LAUNCHES
        : LAUNCHES.filter((l) => l.category === selectedCategory),
    [selectedCategory]
  );

  // Section 1 — Need State Landscape
  const nsPerf = useMemo(() => getNeedStatePerformance(filteredLaunches), [filteredLaunches]);

  // Normalise winRate to 0–100 for display (getNeedStatePerformance returns 0–1)
  const nsPerfDisplay = useMemo(
    () => nsPerf.map((r) => ({ ...r, winRate: r.winRate * 100 })),
    [nsPerf]
  );

  // Section 2 — Need State Momentum
  const nsTrends = useMemo(() => getNeedStateTrends(filteredLaunches), [filteredLaunches]);
  const top6 = useMemo(() => nsPerf.slice(0, 6).map((r) => r.needState), [nsPerf]);
  const nsTrendsDisplay = useMemo(
    () => nsTrends.map((row) => ({ ...row, month: fmtMonth(row.month) })),
    [nsTrends]
  );

  // Section 3 — Innovation Type Performance
  const innoPerf = useMemo(() => {
    return INNO_TYPES.map((innoType) => {
      const group = filteredLaunches.filter((l) => l.innovationType === innoType);
      const count = group.length;
      const winners = group.filter((l) => l.launchQualityScore >= 70);
      const winRate = count > 0 ? (winners.length / count) * 100 : 0;
      const avgQualityScore =
        count > 0 ? group.reduce((s, l) => s + l.launchQualityScore, 0) / count : 0;
      return { innoType, count, winRate, avgQualityScore };
    });
  }, [filteredLaunches]);

  const innoWinRates = useMemo(
    () => [...innoPerf].sort((a, b) => b.winRate - a.winRate),
    [innoPerf]
  );

  // Section 4 — Need State × Innovation Type
  const nsInnoRows = useMemo(() => getNeedStateByInnoType(filteredLaunches), [filteredLaunches]);

  // Supplemental — Monthly Launch Volume
  const monthlyCounts = useMemo(() => {
    const raw = getMonthlyLaunchCounts(filteredLaunches);
    return raw.map((d) => ({ ...d, month: fmtMonth(d.month) }));
  }, [filteredLaunches]);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Category filter bar */}
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

      {/* Section 1: Need State Landscape */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-800">Need State Landscape</h2>
        <p className="text-sm text-slate-500 mb-4">
          Consumer need states addressed by recent launches — launch count and success rate
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            layout="vertical"
            data={nsPerfDisplay}
            margin={{ top: 5, right: 140, left: 10, bottom: 5 }}
          >
            <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              dataKey="needState"
              type="category"
              width={160}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<NsLandscapeTooltip />} />
            <Bar dataKey="launchCount" radius={[0, 4, 4, 0]} name="Launches">
              {nsPerfDisplay.map((row) => (
                <Cell key={row.needState} fill={NEED_STATE_META[row.needState].hex} />
              ))}
              <LabelList
                dataKey="winRate"
                position="right"
                formatter={(v: any) => `${Number(v).toFixed(0)}% success`}
                style={{ fontSize: 10, fill: "#64748b" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Section 2: Need State Momentum */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-800">Need State Momentum</h2>
        <p className="text-sm text-slate-500 mb-4">
          Monthly launch volume by need state — which needs are attracting more innovation over time
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={nsTrendsDisplay}
            margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
            {top6.map((ns) => (
              <Line
                key={ns}
                type="monotone"
                dataKey={ns}
                stroke={NEED_STATE_META[ns].hex}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Section 3: Innovation Type Performance */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Innovation Type Performance</h2>
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Win Rates */}
          <div>
            <p className="text-sm text-slate-500 mb-3">Win Rates by Type</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                layout="vertical"
                data={innoWinRates}
                margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                />
                <YAxis
                  dataKey="innoType"
                  type="category"
                  width={110}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: any) => INNO_TYPE_SHORT[v as CoreInnoType] ?? v}
                />
                <Tooltip content={<InnoWinTooltip />} />
                <Bar dataKey="winRate" radius={[0, 4, 4, 0]} name="Win Rate">
                  {innoWinRates.map((row) => (
                    <Cell
                      key={row.innoType}
                      fill={INNOVATION_TYPE_META[row.innoType].chartColor}
                    />
                  ))}
                  <LabelList
                    dataKey="winRate"
                    position="right"
                    formatter={(v: any) => `${Number(v).toFixed(0)}%`}
                    style={{ fontSize: 10, fill: "#64748b" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Right: Launch Volume */}
          <div>
            <p className="text-sm text-slate-500 mb-3">Launch Volume by Type</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={innoPerf}
                margin={{ top: 5, right: 20, left: -10, bottom: 40 }}
              >
                <XAxis
                  dataKey="innoType"
                  tick={{ fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: any) => INNO_TYPE_SHORT[v as CoreInnoType] ?? v}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<InnoVolumeTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Launches">
                  {innoPerf.map((row) => (
                    <Cell
                      key={row.innoType}
                      fill={INNOVATION_TYPE_META[row.innoType].chartColor}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Section 4: Need State × Innovation Type table */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-800">
          What Types of Innovation Are Going After Each Need?
        </h2>
        <p className="text-sm text-slate-500 mb-4">Launch type breakdown by consumer need state</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="text-left text-slate-500 font-medium pb-2 pr-3 w-44">Need State</th>
                {INNO_TYPES.map((t) => (
                  <th key={t} className="text-center text-slate-500 font-medium pb-2 min-w-[80px] px-1">
                    {INNO_TYPE_SHORT[t] ?? t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nsInnoRows.map((row) => (
                <tr key={row.needState}>
                  <td className="text-slate-700 font-medium pr-3 py-0.5 text-[11px]">{row.needState}</td>
                  {INNO_TYPES.map((t) => {
                    const count = row[t];
                    return (
                      <td key={t} className="text-center py-0.5">
                        <div className={`rounded px-1 py-1.5 text-center font-medium ${cellBg(count)}`}>
                          {count > 0 ? count : "—"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-400">
          <span>Heat:</span>
          {[
            { label: "0", cls: "bg-slate-50" },
            { label: "1–2", cls: "bg-blue-100" },
            { label: "3–4", cls: "bg-blue-300" },
            { label: "5+", cls: "bg-blue-500" },
          ].map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-5 h-3 rounded ${cls}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Supplemental: Monthly Launch Volume */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Monthly Launch Volume</h2>
        <p className="text-xs text-slate-400 mb-3">
          New product launches entering market per month (last 18 months)
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyCounts} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval={2}
            />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<MonthlyTooltip />} />
            <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} fillOpacity={0.85} name="Launches" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
