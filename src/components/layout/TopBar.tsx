"use client";

import { usePathname } from "next/navigation";
import { Bell, RefreshCw } from "lucide-react";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Command Center", subtitle: "What changed this period?" },
  "/launches": { title: "Launch Explorer", subtitle: "Which launches are winning — and why?" },
  "/winner-dna": { title: "Winner DNA", subtitle: "What characteristics are associated with success?" },
  "/brands": { title: "Brand Growth Engine", subtitle: "How are brands growing?" },
  "/trends": { title: "Trend Evolution", subtitle: "What trends are actually durable?" },
  "/whitespace": { title: "Whitespace Lab", subtitle: "Where should we innovate next?" },
"/story-builder": { title: "Story Builder", subtitle: "How do I explain this clearly?" },
};

export function TopBar() {
  const path = usePathname();
  const info = TITLES[path] ?? { title: "Innovation Suite", subtitle: "" };

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
      <div>
        <h1 className="text-base font-semibold text-slate-800 leading-tight">{info.title}</h1>
        <p className="text-xs text-slate-400 leading-tight">{info.subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded px-2 py-1">
          Data thru Mar 8, 2026 · 4W Release
        </span>
        <button className="text-slate-400 hover:text-slate-600 transition-colors">
          <RefreshCw size={15} />
        </button>
        <button className="text-slate-400 hover:text-slate-600 transition-colors relative">
          <Bell size={15} />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}
