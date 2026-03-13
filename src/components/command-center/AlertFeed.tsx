import { AlertCircle, TrendingUp, Rocket, Eye } from "lucide-react";

const ALERTS = [
  {
    type: "breakout",
    icon: TrendingUp,
    iconColor: "text-green-500",
    bg: "bg-green-50 border-green-200",
    title: "Breakout Signal: Clarity Energy – Blood Orange",
    desc: "Velocity grew +42% in last 4 weeks. Now P88 vs Beverages cohort.",
    time: "2h ago",
  },
  {
    type: "new_launch",
    icon: Rocket,
    iconColor: "text-blue-500",
    bg: "bg-blue-50 border-blue-200",
    title: "New Launch: SimpleMeal Quinoa & Black Bean Bowl",
    desc: "Launched 7 weeks ago. Early velocity at P55. Watch for distribution ramp.",
    time: "4h ago",
  },
  {
    type: "trend",
    icon: Eye,
    iconColor: "text-purple-500",
    bg: "bg-purple-50 border-purple-200",
    title: "Trend Alert: Adaptogen Beverages Accelerating",
    desc: "3 of 5 adaptogen beverage launches in last 6 months are top-quartile winners.",
    time: "1d ago",
  },
  {
    type: "warn",
    icon: AlertCircle,
    iconColor: "text-amber-500",
    bg: "bg-amber-50 border-amber-200",
    title: "Declining: Harvest Gold Grain Bar – Oat & Honey",
    desc: "Velocity down -31% in 12 weeks. Distribution contracting. Survival risk.",
    time: "2d ago",
  },
];

export function AlertFeed() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">Alerts</h2>
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
      </div>
    </div>
  );
}
