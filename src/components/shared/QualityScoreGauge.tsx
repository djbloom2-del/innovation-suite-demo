"use client";

import { cn, scoreBg } from "@/lib/utils";

interface Props {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function QualityScoreGauge({ score, size = "md", showLabel = true }: Props) {
  const sizes = {
    sm: { outer: "w-12 h-12", text: "text-sm font-bold", label: "text-[9px]" },
    md: { outer: "w-16 h-16", text: "text-base font-bold", label: "text-[10px]" },
    lg: { outer: "w-20 h-20", text: "text-xl font-bold", label: "text-xs" },
  };
  const sz = sizes[size];

  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const dashOffset = circ * (1 - score / 100);

  const strokeColor =
    score >= 75 ? "#16a34a" : score >= 50 ? "#2563eb" : score >= 25 ? "#d97706" : "#dc2626";

  return (
    <div className={cn("relative flex items-center justify-center", sz.outer)}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className={cn(sz.text)} style={{ color: strokeColor }}>
          {score}
        </span>
        {showLabel && (
          <span className={cn("text-slate-400 leading-tight", sz.label)}>QS</span>
        )}
      </div>
    </div>
  );
}
