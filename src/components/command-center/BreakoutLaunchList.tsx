import Link from "next/link";
import { getBreakoutLaunches } from "@/data/launches";
import { getTimeSeries } from "@/data/timeseries";
import { QualityScoreGauge } from "@/components/shared/QualityScoreGauge";
import { Sparkline } from "@/components/shared/Sparkline";
import { fmt$, fmtGrowth, growthColor, categoryColor } from "@/lib/utils";

export function BreakoutLaunchList() {
  const breakouts = getBreakoutLaunches(6);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">Top Breakout Launches</h2>
        <Link href="/launches" className="text-xs text-blue-600 hover:underline">
          View all →
        </Link>
      </div>
      <div className="space-y-3">
        {breakouts.map((l) => {
          const series = getTimeSeries(l.upc);
          const sparkData = series.slice(-12).map((p) => p.velocity);
          const growth = l.growthRate12w;

          return (
            <Link
              key={l.upc}
              href={`/launches?upc=${l.upc}`}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <QualityScoreGauge score={l.launchQualityScore} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-800 truncate">{l.description}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[9px] font-medium px-1 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: categoryColor(l.category) }}
                  >
                    {l.category}
                  </span>
                  <span className="text-[10px] text-slate-400">{l.brand}</span>
                </div>
              </div>
              <div className="w-20 h-8 shrink-0">
                <Sparkline data={sparkData} color="#2563eb" />
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-semibold text-slate-700">
                  {fmt$(l.dollarsLatest)}
                </div>
                <div className={`text-[10px] font-medium ${growthColor(growth)}`}>
                  {fmtGrowth(growth)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
