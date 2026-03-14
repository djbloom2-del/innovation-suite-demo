"use client";

import type { Launch } from "@/lib/types";
import { getTimeSeries } from "@/data/timeseries";
import { getBenchmark } from "@/data/categories";
import { QualityScoreGauge } from "@/components/shared/QualityScoreGauge";
import { BenchmarkBar } from "@/components/shared/BenchmarkBar";
import { LaunchAttributeBadges } from "@/components/shared/AttributeBadge";
import { RedditFeed } from "@/components/social/RedditFeed";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { X, SearchCode } from "lucide-react";
import { fmt$, fmtN, fmtPct, fmtGrowth, growthColor, categoryColor } from "@/lib/utils";
import Link from "next/link";

interface Props {
  launch: Launch;
  onClose: () => void;
}

function buildRedditQuery(l: Launch): string {
  const catMap: Record<string, string> = {
    Bars: "snack bar",
    Beverages: "drink beverage",
    Snacks: "snack chips",
    Supplements: "supplement",
    "Frozen Meals": "frozen meal",
  };
  const parts: string[] = [catMap[l.category] ?? l.category.toLowerCase()];

  if (l.attributes.functionalIngredient) {
    parts.push(l.attributes.functionalIngredient.toLowerCase());
  } else if (l.attributes.healthFocus) {
    parts.push(l.attributes.healthFocus.toLowerCase());
  }

  const claim =
    l.attributes.isOrganic        ? "organic"       :
    l.attributes.isKeto           ? "keto"           :
    l.attributes.isVegan          ? "vegan"          :
    l.attributes.isGlutenFree     ? "gluten free"    :
    l.attributes.isProteinFocused ? "high protein"   : null;

  if (claim) parts.push(claim);
  return parts.join(" ");
}

export function LaunchDetailDrawer({ launch: l, onClose }: Props) {
  const series = getTimeSeries(l.upc);
  const bench = getBenchmark(l.category);

  const chartData = series.map((p) => ({
    week: p.ageWeeks,
    dollars: Math.round(p.dollars),
    tdp: Math.round(p.tdp),
    velocity: Math.round(p.velocity),
  }));

  const metrics = [
    { label: "Current $", value: fmt$(l.dollarsLatest) },
    { label: "Velocity", value: `$${l.velocityLatest.toFixed(1)}/store` },
    { label: "TDP", value: fmtN(l.tdpLatest, 0) },
    { label: "Stores", value: fmtN(l.storesSellingLatest, 0) },
    { label: "Price", value: `$${l.priceLatest.toFixed(2)}` },
    { label: "Price Index", value: `${(l.priceIndexVsCategory * 100).toFixed(0)}` },
    { label: "Promo Mix", value: fmtPct(l.promoDependency, 0) },
    { label: "Base Mix", value: fmtPct(l.baseMix, 0) },
    { label: "12w Growth", value: fmtGrowth(l.growthRate12w) },
    { label: "YAGO Growth", value: l.growthRateYago != null ? fmtGrowth(l.growthRateYago) : "—" },
    { label: "Share", value: `${(l.dollarShareCategory * 100).toFixed(2)}%` },
    { label: "Age", value: `${l.ageWeeks}w` },
  ];

  const milestones = [
    { label: "4w $", value: fmt$(l.dollars4w) },
    { label: "12w $", value: fmt$(l.dollars12w) },
    { label: "26w $", value: l.dollars26w != null ? fmt$(l.dollars26w) : "—" },
    { label: "52w $", value: l.dollars52w != null ? fmt$(l.dollars52w) : "—" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-xl bg-white shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start gap-3 z-10">
          <QualityScoreGauge score={l.launchQualityScore} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800 leading-snug">{l.description}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: categoryColor(l.category) }}
              >
                {l.category}
              </span>
              <span className="text-xs text-slate-500">{l.brand} · {l.company}</span>
              <span className="text-xs text-slate-400">{l.ageWeeks}w old · {l.firstSeenDate}</span>
            </div>
            <div className="mt-1.5">
              <LaunchAttributeBadges attributes={l.attributes} size="sm" />
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {/* Benchmarks */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Peer Benchmarks vs {l.category} cohort
            </div>
            <div className="space-y-2">
              <BenchmarkBar label="Dollar Rank" value={l.dollarsPercentileVsCohort} category={l.category} />
              <BenchmarkBar label="Velocity Rank" value={l.velocityPercentileVsCohort} category={l.category} />
              <BenchmarkBar label="Distribution Rank" value={l.distributionPercentileVsCohort} category={l.category} />
            </div>
          </div>

          {/* 52-week trend chart */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              52-Week Performance
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={(v) => `w${v}`} interval={6} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line yAxisId="left" type="monotone" dataKey="dollars" stroke="#2563eb" strokeWidth={2} dot={false} name="$ Sales" />
                <Line yAxisId="right" type="monotone" dataKey="tdp" stroke="#16a34a" strokeWidth={1.5} dot={false} name="TDP" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Key metrics grid */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Key Metrics
            </div>
            <div className="grid grid-cols-3 gap-2">
              {metrics.map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <div className="text-xs font-semibold text-slate-700">{value}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Milestones */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Cumulative Milestones
            </div>
            <div className="grid grid-cols-4 gap-2">
              {milestones.map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <div className="text-xs font-semibold text-slate-700">{value}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Dist gain */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5">
            <div className="text-xs font-semibold text-blue-700 mb-1">Distribution Gain Since Launch</div>
            <div className="text-2xl font-bold text-blue-600">
              +{fmtN(l.distributionGainSinceLaunch, 0)} TDP
            </div>
            <div className="text-[10px] text-blue-500 mt-0.5">
              {l.launchCohortMonth} → today · {l.category} benchmark 12w: {fmtN(bench.medianTdp12w, 0)} TDP
            </div>
          </div>

          {/* Find Analogs */}
          <Link
            href={`/analogs?upc=${l.upc}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 border border-blue-200 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            <SearchCode size={15} />
            Find Similar Historical Launches
          </Link>

          {/* Consumer Discussions */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Consumer Discussions — Reddit
            </div>
            <RedditFeed
              query={buildRedditQuery(l)}
              sort="relevance"
              timePeriod="month"
              limit={5}
              emptyMessage="No recent Reddit discussions found for this product type."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
