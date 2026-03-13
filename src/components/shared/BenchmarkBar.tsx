import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number; // 0–100 percentile
  category?: string;
}

export function BenchmarkBar({ label, value, category }: Props) {
  const color =
    value >= 75 ? "bg-green-500" : value >= 50 ? "bg-blue-500" : value >= 25 ? "bg-amber-500" : "bg-red-400";
  const textColor =
    value >= 75 ? "text-green-600" : value >= 50 ? "text-blue-600" : value >= 25 ? "text-amber-600" : "text-red-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={cn("text-xs font-semibold", textColor)}>
          P{Math.round(value)}
          {category && <span className="font-normal text-slate-400"> vs {category}</span>}
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
