"use client";

import { useState, useMemo } from "react";
import type { Category, AttributeIntelRecord, ComboIntelRecord } from "@/lib/types";
import { CATEGORIES } from "@/data/categories";
import { LAUNCHES, getWinners } from "@/data/launches";
import {
  ATTR_KEYS,
  matchesAttrDynamic,
  computeAttributeIntelligence,
  getTopSinglesByInnovationIndex,
} from "@/data/attributes";
import { fmtPct } from "@/lib/utils";
import { Search, X } from "lucide-react";

// All available attributes (expandable when SPINS data arrives)
const ALL_ATTRS: string[] = [...ATTR_KEYS];

// ─── Innovation Index colour ──────────────────────────────────────────────────
function idxColor(idx: number): string {
  if (idx >= 130) return "text-green-600";
  if (idx >= 100) return "text-emerald-600";
  if (idx >= 70)  return "text-amber-600";
  return "text-red-500";
}

function idxBg(idx: number): string {
  if (idx >= 130) return "bg-green-50 border-green-200 text-green-700";
  if (idx >= 100) return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (idx >= 70)  return "bg-amber-50 border-amber-200 text-amber-700";
  return "bg-red-50 border-red-200 text-red-700";
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AttributeIntelligenceSection() {
  const [selectedCat, setSelectedCat] = useState<Category>("Bars");
  const [searchQuery, setSearchQuery]  = useState("");
  const [pinnedAttrs, setPinnedAttrs]  = useState<string[]>([]);
  const [comboSort, setComboSort]      = useState<
    "innovationIndex" | "winRate" | "lift" | "launchCount"
  >("innovationIndex");

  // ── Base data ──────────────────────────────────────────────────────────────
  const catLaunches = useMemo(
    () => LAUNCHES.filter((l) => l.category === selectedCat),
    [selectedCat],
  );

  const baselineWinRate = useMemo(() => {
    const w = getWinners(catLaunches);
    return catLaunches.length > 0 ? w.length / catLaunches.length : 0;
  }, [catLaunches]);

  // ── Intelligence computation ───────────────────────────────────────────────
  const { singles, combos } = useMemo(
    () => computeAttributeIntelligence(catLaunches, pinnedAttrs),
    [catLaunches, pinnedAttrs],
  );

  const defaultSingles = useMemo(
    () => (pinnedAttrs.length === 0 ? getTopSinglesByInnovationIndex(catLaunches) : []),
    [catLaunches, pinnedAttrs],
  );

  // ── Full-combo KPI metrics ─────────────────────────────────────────────────
  const { comboWinRate, comboLift, comboInnovIdx, comboCount } = useMemo(() => {
    if (pinnedAttrs.length === 0) {
      return { comboWinRate: baselineWinRate, comboLift: 1, comboInnovIdx: 100, comboCount: catLaunches.length };
    }
    const matched = catLaunches.filter((l) =>
      pinnedAttrs.every((a) => matchesAttrDynamic(l, a)),
    );
    const newItems      = catLaunches.filter((l) => l.ageWeeks < 52);
    const existingItems = catLaunches.filter((l) => l.ageWeeks >= 52);
    const totalNew$     = newItems.reduce((s, l) => s + l.dollarsLatest, 0);
    const totalExisting$= existingItems.reduce((s, l) => s + l.dollarsLatest, 0);
    const newWith       = matched.filter((l) => l.ageWeeks < 52);
    const existWith     = matched.filter((l) => l.ageWeeks >= 52);
    const newShare      = totalNew$       > 0 ? newWith.reduce((s, l) => s + l.dollarsLatest, 0) / totalNew$       : 0;
    const existShare    = totalExisting$  > 0 ? existWith.reduce((s, l) => s + l.dollarsLatest, 0) / totalExisting$: 0;
    const wr            = matched.length > 0 ? getWinners(matched).length / matched.length : 0;
    const idx           = existShare === 0 ? (newShare > 0 ? 200 : 100) : Math.round((newShare / existShare) * 100);
    return {
      comboWinRate: wr,
      comboLift:    baselineWinRate > 0 ? wr / baselineWinRate : 1,
      comboInnovIdx: idx,
      comboCount:   matched.length,
    };
  }, [catLaunches, pinnedAttrs, baselineWinRate]);

  // ── Search results ─────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return ALL_ATTRS.filter(
      (a) => !pinnedAttrs.includes(a) && (q === "" || a.toLowerCase().includes(q)),
    );
  }, [searchQuery, pinnedAttrs]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const pinAttr   = (attr: string) => { setPinnedAttrs((p) => [...p, attr]); setSearchQuery(""); };
  const unpinAttr = (attr: string) => setPinnedAttrs((p) => p.filter((a) => a !== attr));

  // ── Pill helpers ───────────────────────────────────────────────────────────
  const catPill = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
      active ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">

      {/* ── Header ── */}
      <div>
        <h2 className="text-sm font-bold text-slate-800 mb-0.5">Attribute Intelligence</h2>
        <p className="text-xs text-slate-400">
          Innovation Index, marginal contribution, and combination performance for any attribute set.
        </p>
      </div>

      {/* ── Category filter ── */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => { setSelectedCat(cat); setPinnedAttrs([]); setSearchQuery(""); }}
            className={catPill(selectedCat === cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Search + pins ── */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search attributes to pin…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700 placeholder-slate-400"
          />
          {/* Dropdown suggestions */}
          {searchQuery && searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {searchResults.map((attr) => (
                <button
                  key={attr}
                  onClick={() => pinAttr(attr)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  {attr}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pinned chips */}
        {pinnedAttrs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pinnedAttrs.map((attr) => (
              <span
                key={attr}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200"
              >
                {attr}
                <button onClick={() => unpinAttr(attr)} className="hover:text-blue-900 transition-colors">
                  <X size={11} />
                </button>
              </span>
            ))}
            <button
              onClick={() => setPinnedAttrs([])}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Quick-pin buttons when nothing is pinned */}
        {pinnedAttrs.length === 0 && !searchQuery && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-slate-400 self-center">Quick pin:</span>
            {ALL_ATTRS.map((attr) => (
              <button
                key={attr}
                onClick={() => pinAttr(attr)}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                + {attr}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
          <div className={`text-xl font-bold ${comboWinRate > baselineWinRate ? "text-green-600" : "text-slate-700"}`}>
            {Math.round(comboWinRate * 100)}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {pinnedAttrs.length > 0 ? "Combo Win Rate" : "Category Win Rate"}
          </div>
          <div className="text-[9px] text-slate-400">
            vs. {Math.round(baselineWinRate * 100)}% baseline
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
          <div className={`text-xl font-bold ${comboInnovIdx >= 100 ? "text-emerald-600" : "text-amber-600"}`}>
            {comboInnovIdx}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Innovation Index</div>
          <div className="text-[9px] text-slate-400">100 = neutral</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
          <div className={`text-xl font-bold ${comboLift >= 1.5 ? "text-green-600" : comboLift >= 1 ? "text-slate-700" : "text-red-500"}`}>
            {comboLift.toFixed(1)}×
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Lift vs. Baseline</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
          <div className="text-xl font-bold text-slate-700">{comboCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Matching Launches</div>
          <div className="text-[9px] text-slate-400">
            {pinnedAttrs.length > 0 ? "with all pinned attrs" : `in ${selectedCat}`}
          </div>
        </div>
      </div>

      {/* ── Waterfall + Table (Task 4 + 5 placeholders) ── */}
      <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-xs text-slate-400">
        Waterfall chart — Task 4
      </div>
      <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-xs text-slate-400">
        Ranked combo table — Task 5
      </div>

    </div>
  );
}
