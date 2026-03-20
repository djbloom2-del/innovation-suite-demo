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
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from "recharts";

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

// ─── Waterfall ────────────────────────────────────────────────────────────────
interface WaterfallPoint {
  name:     string;
  base:     number;   // transparent spacer
  value:    number;   // visible bar
  rawDelta: number;   // signed delta for labels/tooltip
  type:     "baseline" | "positive" | "negative" | "total";
}

function buildWaterfallData(
  baselineWinRate: number,
  singles: AttributeIntelRecord[],
  comboWinRate: number,
): WaterfallPoint[] {
  const pct = (v: number) => Math.round(v * 1000) / 10; // fraction → 0.0–100.0

  const sorted = [...singles].sort(
    (a, b) =>
      Math.abs(b.marginalContribution) - Math.abs(a.marginalContribution) ||
      a.attr.localeCompare(b.attr),
  );

  const data: WaterfallPoint[] = [];
  let running = pct(baselineWinRate);

  // Baseline bar — full height from 0
  data.push({ name: "Baseline", base: 0, value: running, rawDelta: 0, type: "baseline" });

  for (const s of sorted) {
    const delta = pct(s.marginalContribution);
    if (delta >= 0) {
      data.push({ name: s.attr, base: running, value: delta, rawDelta: delta, type: "positive" });
      running += delta;
    } else {
      // Negative bar: spacer up to the new (lower) total; visible bar fills from there upward
      data.push({ name: s.attr, base: running + delta, value: Math.abs(delta), rawDelta: delta, type: "negative" });
      running += delta;
    }
  }

  // Combination total — full height from 0
  data.push({ name: "Combination", base: 0, value: pct(comboWinRate), rawDelta: 0, type: "total" });

  return data;
}

const WATERFALL_FILL: Record<WaterfallPoint["type"], string> = {
  baseline: "#94a3b8",
  positive: "#16a34a",
  negative: "#dc2626",
  total:    "#2563eb",
};

type TableRow = {
  attrs: string[];
  innovationIndex: number;
  winRate: number;
  lift: number;
  launchCount: number;
  newItemDollarShare: number;
  existingItemDollarShare: number;
};

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

  const waterfallData = useMemo((): WaterfallPoint[] => {
    if (pinnedAttrs.length < 2) return [];
    return buildWaterfallData(baselineWinRate, singles, comboWinRate);
  }, [baselineWinRate, singles, comboWinRate]);

  // ── Ranked combination table rows ─────────────────────────────────────────
  const tableRows = useMemo((): TableRow[] => {
    const toRow = (s: { attr: string; innovationIndex: number; winRate: number; lift: number; launchCount: number; newItemDollarShare: number; existingItemDollarShare: number }): TableRow => ({
      attrs:                   [s.attr],
      innovationIndex:         s.innovationIndex,
      winRate:                 s.winRate,
      lift:                    s.lift,
      launchCount:             s.launchCount,
      newItemDollarShare:      s.newItemDollarShare,
      existingItemDollarShare: s.existingItemDollarShare,
    });

    const sortRows = (rows: TableRow[]): TableRow[] =>
      [...rows].sort((a, b) => {
        if (comboSort === "innovationIndex") return b.innovationIndex - a.innovationIndex;
        if (comboSort === "winRate")         return b.winRate - a.winRate;
        if (comboSort === "lift")            return b.lift - a.lift;
        return b.launchCount - a.launchCount;
      });

    if (pinnedAttrs.length === 0) {
      return sortRows(defaultSingles.map(toRow));
    }

    const singleRows = singles.map(toRow);
    const comboRows: TableRow[] = combos.map((c) => ({ ...c }));
    return sortRows([...singleRows, ...comboRows]);
  }, [pinnedAttrs, singles, combos, defaultSingles, comboSort]);

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

      {/* ── Waterfall ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-xs font-semibold text-slate-700 mb-0.5">
          Marginal Contribution Waterfall
        </h3>
        <p className="text-[10px] text-slate-400 mb-4">
          How much each attribute adds or subtracts from the combination win rate.
          Sorted by absolute impact.
        </p>

        {pinnedAttrs.length < 2 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            Pin 2 or more attributes to see the waterfall.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={waterfallData} margin={{ top: 24, right: 16, bottom: 8, left: 8 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, (dataMax: number) => Math.ceil(dataMax / 10) * 10]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 9, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <ReferenceLine
                y={Math.round(baselineWinRate * 100)}
                stroke="#94a3b8"
                strokeDasharray="4 2"
                strokeWidth={1}
              />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0]?.payload as WaterfallPoint;
                  if (!d) return null;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs shadow-md">
                      <div className="font-semibold text-slate-800 mb-1">{d.name}</div>
                      {d.type === "baseline" && (
                        <div className="text-slate-500">Category baseline: {d.value.toFixed(1)}%</div>
                      )}
                      {d.type === "total" && (
                        <div className="text-slate-500">Full combo win rate: {d.value.toFixed(1)}%</div>
                      )}
                      {(d.type === "positive" || d.type === "negative") && (
                        <div className={d.rawDelta >= 0 ? "text-green-600" : "text-red-500"}>
                          Marginal contribution: {d.rawDelta >= 0 ? "+" : ""}{d.rawDelta.toFixed(1)}pp
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              {/* Transparent spacer — must be first in stack */}
              <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
              {/* Visible coloured bar */}
              <Bar dataKey="value" stackId="w" isAnimationActive={false} radius={[3, 3, 0, 0]}>
                {waterfallData.map((entry, i) => (
                  <Cell key={i} fill={WATERFALL_FILL[entry.type]} />
                ))}
                <LabelList
                  dataKey="rawDelta"
                  position="top"
                  fontSize={9}
                  fill="#475569"
                  formatter={(v: any) => {
                    if (typeof v !== "number" || v === 0) return "";
                    return v > 0 ? `+${v.toFixed(1)}pp` : `${v.toFixed(1)}pp`;
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Legend */}
        {pinnedAttrs.length >= 2 && (
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {(["baseline", "positive", "negative", "total"] as const).map((type) => (
              <div key={type} className="flex items-center gap-1 text-[10px] text-slate-500">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: WATERFALL_FILL[type] }} />
                {type === "baseline" ? "Baseline" : type === "positive" ? "Adds lift" : type === "negative" ? "Reduces win rate" : "Full combination"}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* ── Ranked combo table ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div>
            <h3 className="text-xs font-semibold text-slate-700">
              {pinnedAttrs.length === 0
                ? `All Attributes — ${selectedCat}`
                : "Combination Performance Table"}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {pinnedAttrs.length === 0
                ? "Pin attributes above to compare combinations"
                : `Singles + all 2-attr and 3-attr subsets of your ${pinnedAttrs.length} pinned attributes`}
            </p>
          </div>
          <select
            value={comboSort}
            onChange={(e) => setComboSort(e.target.value as typeof comboSort)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 shrink-0"
          >
            <option value="innovationIndex">Sort: Innovation Index</option>
            <option value="winRate">Sort: Win Rate</option>
            <option value="lift">Sort: Lift</option>
            <option value="launchCount">Sort: Launch Count</option>
          </select>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left pb-2 pr-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Attributes
                </th>
                <th className="text-right pb-2 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Innov. Index
                </th>
                <th className="text-right pb-2 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Win Rate
                </th>
                <th className="text-right pb-2 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Lift
                </th>
                <th className="text-right pb-2 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  New Item $%
                </th>
                <th className="text-right pb-2 pl-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Existing $%
                </th>
                <th className="text-right pb-2 pl-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Launches
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                >
                  {/* Attribute badges */}
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {row.attrs.map((a) => (
                        <span
                          key={a}
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-100"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </td>
                  {/* Innovation Index */}
                  <td className="py-2 px-3 text-right">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${idxBg(row.innovationIndex)}`}
                    >
                      {row.innovationIndex}
                    </span>
                  </td>
                  {/* Win Rate */}
                  <td className="py-2 px-3 text-right font-semibold text-slate-700">
                    {Math.round(row.winRate * 100)}%
                  </td>
                  {/* Lift */}
                  <td className={`py-2 px-3 text-right font-semibold ${row.lift >= 1.5 ? "text-green-600" : row.lift >= 1 ? "text-slate-600" : "text-red-500"}`}>
                    {row.lift.toFixed(1)}×
                  </td>
                  {/* New Item $ share */}
                  <td className="py-2 px-3 text-right text-slate-600">
                    {(row.newItemDollarShare * 100).toFixed(1)}%
                  </td>
                  {/* Existing Item $ share */}
                  <td className="py-2 pl-3 text-right text-slate-600">
                    {(row.existingItemDollarShare * 100).toFixed(1)}%
                  </td>
                  {/* Launch count */}
                  <td className="py-2 pl-3 text-right text-slate-500">
                    {row.launchCount}
                  </td>
                </tr>
              ))}
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                    No launches match this combination.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Innovation Index legend */}
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-50">
          {[
            { label: "≥130 — Emerging fast",  cls: "bg-green-50 border-green-200 text-green-700" },
            { label: "100–129 — Innovating",  cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
            { label: "70–99 — Neutral",       cls: "bg-amber-50 border-amber-200 text-amber-700" },
            { label: "<70 — Entrenched",      cls: "bg-red-50 border-red-200 text-red-700" },
          ].map(({ label, cls }) => (
            <div key={label} className={`text-[9px] font-medium px-2 py-0.5 rounded border ${cls}`}>
              {label}
            </div>
          ))}
          <span className="text-[9px] text-slate-400 self-center">Innovation Index: 100 = equal share in new vs. existing items</span>
        </div>
      </div>

    </div>
  );
}
