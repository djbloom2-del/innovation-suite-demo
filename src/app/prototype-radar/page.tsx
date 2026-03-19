"use client";

import { useState, useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { LAUNCHES, getWinners } from "@/data/launches";
import { ATTR_KEYS, type AttrKey, matchesAttr } from "@/data/attributes";
import type { Launch } from "@/lib/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function matchesAll(l: Launch, attrs: AttrKey[]): boolean {
  return attrs.every((a) => matchesAttr(l, a));
}

function winRateOf(launches: Launch[]): number {
  if (!launches.length) return 0;
  const winners = getWinners(launches);
  return winners.length / launches.length;
}

/** For a given attr, compute its normalised score (0–100) vs the category pool */
function attrScore(
  launches: Launch[],
  attr: AttrKey,
  metric: "winRate" | "velocity" | "innovationIndex"
): number {
  const with_ = launches.filter((l) => matchesAttr(l, attr));
  const without_ = launches.filter((l) => !matchesAttr(l, attr));

  if (metric === "winRate") {
    const base = winRateOf(launches);
    if (!base) return 50;
    return Math.min(100, Math.round((winRateOf(with_) / base) * 50));
  }
  if (metric === "velocity") {
    const allV = launches.map((l) => l.velocityLatest);
    const maxV = Math.max(...allV, 1);
    const avg = with_.length
      ? with_.reduce((s, l) => s + l.velocityLatest, 0) / with_.length
      : 0;
    return Math.round((avg / maxV) * 100);
  }
  if (metric === "innovationIndex") {
    const newItems = launches.filter((l) => l.ageWeeks < 52);
    const existingItems = launches.filter((l) => l.ageWeeks >= 52);
    const totalNew$ = newItems.reduce((s, l) => s + l.dollarsLatest, 0);
    const totalExisting$ = existingItems.reduce((s, l) => s + l.dollarsLatest, 0);
    const new$ = newItems.filter((l) => matchesAttr(l, attr)).reduce((s, l) => s + l.dollarsLatest, 0);
    const existing$ = existingItems.filter((l) => matchesAttr(l, attr)).reduce((s, l) => s + l.dollarsLatest, 0);
    const newShare = totalNew$ > 0 ? new$ / totalNew$ : 0;
    const existingShare = totalExisting$ > 0 ? existing$ / totalExisting$ : 0.001;
    const idx = Math.round((newShare / existingShare) * 100);
    return Math.min(100, Math.round(idx / 3)); // normalise to 0-100 display
  }
  return 50;
}

// ─── component ────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = ["Bars", "Beverages", "Snacks", "Supplements", "Frozen Meals"] as const;

export default function RadarPrototype() {
  const [selectedCat, setSelectedCat] = useState<string>("Bars");
  const [pinnedAttrs, setPinnedAttrs] = useState<AttrKey[]>(["Organic", "Non-GMO", "Protein", "Keto"]);
  const [metric, setMetric] = useState<"winRate" | "velocity" | "innovationIndex">("winRate");

  const { radarData, comboWinRate, catWinRate, comboCount } = useMemo(() => {
    const catLaunches = LAUNCHES.filter((l) => l.category === selectedCat);
    const winners = getWinners(catLaunches);
    const winnerUpcs = new Set(winners.map((w) => w.upc));
    const winnerLaunches = catLaunches.filter((l) => winnerUpcs.has(l.upc));
    const loserLaunches = catLaunches.filter((l) => !winnerUpcs.has(l.upc));
    const comboLaunches = pinnedAttrs.length > 0
      ? catLaunches.filter((l) => matchesAll(l, pinnedAttrs))
      : catLaunches;

    const data = ATTR_KEYS.map((attr) => {
      const winnerScore = attrScore(winnerLaunches, attr, metric);
      const loserScore  = attrScore(loserLaunches, attr, metric);
      const comboScore  = attrScore(comboLaunches, attr, metric);
      const catScore    = attrScore(catLaunches, attr, metric);
      return {
        attr,
        "Winner Profile": winnerScore,
        "Your Combo": comboScore,
        "Category Avg": catScore,
      };
    });

    return {
      radarData: data,
      comboWinRate: Math.round(winRateOf(comboLaunches) * 100),
      catWinRate: Math.round(winRateOf(catLaunches) * 100),
      comboCount: comboLaunches.length,
    };
  }, [selectedCat, pinnedAttrs, metric]);

  const toggleAttr = (attr: AttrKey) =>
    setPinnedAttrs((prev) =>
      prev.includes(attr) ? prev.filter((a) => a !== attr) : [...prev, attr]
    );

  const pillCls = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
      active
        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
    }`;

  const catPillCls = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
      active ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <div className="max-w-5xl mx-auto space-y-5 p-6">

      {/* header */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
        <span className="font-bold">🧪 Prototype</span> — Radar chart design evaluation. Not a permanent page.
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h1 className="text-base font-bold text-slate-800 mb-1">Attribute Combination Radar</h1>
        <p className="text-xs text-slate-400 mb-5">
          Compare your selected attribute combination against the winner profile and category average.
          Each axis = one attribute, score normalised to 0–100.
        </p>

        {/* category selector */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {CATEGORY_OPTIONS.map((cat) => (
            <button key={cat} onClick={() => setSelectedCat(cat)} className={catPillCls(selectedCat === cat)}>
              {cat}
            </button>
          ))}
        </div>

        {/* metric selector */}
        <div className="flex gap-2 mb-5">
          {(["winRate", "velocity", "innovationIndex"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                metric === m
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {m === "winRate" ? "Win Rate" : m === "velocity" ? "Velocity" : "Innovation Index"}
            </button>
          ))}
        </div>

        {/* attribute pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {ATTR_KEYS.map((attr) => (
            <button key={attr} onClick={() => toggleAttr(attr)} className={pillCls(pinnedAttrs.includes(attr))}>
              {attr}
            </button>
          ))}
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
            <div className="text-xl font-bold text-blue-600">{comboWinRate}%</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Combo Win Rate</div>
            <div className="text-[9px] text-slate-400">vs. {catWinRate}% category avg</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
            <div className={`text-xl font-bold ${comboWinRate > catWinRate ? "text-green-600" : "text-red-500"}`}>
              {catWinRate > 0 ? (comboWinRate / catWinRate).toFixed(1) : "—"}×
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Lift vs. Baseline</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
            <div className="text-xl font-bold text-slate-700">{comboCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Matching Launches</div>
            <div className="text-[9px] text-slate-400">with all selected attrs</div>
          </div>
        </div>

        {/* radar chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div>
            <ResponsiveContainer width="100%" height={380}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis
                  dataKey="attr"
                  tick={{ fontSize: 11, fill: "#475569", fontWeight: 500 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  tickCount={5}
                />
                <Radar
                  name="Winner Profile"
                  dataKey="Winner Profile"
                  stroke="#16a34a"
                  fill="#16a34a"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Radar
                  name="Category Avg"
                  dataKey="Category Avg"
                  stroke="#94a3b8"
                  fill="#94a3b8"
                  fillOpacity={0.08}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
                <Radar
                  name="Your Combo"
                  dataKey="Your Combo"
                  stroke="#2563eb"
                  fill="#2563eb"
                  fillOpacity={0.2}
                  strokeWidth={2.5}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", paddingTop: "16px" }}
                />
                <Tooltip
                  formatter={(v: any) => [`${v}/100`, ""]}
                  contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* reading guide */}
          <div className="space-y-4">
            <div className="text-xs font-semibold text-slate-600 mb-2">How to Read This Chart</div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-green-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-700">Winner Profile</div>
                  <div className="text-slate-500">The attribute shape of successful launches in {selectedCat}. Your combo should ideally match or exceed this shape.</div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-700">Your Combo</div>
                  <div className="text-slate-500">The attribute profile of launches carrying <span className="font-medium">{pinnedAttrs.length > 0 ? pinnedAttrs.join(" + ") : "all launches"}</span>. Where blue exceeds green, your combo outperforms winners on that dimension.</div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-700">Category Average</div>
                  <div className="text-slate-500">Baseline across all {selectedCat} launches. Anything above the grey dashed line is already above average.</div>
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
              <div className="text-xs font-semibold text-slate-600">Attribute Scores ({metric === "winRate" ? "Win Rate Index" : metric === "velocity" ? "Velocity Index" : "Innovation Index"})</div>
              {radarData.map((row) => {
                const combo = row["Your Combo"] as number;
                const winner = row["Winner Profile"] as number;
                const gap = combo - winner;
                return (
                  <div key={row.attr} className="flex items-center gap-2">
                    <div className="w-20 text-[10px] text-slate-500 shrink-0">{row.attr}</div>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${combo}%`,
                          backgroundColor: combo >= winner ? "#2563eb" : "#f59e0b",
                        }}
                      />
                    </div>
                    <div className={`text-[10px] font-semibold w-10 text-right shrink-0 ${gap >= 0 ? "text-green-600" : "text-amber-600"}`}>
                      {gap >= 0 ? "+" : ""}{gap}
                    </div>
                  </div>
                );
              })}
              <div className="text-[9px] text-slate-400 pt-1">Gap = Your Combo score minus Winner Profile score</div>
            </div>
          </div>
        </div>

        {/* design notes */}
        <div className="mt-6 border-t border-slate-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-100 rounded-lg p-3">
            <div className="text-xs font-semibold text-green-700 mb-1">✓ Strengths of Radar</div>
            <ul className="text-xs text-green-700 space-y-1 list-disc list-inside">
              <li>Instantly shows "shape match" between combo and winner profile</li>
              <li>Handles 3–8 attributes cleanly</li>
              <li>Three overlapping series are readable at a glance</li>
              <li>Switching metric (win rate → velocity → Innovation Index) is intuitive</li>
            </ul>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <div className="text-xs font-semibold text-amber-700 mb-1">⚠ Trade-offs to consider</div>
            <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
              <li>Doesn't show combined effect of ALL selected attrs together — only individual axis scores</li>
              <li>Area comparisons can be misleading if axes aren't well-scaled</li>
              <li>At 9+ attributes axes start to crowd</li>
              <li>Less precise than a waterfall or ranked table for exact deltas</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
