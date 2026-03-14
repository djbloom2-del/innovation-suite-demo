import { CATEGORY_BENCHMARKS } from "@/data/categories";
import { LAUNCHES, getWinners } from "@/data/launches";
import { categoryColor } from "@/lib/utils";

export function CategoryPulse() {
  const catStats = CATEGORY_BENCHMARKS.map((b) => {
    const catLaunches = LAUNCHES.filter((l) => l.category === b.category);
    const avgVelocity =
      catLaunches.length
        ? catLaunches.reduce((s, l) => s + l.velocityLatest, 0) / catLaunches.length
        : 0;
    const velVsMedian = b.medianVelocity12w > 0 ? avgVelocity / b.medianVelocity12w : 1;
    const winRate = catLaunches.length
      ? getWinners(catLaunches).length / catLaunches.length
      : 0;

    return {
      category: b.category,
      avgVelocity,
      velVsMedian,
      growthRate: b.growthRate,
      crowdingScore: b.crowdingScore,
      winRate,
      launchCount: catLaunches.length,
    };
  });

  return (
    <div className="grid grid-cols-5 gap-3">
      {catStats.map((c) => {
        const color = categoryColor(c.category);
        const velUp = c.velVsMedian >= 1.0;
        const velColor =
          c.velVsMedian >= 1.15
            ? "text-green-600"
            : c.velVsMedian >= 0.85
            ? "text-slate-700"
            : "text-amber-600";
        const crowdBg =
          c.crowdingScore >= 7
            ? "bg-red-50 text-red-600"
            : c.crowdingScore >= 5
            ? "bg-amber-50 text-amber-600"
            : "bg-green-50 text-green-600";

        return (
          <div key={c.category} className="bg-white rounded-xl border border-slate-200 p-4">
            {/* Category label */}
            <div
              className="text-[10px] font-bold uppercase tracking-wide mb-2.5 px-2 py-0.5 rounded-full w-fit text-white leading-tight"
              style={{ backgroundColor: color }}
            >
              {c.category}
            </div>

            {/* Velocity */}
            <div className={`text-xl font-bold leading-tight ${velColor}`}>
              ${c.avgVelocity.toFixed(0)}
            </div>
            <div className="text-[10px] text-slate-400 leading-tight">$/store/wk avg</div>

            {/* vs. median */}
            <div className={`text-xs font-semibold mt-1.5 ${velColor}`}>
              {c.velVsMedian.toFixed(2)}× cat. median
            </div>

            {/* Growth + crowding */}
            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-50">
              <div
                className={`text-[10px] font-semibold ${
                  c.growthRate >= 0 ? "text-green-600" : "text-red-500"
                }`}
              >
                {c.growthRate >= 0 ? "▲" : "▼"}{" "}
                {Math.round(Math.abs(c.growthRate) * 100)}% YoY
              </div>
              <div className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${crowdBg}`}>
                {c.crowdingScore.toFixed(1)} crowd
              </div>
            </div>

            {/* Win rate */}
            <div className="mt-1.5 text-[10px] text-slate-400">
              {Math.round(c.winRate * 100)}% win rate · {c.launchCount} items
            </div>
          </div>
        );
      })}
    </div>
  );
}
