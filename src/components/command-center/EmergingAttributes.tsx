import Link from "next/link";
import { ATTRIBUTE_PERFORMANCE } from "@/data/attributes";
import { TrendingUp } from "lucide-react";

export function EmergingAttributes() {
  // Compound signal: winRate × overindexVsAll — rewards attributes that are both
  // winning AND under-penetrated (high overindex = few launches but outsized win rate)
  const rising = ATTRIBUTE_PERFORMANCE.filter((a) => a.trend === "rising")
    .sort((a, b) => b.winRate * b.overindexVsAll - a.winRate * a.overindexVsAll)
    .slice(0, 10);

  const colors = [
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-green-50 text-green-700 border-green-200",
    "bg-purple-50 text-purple-700 border-purple-200",
    "bg-amber-50 text-amber-700 border-amber-200",
    "bg-teal-50 text-teal-700 border-teal-200",
    "bg-rose-50 text-rose-700 border-rose-200",
    "bg-indigo-50 text-indigo-700 border-indigo-200",
    "bg-lime-50 text-lime-700 border-lime-200",
    "bg-cyan-50 text-cyan-700 border-cyan-200",
    "bg-orange-50 text-orange-700 border-orange-200",
  ];

  function getLabel(a: (typeof rising)[0]): { text: string; color: string } {
    const signal = a.winRate * a.overindexVsAll;
    if (signal >= 0.4 && a.penetrationRate < 0.35) {
      return { text: "Rising & Winning", color: "text-green-600" };
    }
    if (a.penetrationRate >= 0.5) {
      return { text: "Saturated", color: "text-amber-500" };
    }
    return { text: "Rising", color: "text-blue-500" };
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-green-500" />
          <h2 className="text-sm font-semibold text-slate-700">Emerging Attributes</h2>
        </div>
        <Link href="/winner-dna" className="text-xs text-blue-600 hover:underline">
          Analyze →
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {rising.map((a, i) => {
          const lbl = getLabel(a);
          return (
            <span
              key={`${a.attributeName}-${a.category}`}
              className={`inline-flex flex-col border rounded-lg px-3 py-1.5 ${colors[i % colors.length]}`}
            >
              <span className="text-xs font-semibold leading-tight">{a.attributeName}</span>
              <span className="text-[9px] opacity-70 leading-tight">
                {a.category} · {Math.round(a.winRate * 100)}% win · {a.overindexVsAll.toFixed(1)}× idx
              </span>
              <span className={`text-[9px] font-semibold leading-tight mt-0.5 ${lbl.color}`}>
                {lbl.text}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
