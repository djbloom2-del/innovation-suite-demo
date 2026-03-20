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
import { X } from "lucide-react";
import { fmt$, fmtN, fmtPct, fmtGrowth, categoryColor, getDollarPerTdp, getCategoryTier, getPromoDepth, getGrowthContribution } from "@/lib/utils";
import { LAUNCHES } from "@/data/launches";
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

  const dollarPerTdp = getDollarPerTdp(l);
  const tier = getCategoryTier(l, LAUNCHES);
  const promoDepth = getPromoDepth(l);
  const growthContrib = getGrowthContribution(l, bench.growthRate);
  const tierColors =
    tier === "Top Third"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : tier === "Mid Third"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-slate-600 bg-slate-50 border-slate-200";

  const promoPrice = l.baseMix > 0 && l.promoDependency > 0
    ? Math.max(0, Math.min(l.basePrice, (l.priceLatest - l.basePrice * l.baseMix) / l.promoDependency))
    : null;

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

          {/* Competitive Position */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Competitive Position
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <div className="text-xs font-semibold text-slate-700">${dollarPerTdp.toFixed(2)}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">$ per TDP</div>
              </div>
              <div className={`rounded-lg p-2.5 text-center border ${tierColors}`}>
                <div className="text-xs font-semibold">{tier}</div>
                <div className="text-[9px] mt-0.5 opacity-70">Category Tier</div>
              </div>
            </div>
            <div className="space-y-2 mb-2">
              <div className="text-[10px] font-medium text-slate-500 mb-1">12w Growth vs. Category</div>
              {(() => {
                const itemGrowth = l.growthRate12w ?? 0;
                const catGrowth = bench.growthRate;
                const maxGrowth = Math.max(Math.abs(itemGrowth), Math.abs(catGrowth), 0.01);
                const itemPct = Math.min(Math.abs(itemGrowth) / maxGrowth * 100, 100);
                const catPct = Math.min(Math.abs(catGrowth) / maxGrowth * 100, 100);
                const itemBarColor = itemGrowth >= 0 ? "#16a34a" : "#ef4444";
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-16 shrink-0">This Item</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full" style={{ width: `${itemPct}%`, backgroundColor: itemBarColor }} />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-700 w-12 text-right">{fmtGrowth(l.growthRate12w)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-16 shrink-0">Category</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full" style={{ width: `${catPct}%`, backgroundColor: catGrowth >= 0 ? "#16a34a" : "#ef4444" }} />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-700 w-12 text-right">{fmtGrowth(bench.growthRate)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
            {l.growthRate12w != null && bench.growthRate > 0 && (
              <div className="text-[10px] text-slate-500 bg-slate-50 rounded-lg px-2.5 py-2">
                Growing at <span className="font-semibold text-slate-700">{(l.growthRate12w / bench.growthRate).toFixed(1)}×</span> the {l.category} category rate
              </div>
            )}
          </div>

          {/* Promo Deep Dive */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Promo Deep Dive
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <div className="text-xs font-semibold text-slate-700">${l.basePrice.toFixed(2)}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Base Price</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <div className="text-xs font-semibold text-slate-700">${l.priceLatest.toFixed(2)}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Avg Price</div>
              </div>
              {promoPrice != null && (
                <div className="bg-amber-50 rounded-lg p-2.5 text-center border border-amber-100">
                  <div className="text-xs font-semibold text-amber-700">${promoPrice.toFixed(2)}</div>
                  <div className="text-[9px] text-amber-500 mt-0.5">Promo Price</div>
                </div>
              )}
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <div className="text-xs font-semibold text-slate-700">{(l.promoDependency * 100).toFixed(0)}%</div>
                <div className="text-[9px] text-slate-400 mt-0.5">% On Promo</div>
              </div>
            </div>
            {promoDepth > 0 && (
              <div className="text-[10px] text-slate-500 bg-slate-50 rounded-lg px-2.5 py-2 mb-2">
                When on promo, discount is ~{(promoDepth * 100).toFixed(0)}% off
              </div>
            )}
            <div>
              <div className="text-[10px] text-slate-500 mb-1">Volume split</div>
              <div className="flex h-2 rounded-full overflow-hidden">
                <div
                  className="h-2"
                  style={{ width: `${(l.baseMix * 100).toFixed(0)}%`, backgroundColor: "#475569" }}
                />
                <div
                  className="h-2"
                  style={{ width: `${(l.promoDependency * 100).toFixed(0)}%`, backgroundColor: "#f59e0b" }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-slate-500">Base {(l.baseMix * 100).toFixed(0)}%</span>
                <span className="text-[9px] text-amber-600">Promo {(l.promoDependency * 100).toFixed(0)}%</span>
              </div>
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

          {/* View Full Analysis */}
          <Link
            href={`/launches/${l.upc}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            View Full Analysis →
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
