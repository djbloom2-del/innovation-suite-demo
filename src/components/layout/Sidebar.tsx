"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Rocket,
  Dna,
  TrendingUp,
  Activity,
  FlaskConical,
  BookOpen,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", icon: LayoutDashboard, label: "Command Center" },
  { href: "/launches", icon: Rocket, label: "Launch Explorer" },
  { href: "/winner-dna", icon: Dna, label: "Winner DNA" },
  { href: "/brands", icon: TrendingUp, label: "Brand Growth" },
  { href: "/trends", icon: Activity, label: "Trend Evolution" },
  { href: "/whitespace", icon: FlaskConical, label: "Whitespace Lab" },
  { href: "/story-builder", icon: BookOpen, label: "Story Builder" },
];

export function Sidebar() {
  const path = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-[#0f172a] text-slate-300 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-700/50">
        <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white leading-tight">InnoSuite</div>
          <div className="text-[10px] text-slate-400 leading-tight">Innovation Intelligence</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path === href || (href !== "/" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-5 py-2.5 mx-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-blue-500/20 text-white font-medium"
                  : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
              )}
            >
              <Icon size={16} className={active ? "text-blue-400" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-700/50">
        <div className="text-[10px] text-slate-500 leading-relaxed">
          Powered by SPINS Data
          <br />
          Demo v1.0 • Data: Synthetic
        </div>
      </div>
    </aside>
  );
}
