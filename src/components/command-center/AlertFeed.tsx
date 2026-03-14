import { AlertCircle, TrendingUp, Rocket, Eye } from "lucide-react";
import { LAUNCHES } from "@/data/launches";

// ── Derive alerts from actual LAUNCHES data ───────────────────────────────────

// 1. Breakout signals: high velocity percentile + positive 12w growth
const breakouts = LAUNCHES.filter(
  (l) => l.velocityPercentileVsCohort >= 82 && (l.growthRate12w ?? 0) > 0.12
)
  .sort((a, b) => b.velocityPercentileVsCohort - a.velocityPercentileVsCohort)
  .slice(0, 2)
  .map((l) => ({
    type: "breakout",
    icon: TrendingUp,
    iconColor: "text-green-500",
    bg: "bg-green-50 border-green-200",
    title: `Breakout: ${l.description.length > 42 ? l.description.slice(0, 42) + "…" : l.description}`,
    desc: `P${l.velocityPercentileVsCohort} velocity vs. ${l.category} cohort · +${Math.round((l.growthRate12w ?? 0) * 100)}% 12w growth · ${l.brand}`,
    time: `${l.ageWeeks}w old`,
  }));

// 2. Newest entries (≤ 10 weeks)
const newArrivals = LAUNCHES.filter((l) => l.ageWeeks <= 10)
  .sort((a, b) => a.ageWeeks - b.ageWeeks)
  .slice(0, 1)
  .map((l) => ({
    type: "new_launch",
    icon: Rocket,
    iconColor: "text-blue-500",
    bg: "bg-blue-50 border-blue-200",
    title: `New Launch: ${l.description.length > 42 ? l.description.slice(0, 42) + "…" : l.description}`,
    desc: `${l.brand} · ${l.category} · ${l.ageWeeks}w on shelf · Early velocity P${l.velocityPercentileVsCohort} vs. cohort`,
    time: `${l.ageWeeks}w ago`,
  }));

// 3. Top functional ingredient by winner concentration
const ingreds: Record<string, typeof LAUNCHES> = {};
LAUNCHES.filter((l) => l.attributes.functionalIngredient !== null).forEach((l) => {
  const k = l.attributes.functionalIngredient!;
  if (!ingreds[k]) ingreds[k] = [];
  ingreds[k].push(l);
});
const topIngred = Object.entries(ingreds)
  .map(([name, ls]) => ({
    name,
    count: ls.length,
    winRate: ls.filter((l) => l.launchQualityScore >= 70).length / ls.length,
  }))
  .filter((x) => x.count >= 3)
  .sort((a, b) => b.winRate - a.winRate)[0];

const trendAlerts = topIngred
  ? [
      {
        type: "trend",
        icon: Eye,
        iconColor: "text-purple-500",
        bg: "bg-purple-50 border-purple-200",
        title: `Trend Signal: ${topIngred.name} launches accelerating`,
        desc: `${topIngred.count} launches featuring ${topIngred.name} — ${Math.round(topIngred.winRate * 100)}% are top-quartile winners.`,
        time: "Trend",
      },
    ]
  : [];

// 4. At-risk: sharpest velocity declines among surviving launches
const atRisk = LAUNCHES.filter((l) => l.survived12w && (l.growthRate12w ?? 0) < -0.15)
  .sort((a, b) => (a.growthRate12w ?? 0) - (b.growthRate12w ?? 0))
  .slice(0, 1)
  .map((l) => ({
    type: "warn",
    icon: AlertCircle,
    iconColor: "text-amber-500",
    bg: "bg-amber-50 border-amber-200",
    title: `At Risk: ${l.description.length > 42 ? l.description.slice(0, 42) + "…" : l.description}`,
    desc: `Velocity ${Math.round((l.growthRate12w ?? 0) * 100)}% in 12 weeks · ${l.category} · distribution contracting`,
    time: `${l.ageWeeks}w old`,
  }));

const ALERTS = [...breakouts, ...newArrivals, ...trendAlerts, ...atRisk].slice(0, 5);

// ─────────────────────────────────────────────────────────────────────────────

export function AlertFeed() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">
        Alerts{" "}
        <span className="text-[10px] font-normal text-slate-400 ml-1">live from LAUNCHES data</span>
      </h2>
      <div className="space-y-2.5">
        {ALERTS.map((a, i) => {
          const Icon = a.icon;
          return (
            <div key={i} className={`flex gap-3 p-3 rounded-lg border ${a.bg}`}>
              <Icon size={15} className={`${a.iconColor} shrink-0 mt-0.5`} />
              <div>
                <div className="text-xs font-semibold text-slate-700 leading-tight">{a.title}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{a.desc}</div>
                <div className="text-[9px] text-slate-400 mt-1">{a.time}</div>
              </div>
            </div>
          );
        })}
        {ALERTS.length === 0 && (
          <div className="text-xs text-slate-400 italic py-4 text-center">
            No active alerts detected.
          </div>
        )}
      </div>
    </div>
  );
}
