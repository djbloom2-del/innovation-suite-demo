"use client";

import type { Launch } from "@/lib/types";
import { QualityScoreGauge } from "@/components/shared/QualityScoreGauge";
import { Sparkline } from "@/components/shared/Sparkline";
import { getTimeSeries } from "@/data/timeseries";
import {
  fmt$,
  fmtN,
  fmtPct,
  fmtGrowth,
  growthColor,
  categoryColor,
  cn,
  OUTCOME_META,
  VELOCITY_TIER_META,
} from "@/lib/utils";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

interface Props {
  launch: Launch;
  onClick: (l: Launch) => void;
}

export function LaunchCard({ launch: l, onClick }: Props) {
  const series = getTimeSeries(l.upc);
  const sparkData = series.slice(-12).map((p) => p.dollars);

  const survivalIcon =
    l.survived26w === true ? (
      <CheckCircle2 size={12} className="text-green-500" />
    ) : l.survived26w === false ? (
      <XCircle size={12} className="text-red-400" />
    ) : (
      <Clock size={12} className="text-slate-300" />
    );

  return (
    <button
      onClick={() => onClick(l)}
      className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:shadow-md hover:border-blue-200 transition-all w-full"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <QualityScoreGauge score={l.launchQualityScore} size="md" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">
            {l.description}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white leading-tight"
              style={{ backgroundColor: categoryColor(l.category) }}
            >
              {l.category}
            </span>
            <span className="text-[10px] text-slate-400">{l.brand}</span>
          </div>
          {/* Lifecycle + Velocity badges */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full border", OUTCOME_META[l.launchOutcome].bgClass)}>
              {OUTCOME_META[l.launchOutcome].label}
            </span>
            <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full border", VELOCITY_TIER_META[l.velocityTier].bgClass)}>
              {VELOCITY_TIER_META[l.velocityTier].label} vel.
            </span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1 text-[10px] text-slate-400">
          {survivalIcon}
          <span>{l.ageWeeks}w</span>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: "$", value: fmt$(l.dollarsLatest) },
          { label: "$/Store", value: `$${l.velocityLatest.toFixed(0)}` },
          { label: "TDP", value: fmtN(l.tdpLatest, 0) },
          { label: "Promo", value: fmtPct(l.promoDependency, 0) },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-xs font-semibold text-slate-700 leading-tight">{value}</div>
            <div className="text-[9px] text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Sparkline + Growth */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-8">
          <Sparkline data={sparkData} color="#2563eb" />
        </div>
        <div
          className={cn(
            "text-xs font-semibold px-1.5 py-0.5 rounded",
            growthColor(l.growthRate12w)
          )}
        >
          {fmtGrowth(l.growthRate12w)} 12w
        </div>
      </div>

    </button>
  );
}
