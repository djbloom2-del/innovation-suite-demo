import Link from "next/link";
import { Rocket, TrendingUp, Award, Sparkles, ArrowUpRight } from "lucide-react";
import { LAUNCHES, getWinners, getRecentLaunches, getBreakoutLaunches } from "@/data/launches";
import { getTopBrandsByGrowth } from "@/data/brands";
import { fmt$ } from "@/lib/utils";

export function KPIStrip() {
  const recent = getRecentLaunches(8);
  const breakouts = getBreakoutLaunches(5);
  const topBrands = getTopBrandsByGrowth(3);
  const emergingCount = getWinners(
    LAUNCHES.filter((l) => !!l.attributes.functionalIngredient && l.ageWeeks <= 26)
  ).length;

  const kpis = [
    {
      icon: Rocket,
      label: "Launches This Period",
      value: recent.length.toString(),
      sub: "Last 8 weeks",
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/launches",
    },
    {
      icon: TrendingUp,
      label: "Breakout Launches",
      value: breakouts.length.toString(),
      sub: `Top grower: ${fmt$(breakouts[0]?.growthRate12w ? breakouts[0].growthRate12w * 100 : 0)}%`,
      color: "text-green-600",
      bg: "bg-green-50",
      href: "/launches",
    },
    {
      icon: Award,
      label: "Top Growing Brands",
      value: topBrands.length.toString(),
      sub: topBrands[0]?.name ?? "—",
      color: "text-purple-600",
      bg: "bg-purple-50",
      href: "/brands",
    },
    {
      icon: Sparkles,
      label: "Emerging Attributes",
      value: emergingCount.toString(),
      sub: "Functional + early-stage",
      color: "text-amber-600",
      bg: "bg-amber-50",
      href: "/winner-dna",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map(({ icon: Icon, label, value, sub, color, bg, href }) => (
        <Link
          key={label}
          href={href}
          className="group block bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 hover:shadow-md hover:ring-1 hover:ring-slate-200 transition-shadow relative"
        >
          <div className={`${bg} ${color} p-2 rounded-lg shrink-0`}>
            <Icon size={18} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 leading-tight">{value}</div>
            <div className="text-xs font-medium text-slate-600 leading-tight">{label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
          </div>
          <ArrowUpRight
            size={12}
            className="absolute top-3 right-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </Link>
      ))}
    </div>
  );
}
