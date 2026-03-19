"use client";

import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { LAUNCHES } from "@/data/launches";
import { getBenchmark } from "@/data/categories";
import { getTimeSeries } from "@/data/timeseries";
import { QualityScoreGauge } from "@/components/shared/QualityScoreGauge";
import { BenchmarkBar } from "@/components/shared/BenchmarkBar";
import { LaunchAttributeBadges } from "@/components/shared/AttributeBadge";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";
import {
  fmt$,
  fmtN,
  fmtPct,
  fmtGrowth,
  categoryColor,
  getDollarPerTdp,
  getCategoryTier,
  getPromoDepth,
  getGrowthContribution,
  OUTCOME_META,
  VELOCITY_TIER_META,
  cn,
  computeQualityScoreBreakdown,
  scoreHex,
} from "@/lib/utils";

export default function LaunchDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const launch = LAUNCHES.find((l) => l.upc === id);
  if (!launch) return notFound();

  const bench = getBenchmark(launch.category);
  const series = getTimeSeries(launch.upc);
  const dollarPerTdp = getDollarPerTdp(launch);
  const tier = getCategoryTier(launch, LAUNCHES);
  const promoDepth = getPromoDepth(launch);
  const growthContrib = getGrowthContribution(launch, bench.growthRate);
  const qsBreakdown = computeQualityScoreBreakdown(
    {
      velocityLatest: launch.velocityLatest,
      tdpLatest:      launch.tdpLatest,
      growthRate12w:  launch.growthRate12w,
      baseMix:        launch.baseMix,
      survived12w:    launch.survived12w,
      survived26w:    launch.survived26w,
      survived52w:    launch.survived52w,
    },
    bench
  );
  const tierColors =
    tier === "Top Third"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : tier === "Mid Third"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-slate-600 bg-slate-50 border-slate-200";

  const promoPrice = launch.baseMix > 0 && launch.promoDependency > 0
    ? Math.max(0, Math.min(launch.basePrice, (launch.priceLatest - launch.basePrice * launch.baseMix) / launch.promoDependency))
    : null;

  const chartData = series.map((p) => ({
    week: p.ageWeeks,
    dollars: Math.round(p.dollars),
    tdp: Math.round(p.tdp),
  }));

  const growthBarData = [
    { name: "This Item", growth: (launch.growthRate12w ?? 0) * 100 },
    { name: "Category", growth: bench.growthRate * 100 },
  ];

  const promoStackData = [
    {
      name: "Volume",
      base: launch.baseMix * 100,
      promo: launch.promoDependency * 100,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-start gap-4">
          <QualityScoreGauge score={launch.launchQualityScore} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/launches"
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                ← Launches
              </Link>
            </div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">
              {launch.description}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: categoryColor(launch.category) }}
              >
                {launch.category}
              </span>
              <span className="text-sm text-slate-500">
                {launch.brand} · {launch.company}
              </span>
              <span className="text-xs text-slate-400">
                {launch.ageWeeks}w old · {launch.retailer}
              </span>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", OUTCOME_META[launch.launchOutcome].bgClass)}>
                {OUTCOME_META[launch.launchOutcome].label}
              </span>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", VELOCITY_TIER_META[launch.velocityTier].bgClass)}>
                {VELOCITY_TIER_META[launch.velocityTier].label} velocity
              </span>
            </div>
            <div className="mt-2">
              <LaunchAttributeBadges
                attributes={launch.attributes}
                size="sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 py-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. 52-Week Performance chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">
                52-Week Performance
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={chartData}
                  margin={{ top: 4, right: 16, bottom: 0, left: -20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `w${v}`}
                    interval={6}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="dollars"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    name="$ Sales"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="tdp"
                    stroke="#16a34a"
                    strokeWidth={1.5}
                    dot={false}
                    name="TDP"
                    strokeDasharray="4 2"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 2. Year-by-Year Performance (only for 104w+ launches) */}
            {launch.ageWeeks >= 104 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-semibold text-slate-700">Year-by-Year Performance</h2>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", OUTCOME_META[launch.launchOutcome].bgClass)}>
                    {OUTCOME_META[launch.launchOutcome].label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Annual dollar revenue and velocity comparison — success requires Y2 to exceed Y1 in size or growth rate
                </p>
                {(() => {
                  const yearData = [
                    { year: "Year 1", dollars: launch.dollarsY1 ?? 0, velocity: launch.velocityY1 ?? 0, color: "#2563eb" },
                    ...(launch.dollarsY2 != null ? [{ year: "Year 2", dollars: launch.dollarsY2, velocity: launch.velocityY2 ?? 0, color: "#0d9488" }] : []),
                    ...(launch.dollarsY3 != null ? [{ year: "Year 3", dollars: launch.dollarsY3, velocity: launch.velocityY3 ?? 0, color: "#059669" }] : []),
                  ];
                  return (
                    <div>
                      <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={yearData} margin={{ top: 4, right: 48, bottom: 0, left: 8 }}>
                          <XAxis dataKey="year" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="dollars" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="velocity" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(v: any, name: any) => name === "dollars" ? [fmt$(v), "Annual $"] : [`$${Number(v).toFixed(1)}/store`, "Velocity"]} contentStyle={{ fontSize: 11 }} />
                          <Bar yAxisId="dollars" dataKey="dollars" radius={[4, 4, 0, 0]}>
                            {yearData.map((d) => <Cell key={d.year} fill={d.color} />)}
                          </Bar>
                          <Line yAxisId="velocity" type="monotone" dataKey="velocity" stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 4, fill: "#7c3aed" }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                      <div className="flex gap-6 mt-3 text-xs text-slate-600">
                        {launch.growthY1toY2 !== null && (
                          <span>Y1→Y2: <span className={launch.growthY1toY2 >= 0 ? "text-teal-600 font-semibold" : "text-orange-600 font-semibold"}>
                            {launch.growthY1toY2 >= 0 ? "+" : ""}{Math.round(launch.growthY1toY2 * 100)}%
                          </span></span>
                        )}
                        {launch.growthY2toY3 !== null && (
                          <span>Y2→Y3: <span className={launch.growthY2toY3 >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                            {launch.growthY2toY3 >= 0 ? "+" : ""}{Math.round(launch.growthY2toY3 * 100)}%
                          </span></span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 3. Competitive Position */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">
                Competitive Position
              </h2>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <div className="text-sm font-bold text-slate-700">
                    ${dollarPerTdp.toFixed(2)}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    $ per TDP
                  </div>
                </div>
                <div
                  className={`rounded-lg p-2.5 text-center border ${tierColors}`}
                >
                  <div className="text-sm font-bold">{tier}</div>
                  <div className="text-[9px] mt-0.5 opacity-70">
                    Category Tier
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-medium text-slate-500 mb-2">
                12w Growth vs. Category
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart
                  data={growthBarData}
                  layout="vertical"
                  margin={{ top: 4, right: 40, bottom: 4, left: 60 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    width={55}
                  />
                  <Tooltip
                    formatter={(v: any) => [
                      `${Number(v).toFixed(1)}%`,
                      "12w Growth",
                    ]}
                    contentStyle={{
                      fontSize: 11,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <Bar dataKey="growth" radius={[0, 3, 3, 0]}>
                    {growthBarData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.growth >= 0 ? "#16a34a" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {launch.growthRate12w != null && bench.growthRate > 0 && (
                <div className="text-[10px] text-slate-500 bg-slate-50 rounded-lg px-2.5 py-2 mt-2">
                  Growing at <span className="font-semibold text-slate-700">{(launch.growthRate12w / bench.growthRate).toFixed(1)}×</span> the {launch.category} category rate
                </div>
              )}
            </div>

            {/* 3. Promo Deep Dive */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">
                Promo Deep Dive
              </h2>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <div className="text-sm font-bold text-slate-700">
                    ${launch.basePrice.toFixed(2)}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    Base Price
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <div className="text-sm font-bold text-slate-700">
                    ${launch.priceLatest.toFixed(2)}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    Avg Price
                  </div>
                </div>
                {promoPrice != null && (
                  <div className="bg-amber-50 rounded-lg p-2.5 text-center border border-amber-100">
                    <div className="text-sm font-bold text-amber-700">${promoPrice.toFixed(2)}</div>
                    <div className="text-[9px] text-amber-500 mt-0.5">Promo Price</div>
                  </div>
                )}
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <div className="text-sm font-bold text-slate-700">
                    {(launch.promoDependency * 100).toFixed(0)}%
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    % On Promo
                  </div>
                </div>
              </div>

              {promoDepth > 0 && (
                <div className="text-[10px] text-slate-500 bg-slate-50 rounded-lg px-2.5 py-2 mb-3">
                  When on promo, discount is ~{(promoDepth * 100).toFixed(0)}%
                  off
                </div>
              )}

              {launch.promoDependency < 0.01 ? (
                <div className="text-[10px] text-slate-400 italic py-2">No promotional activity recorded</div>
              ) : (
              <>
              <div className="text-[10px] font-medium text-slate-500 mb-2">
                Volume split
              </div>
              <ResponsiveContainer width="100%" height={60}>
                <BarChart
                  data={promoStackData}
                  layout="vertical"
                  margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
                >
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip
                    formatter={(v: any, name: any) => [
                      `${Number(v).toFixed(0)}%`,
                      name === "base" ? "Base" : "Promo",
                    ]}
                    contentStyle={{
                      fontSize: 11,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <Bar
                    dataKey="base"
                    stackId="vol"
                    fill="#475569"
                    name="base"
                    radius={[3, 0, 0, 3]}
                  />
                  <Bar
                    dataKey="promo"
                    stackId="vol"
                    fill="#f59e0b"
                    name="promo"
                    radius={[0, 3, 3, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-slate-500">
                  Base {(launch.baseMix * 100).toFixed(0)}%
                </span>
                <span className="text-[9px] text-amber-600">
                  Promo {(launch.promoDependency * 100).toFixed(0)}%
                </span>
              </div>
              </>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-5">
            {/* 1. KPI cards */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">
                Key Metrics
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Current $", value: fmt$(launch.dollarsLatest) },
                  {
                    label: "Velocity",
                    value: `$${launch.velocityLatest.toFixed(1)}/store`,
                  },
                  { label: "TDP", value: fmtN(launch.tdpLatest, 0) },
                  {
                    label: "Stores",
                    value: fmtN(launch.storesSellingLatest, 0),
                  },
                  { label: "$ per TDP", value: `$${dollarPerTdp.toFixed(2)}` },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="bg-slate-50 rounded-lg p-2.5 text-center"
                  >
                    <div className="text-sm font-bold text-slate-700">
                      {value}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Score Breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700">Quality Score Breakdown</h2>
                <span
                  className="text-lg font-bold"
                  style={{ color: scoreHex(qsBreakdown.total) }}
                >
                  {qsBreakdown.total}
                </span>
              </div>
              <p className="text-[9px] text-slate-400 mb-3 leading-snug">
                50 = category median · 75 = outperforming · 100 = exceptional
              </p>
              <div className="space-y-2">
                {qsBreakdown.dimensions.map((d) => (
                  <div key={d.label} className="flex items-center gap-2">
                    {/* Label + values */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] font-medium text-slate-600">{d.label}</span>
                        <span className="text-[9px] text-slate-400 truncate ml-1">{d.value}</span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-slate-100 rounded-full mt-0.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${d.score}%`,
                            backgroundColor: scoreHex(d.score),
                          }}
                        />
                      </div>
                    </div>
                    {/* Sub-score + weight */}
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-bold" style={{ color: scoreHex(d.score) }}>
                        {d.score}
                      </div>
                      <div className="text-[8px] text-slate-300">{Math.round(d.weight * 100)}%</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[9px] text-slate-400 leading-relaxed">
                Velocity 35% · Distribution 25% · Growth 20% · Base Mix 15% · Survival 5%
              </div>
            </div>

            {/* 3. Milestones */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">
                Milestones
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "4w $", value: fmt$(launch.dollars4w) },
                  { label: "12w $", value: fmt$(launch.dollars12w) },
                  {
                    label: "26w $",
                    value:
                      launch.dollars26w != null
                        ? fmt$(launch.dollars26w)
                        : "—",
                  },
                  {
                    label: "52w $",
                    value:
                      launch.dollars52w != null
                        ? fmt$(launch.dollars52w)
                        : "—",
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="bg-slate-50 rounded-lg p-2.5 text-center"
                  >
                    <div className="text-sm font-bold text-slate-700">
                      {value}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Category Tier + Peer Benchmarks */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">
                Category Standing
              </h2>
              <div
                className={`w-full text-center text-xs font-semibold py-2 px-3 rounded-lg border mb-3 ${tierColors}`}
              >
                {tier}
              </div>
              <div className="space-y-2">
                <BenchmarkBar
                  label="Dollar Rank"
                  value={launch.dollarsPercentileVsCohort}
                  category={launch.category}
                />
                <BenchmarkBar
                  label="Velocity Rank"
                  value={launch.velocityPercentileVsCohort}
                  category={launch.category}
                />
                <BenchmarkBar
                  label="Distribution Rank"
                  value={launch.distributionPercentileVsCohort}
                  category={launch.category}
                />
              </div>
            </div>

            {/* 5. Distribution */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">
                Distribution
              </h2>
              <div className="space-y-2">
                {[
                  {
                    label: "Stores Selling",
                    value: fmtN(launch.storesSellingLatest, 0),
                  },
                  { label: "TDP", value: fmtN(launch.tdpLatest, 0) },
                  {
                    label: "TDP Gained Since Launch",
                    value:
                      launch.distributionGainSinceLaunch > 0
                        ? `+${fmtN(launch.distributionGainSinceLaunch, 0)}`
                        : fmtN(launch.distributionGainSinceLaunch, 0),
                  },
                  { label: "First Seen", value: launch.firstSeenDate },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0"
                  >
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-xs font-semibold text-slate-700">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 6. Relative Growth (conditional) */}
            {launch.growthRate12w != null && bench.growthRate > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5">
                <div className="text-xs font-semibold text-blue-700 mb-1">
                  Growth vs. Category
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {(launch.growthRate12w / bench.growthRate).toFixed(1)}×
                </div>
                <div className="text-[10px] text-blue-500 mt-0.5">
                  the {launch.category} category growth rate
                </div>
              </div>
            )}

            {/* 7. Links */}
            <div className="space-y-2">
              <Link
                href={`/analogs?upc=${launch.upc}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 border border-blue-200 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
              >
                Find Similar Launches →
              </Link>
              <Link
                href="/launches"
                className="flex items-center justify-center gap-2 w-full py-2.5 border border-slate-200 text-slate-500 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                ← Back to Launch Explorer
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
