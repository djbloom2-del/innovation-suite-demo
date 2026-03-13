import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  variant?: "default" | "success" | "warning" | "danger" | "neutral";
  size?: "sm" | "md";
}

const variants = {
  default: "bg-blue-50 text-blue-700 border-blue-100",
  success: "bg-green-50 text-green-700 border-green-100",
  warning: "bg-amber-50 text-amber-700 border-amber-100",
  danger: "bg-red-50 text-red-700 border-red-100",
  neutral: "bg-slate-50 text-slate-600 border-slate-100",
};

export function MetricPill({ label, value, variant = "default", size = "md" }: Props) {
  return (
    <span
      className={cn(
        "inline-flex flex-col items-center border rounded px-2 py-1",
        variants[variant],
        size === "sm" ? "px-1.5 py-0.5" : ""
      )}
    >
      <span className={cn("font-semibold leading-tight", size === "sm" ? "text-xs" : "text-sm")}>
        {value}
      </span>
      <span className={cn("leading-tight opacity-70", size === "sm" ? "text-[9px]" : "text-[10px]")}>
        {label}
      </span>
    </span>
  );
}
