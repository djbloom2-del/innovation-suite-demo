"use client";

import { useMemo, useState } from "react";
import {
  WHITESPACE_OPPORTUNITIES,
  getWhitespaceBubbleData,
} from "@/data/whitespace";
import { getRisingUnderpenetrated, ATTRIBUTE_PERFORMANCE } from "@/data/attributes";
import { CATEGORY_BENCHMARKS, CATEGORIES } from "@/data/categories";
import { LAUNCHES, getWinners } from "@/data/launches";
import type { WhitespaceOpportunity, AttributePerf, Category, Launch } from "@/lib/types";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { fmt$, fmtPct, categoryColor, scoreBg } from "@/lib/utils";
import { Lightbulb, TrendingUp, Target, Layers } from "lucide-react";

// ─── Module-scope constants ───────────────────────────────────────────────────

const COMBO_ATTR_KEYS = ["Organic", "Non-GMO", "Gluten-Free", "Vegan", "Keto", "Protein"] as const;
type AttrKey = typeof COMBO_ATTR_KEYS[number];

const QUADRANT_LABELS = [
  { x: 2.5, y: 28, text: "Open & Growing",     color: "#16a34a", desc: "Best Whitespace" },
  { x: 7.5, y: 28, text: "Crowded & Growing",  color: "#d97706", desc: "Competitive" },
  { x: 2.5, y: 8,  text: "Open & Declining",   color: "#6b7280", desc: "Niche" },
  { x: 7.5, y: 8,  text: "Crowded & Declining",color: "#dc2626", desc: "Avoid" },
];

// ─── Module-scope helpers ─────────────────────────────────────────────────────

function computePrize(opp: WhitespaceOpportunity): number {
  const b = CATEGORY_BENCHMARKS.find((bm) => bm.category === opp.category)!;
  const additionalLaunches = Math.max(1, Math.round(b.launchCountLast12m * (0.5 - opp.penetrationRate)));
  return additionalLaunches * opp.winRate * b.medianVelocity26w * b.medianTdp12w * 26;
}

function computeAttrPrize(category: string, winRate: number, penetrationRate: number): number {
  const b = CATEGORY_BENCHMARKS.find((bm) => bm.category === category)!;
  const add = Math.max(1, Math.round(b.launchCountLast12m * (0.5 - penetrationRate)));
  return add * winRate * b.medianVelocity26w * b.medianTdp12w * 26;
}

function opportunityScore(winRate: number, penetrationRate: number, overindex: number, trend: string): number {
  const t = trend === "rising" ? 1.2 : trend === "declining" ? 0.8 : 1.0;
  return Math.round(winRate * (1 - penetrationRate) * overindex * t * 100);
}

function launchMatchesAttr(l: Launch, attrName: string, attrValue: string): boolean {
  const a = l.attributes;
  if (attrName === "Organic")               return a.isOrganic;
  if (attrName === "Non-GMO")               return a.isNonGmo;
  if (attrName === "Gluten-Free")           return a.isGlutenFree;
  if (attrName === "Vegan")                 return a.isVegan;
  if (attrName === "Keto")                  return a.isKeto;
  if (attrName === "Protein")               return a.isProteinFocused;
  if (attrName === "Form")                  return a.form === attrValue;
  if (attrName === "Functional Ingredient") return a.functionalIngredient === attrValue;
  if (attrName === "Health Focus")          return a.healthFocus === attrValue;
  return false;
}

function genBriefDescription(attr: AttributePerf): string {
  const wr  = Math.round(attr.winRate * 100);
  const pen = Math.round(attr.penetrationRate * 100);
  const oi  = attr.overindexVsAll;
  const phrases: Record<string, string> = {
    Organic:      "Organic",
    "Non-GMO":    "Non-GMO",
    "Gluten-Free":"Gluten-Free",
    Vegan:        "Vegan",
    Keto:         "Keto-friendly",
    Protein:      "Protein-focused",
  };
  const phrase = phrases[attr.attributeName] ?? attr.attributeName;

  // Case 1 — Underperforms baseline: attribute correlates with lower win rate than category average
  if (oi < 1.0) {
    const gap = Math.round((1 - oi) * 100);
    const trendNote = attr.trend === "declining" ? " Declining adoption adds to the headwinds." : "";
    return `${phrase} ${attr.category} launches trail the category win rate by ${gap}% on average. Present in ${pen}% of launches but not driving a meaningful win-rate advantage.${trendNote}`;
  }

  // Case 2 — Saturated: already in nearly half of launches, limited whitespace remaining
  if (attr.penetrationRate >= 0.45) {
    const trendNote =
      attr.trend === "declining" ? " Adoption is also decelerating, suggesting the trend may have peaked." :
      attr.trend === "rising"    ? " New launches continue to pick it up, reinforcing it as table stakes." :
      "";
    return `${phrase} is already present in ${pen}% of ${attr.category} launches — approaching table stakes. Win rate advantage (${wr}%) remains but high penetration limits remaining whitespace.${trendNote}`;
  }

  // Case 3 — Declining trend: direction is negative even if penetration is moderate
  if (attr.trend === "declining") {
    return `${phrase} ${attr.category} launches show a ${wr}% win rate (${oi.toFixed(1)}× baseline) but adoption is decelerating. At ${pen}% penetration the window may be closing — act early or look elsewhere.`;
  }

  // Case 4 — Standard positive opportunity
  const trendNote = attr.trend === "rising" ? " Adoption is accelerating." : "";
  return `${phrase} ${attr.category} launches win at ${wr}% but only ${pen}% of launches carry this claim — ${oi.toFixed(1)}× the category baseline.${trendNote}`;
}

function matchesComboAttr(l: Launch, attr: AttrKey): boolean {
  const a = l.attributes;
  if (attr === "Organic")      return a.isOrganic;
  if (attr === "Non-GMO")      return a.isNonGmo;
  if (attr === "Gluten-Free")  return a.isGlutenFree;
  if (attr === "Vegan")        return a.isVegan;
  if (attr === "Keto")         return a.isKeto;
  if (attr === "Protein")      return a.isProteinFocused;
  return false;
}

function trendChipClass(trend: string): string {
  if (trend === "rising")    return "bg-green-100 text-green-700";
  if (trend === "declining") return "bg-red-100 text-red-700";
  return "bg-blue-100 text-blue-700";
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function WhitespaceBadge({ score }: { score: number }) {
  const color =
    score >= 85 ? "bg-green-100 text-green-700" :
    score >= 75 ? "bg-blue-100 text-blue-700"   :
                  "bg-amber-100 text-amber-700";
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}</span>
  );
}

// ─── Page Component ────────────────────────────────────────────────────────────

export default function WhitespaceLab() {

  // ── Section 1 + 2 data ──────────────────────────────────────────────────
  const bubbleData   = useMemo(() => getWhitespaceBubbleData(), []);
  const risingAttrs  = useMemo(() => getRisingUnderpenetrated(), []);
  const opportunities = [...WHITESPACE_OPPORTUNITIES].sort((a, b) => b.whitespaceScore - a.whitespaceScore);

  // ── State ────────────────────────────────────────────────────────────────
  const [briefCat,    setBriefCat]    = useState<string>("All");
  const [briefTrend,  setBriefTrend]  = useState<string>("All");
  const [sortBriefs,  setSortBriefs]  = useState<"opportunity" | "winRate" | "prize">("opportunity");
  const [comboAttrs,  setComboAttrs]  = useState<AttrKey[]>([]);
  const [comboCat,    setComboCat]    = useState<Category>("Bars");

  // ── useMemo: briefCards ──────────────────────────────────────────────────
  const briefCards = useMemo(() => {
    // 1. Featured: 5 hardcoded opportunities (non-boolean attributes)
    const featured = opportunities.map((o) => {
      const b    = CATEGORY_BENCHMARKS.find((bm) => bm.category === o.category)!;
      const trend: "rising" | "stable" | "declining" =
        o.growthSignal > 0.7 ? "rising" : o.growthSignal < 0.4 ? "declining" : "stable";
      const overindex = b.winRate > 0 ? o.winRate / b.winRate : 1;
      const examples  = LAUNCHES
        .filter((l) => l.category === o.category && launchMatchesAttr(l, o.attributeName, o.attributeValue))
        .sort((a, b) => b.launchQualityScore - a.launchQualityScore)
        .slice(0, 2);
      return {
        id:              `${o.category}:${o.attributeName}:${o.attributeValue}`,
        category:        o.category as string,
        label:           o.attributeName,
        name:            o.attributeValue,
        description:     o.description,
        winRate:         o.winRate,
        penetrationRate: o.penetrationRate,
        overindex,
        trend,
        score:           o.whitespaceScore,
        prize:           computePrize(o),
        isFeatured:      true,
        examples,
      };
    });

    // 2. Dynamic: from ATTRIBUTE_PERFORMANCE (boolean claims per category)
    const dynamic = ATTRIBUTE_PERFORMANCE.map((attr) => {
      const examples = LAUNCHES
        .filter((l) => l.category === attr.category && launchMatchesAttr(l, attr.attributeName, attr.attributeValue))
        .sort((a, b) => b.launchQualityScore - a.launchQualityScore)
        .slice(0, 2);
      return {
        id:              `${attr.category}:${attr.attributeName}:${attr.attributeValue}`,
        category:        attr.category as string,
        label:           attr.attributeName,
        name:            attr.attributeName,         // display attr name as title for boolean claims
        description:     genBriefDescription(attr),
        winRate:         attr.winRate,
        penetrationRate: attr.penetrationRate,
        overindex:       attr.overindexVsAll,
        trend:           attr.trend as string,
        score:           opportunityScore(attr.winRate, attr.penetrationRate, attr.overindexVsAll, attr.trend),
        prize:           computeAttrPrize(attr.category, attr.winRate, attr.penetrationRate),
        isFeatured:      false,
        examples,
      };
    });

    let combined = [...featured, ...dynamic];
    if (briefCat   !== "All") combined = combined.filter((c) => c.category === briefCat);
    if (briefTrend !== "All") combined = combined.filter((c) => c.trend === briefTrend.toLowerCase());

    combined.sort((a, b) => {
      if (sortBriefs === "opportunity") {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return b.score - a.score;
      }
      if (sortBriefs === "winRate") return b.winRate - a.winRate;
      if (sortBriefs === "prize")   return b.prize - a.prize;
      return 0;
    });
    return combined;
  }, [briefCat, briefTrend, sortBriefs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── useMemo: comboData ───────────────────────────────────────────────────
  const comboData = useMemo(() => {
    const catLaunches = LAUNCHES.filter((l) => l.category === comboCat);
    const catWinners  = getWinners(catLaunches);
    const catWinRate  = catLaunches.length ? catWinners.length / catLaunches.length : 0;

    const matched = comboAttrs.length === 0
      ? catLaunches
      : catLaunches.filter((l) => comboAttrs.every((a) => matchesComboAttr(l, a)));

    const matchedWinners   = getWinners(matched);
    const comboWinRate     = matched.length ? matchedWinners.length / matched.length : 0;
    const comboPenetration = catLaunches.length ? matched.length / catLaunches.length : 0;
    const lift             = catWinRate > 0 ? comboWinRate / catWinRate : 1;

    const b         = CATEGORY_BENCHMARKS.find((bm) => bm.category === comboCat)!;
    const addLaunch = Math.max(0, Math.round(b.launchCountLast12m * (0.5 - comboPenetration)));
    const comboPrize = addLaunch * comboWinRate * b.medianVelocity26w * b.medianTdp12w * 26;

    const topMatched = [...matched]
      .sort((a, b) => b.launchQualityScore - a.launchQualityScore)
      .slice(0, 5);

    return { catLaunches, catWinRate, comboWinRate, comboPenetration, lift, comboPrize, topMatched };
  }, [comboAttrs, comboCat]);

  // ── Pill helper ──────────────────────────────────────────────────────────
  const pillCls = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
      active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Section 1: Category Whitespace Map + Attribute Gap Signals ───── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Bubble chart */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Category Whitespace Map</h2>
          <p className="text-xs text-slate-400 mb-4">
            Crowding vs. growth rate. Bubble size = category total $. Find the open growing quadrant.
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 20, right: 24, bottom: 24, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="crowding" name="Crowding" type="number" domain={[0, 10]}
                tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                label={{ value: "← Less Crowded   More Crowded →", position: "insideBottom", offset: -12, fontSize: 10, fill: "#94a3b8" }}
              />
              <YAxis
                dataKey="growthRate" name="Growth Rate" type="number" domain={[0, 35]}
                tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false}
                label={{ value: "Growth Rate", angle: -90, position: "insideLeft", offset: 12, fontSize: 10, fill: "#94a3b8" }}
              />
              <ZAxis dataKey="totalDollars" range={[600, 3000]} />
              <ReferenceLine x={5} stroke="#e2e8f0" strokeDasharray="4 2" />
              <ReferenceLine y={15} stroke="#e2e8f0" strokeDasharray="4 2" />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs shadow-md">
                      <div className="font-semibold text-slate-800 mb-1">{d.category}</div>
                      <div className="text-slate-500">Crowding: {d.crowding.toFixed(1)}</div>
                      <div className="text-slate-500">Growth: {d.growthRate.toFixed(0)}%</div>
                      <div className="text-slate-500">Size: {fmt$(d.totalDollars)}</div>
                      <div className="text-slate-500">Avg Quality: {d.avgQualityScore}</div>
                    </div>
                  );
                }}
              />
              <Scatter
                data={bubbleData}
                shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  const r = Math.sqrt((props.size ?? 600) / Math.PI);
                  const color = categoryColor(payload.category);
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.7} stroke={color} strokeWidth={1.5} />
                      <text x={cx} y={cy + r + 12} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={500}>
                        {payload.category}
                      </text>
                    </g>
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {QUADRANT_LABELS.map((q) => (
              <div key={q.text} className="flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: q.color }} />
                <span className="font-medium" style={{ color: q.color }}>{q.text}</span>
                <span className="text-slate-400">— {q.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rising underpenetrated attributes */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Attribute Gap Signals</h2>
          <p className="text-xs text-slate-400 mb-4">High win rate, low penetration — underserved demand</p>
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {risingAttrs.map((attr) => (
              <div key={`${attr.category}-${attr.attributeName}`} className="border border-slate-100 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">{attr.attributeName}: {attr.attributeValue}</div>
                    <div className="text-[10px] text-slate-400">{attr.category}</div>
                  </div>
                  <TrendingUp size={13} className="text-green-500 shrink-0 mt-0.5" />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <div className="text-[10px] text-slate-400">Win Rate</div>
                    <div className="text-sm font-bold text-green-600">{fmtPct(attr.winRate, 0)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Penetration</div>
                    <div className="text-sm font-bold text-slate-700">{fmtPct(attr.penetrationRate, 0)}</div>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${attr.penetrationRate * 100}%` }} />
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">{Math.round(attr.penetrationRate * 100)}% of launches feature this</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 2: Opportunity Brief Gallery ──────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Lightbulb size={15} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-700">Innovation Opportunity Briefs</h2>
            </div>
            <p className="text-xs text-slate-400">
              {briefCards.length} opportunit{briefCards.length === 1 ? "y" : "ies"} — filter and sort to find your own insights
            </p>
          </div>
          <select
            value={sortBriefs}
            onChange={(e) => setSortBriefs(e.target.value as "opportunity" | "winRate" | "prize")}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="opportunity">Sort: Opportunity Score</option>
            <option value="winRate">Sort: Win Rate</option>
            <option value="prize">Sort: Est. Prize</option>
          </select>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex flex-wrap gap-1">
            {["All", ...CATEGORIES].map((cat) => (
              <button key={cat} onClick={() => setBriefCat(cat)} className={pillCls(briefCat === cat)}>{cat}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {["All", "Rising", "Stable", "Declining"].map((t) => (
              <button key={t} onClick={() => setBriefTrend(t)} className={pillCls(briefTrend === t)}>{t}</button>
            ))}
          </div>
        </div>

        {/* Brief card grid */}
        {briefCards.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No opportunities match the current filters.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {briefCards.map((card) => (
              <div
                key={card.id}
                className="border border-slate-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all flex flex-col"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: categoryColor(card.category) }}
                    >
                      {card.category}
                    </span>
                    {card.isFeatured && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">★ Featured</span>
                    )}
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${trendChipClass(card.trend)}`}>
                      {card.trend.charAt(0).toUpperCase() + card.trend.slice(1)}
                    </span>
                  </div>
                  <WhitespaceBadge score={card.score} />
                </div>

                {/* Name + label */}
                <div className="mb-2">
                  <div className="text-sm font-bold text-slate-800 leading-tight">{card.name}</div>
                  <div className="text-[10px] text-slate-400">{card.label}</div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 leading-relaxed mb-3 flex-1">{card.description}</p>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-1 pt-3 border-t border-slate-50 mb-3">
                  <div className="text-center">
                    <div className="text-xs font-bold text-green-600">{Math.round(card.winRate * 100)}%</div>
                    <div className="text-[9px] text-slate-400">Win Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-slate-700">{Math.round(card.penetrationRate * 100)}%</div>
                    <div className="text-[9px] text-slate-400">Penetration</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-blue-600">{card.overindex.toFixed(1)}×</div>
                    <div className="text-[9px] text-slate-400">Overindex</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-purple-600">{fmt$(card.prize)}</div>
                    <div className="text-[9px] text-slate-400">Est. Prize</div>
                  </div>
                </div>

                {/* Example launches */}
                {card.examples.length > 0 && (
                  <div>
                    <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Example Launches</div>
                    <div className="space-y-1">
                      {card.examples.map((ex) => (
                        <div key={ex.upc} className="flex items-center gap-2 text-[10px]">
                          <span className="text-slate-600 truncate flex-1">{ex.description}</span>
                          <span className={`shrink-0 text-[9px] font-bold px-1 py-0.5 rounded border ${scoreBg(ex.launchQualityScore)}`}>
                            {ex.launchQualityScore}
                          </span>
                          {ex.survived26w && (
                            <span className="shrink-0 text-green-600 font-bold">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 3: Attribute Combo Whitespace Finder ─────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Layers size={15} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700">Attribute Combo Whitespace Finder</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Combine attributes to reveal compound whitespace opportunities — low penetration + high win rate = biggest prize
        </p>

        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setComboCat(cat)} className={pillCls(comboCat === cat)}>{cat}</button>
          ))}
        </div>

        {/* Attribute toggle pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {COMBO_ATTR_KEYS.map((attr) => {
            const active = comboAttrs.includes(attr);
            return (
              <button
                key={attr}
                onClick={() =>
                  setComboAttrs((prev) =>
                    active ? prev.filter((a) => a !== attr) : [...prev, attr]
                  )
                }
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
                  active
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                }`}
              >
                {attr}
              </button>
            );
          })}
          {comboAttrs.length > 0 && (
            <button
              onClick={() => setComboAttrs([])}
              className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-400 hover:text-slate-600 border border-slate-200 hover:border-slate-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {comboAttrs.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            Select 2+ attributes above to explore how combinations create whitespace opportunities.
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {/* Combo Penetration — low = more whitespace */}
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <div className={`text-xl font-bold ${comboData.comboPenetration < 0.2 ? "text-amber-600" : "text-slate-700"}`}>
                  {Math.round(comboData.comboPenetration * 100)}%
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Combo Penetration</div>
                {comboData.comboPenetration < 0.2 && (
                  <div className="text-[9px] text-amber-600 font-medium mt-0.5">↓ Low = more whitespace</div>
                )}
              </div>
              {/* Win Rate */}
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <div className={`text-xl font-bold ${comboData.comboWinRate > comboData.catWinRate ? "text-green-600" : "text-slate-500"}`}>
                  {Math.round(comboData.comboWinRate * 100)}%
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Combo Win Rate</div>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  vs. {Math.round(comboData.catWinRate * 100)}% baseline
                </div>
              </div>
              {/* Lift */}
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <div className={`text-xl font-bold ${
                  comboData.lift >= 2 ? "text-green-600" :
                  comboData.lift >= 1.5 ? "text-amber-600" : "text-slate-500"
                }`}>
                  {comboData.lift.toFixed(1)}×
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Lift vs. Baseline</div>
              </div>
              {/* Est. Prize */}
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <div className="text-xl font-bold text-purple-600">{fmt$(comboData.comboPrize)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Est. Prize</div>
              </div>
            </div>

            {/* Insight narrative */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-2">
                <Target size={14} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  <span className="font-semibold">{comboAttrs.join(" + ")} in {comboCat}:</span>{" "}
                  wins at {Math.round(comboData.comboWinRate * 100)}% but only{" "}
                  {Math.round(comboData.comboPenetration * 100)}% of {comboCat} launches carry this
                  combination — {comboData.lift.toFixed(1)}× the category baseline.{" "}
                  {comboData.comboPrize > 0
                    ? `Est. ${fmt$(comboData.comboPrize)} opportunity if penetration reaches 50%.`
                    : "Already well-penetrated in this category."}
                </p>
              </div>
            </div>

            {/* Matching launches */}
            {comboData.topMatched.length > 0 ? (
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Top Matching Launches ({comboData.topMatched.length} shown)
                </div>
                <div className="space-y-1.5">
                  {comboData.topMatched.map((l) => (
                    <div key={l.upc} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-700 truncate">{l.description}</div>
                        <div className="text-[10px] text-slate-400">{l.brand}</div>
                      </div>
                      <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border ${scoreBg(l.launchQualityScore)}`}>
                        {l.launchQualityScore}
                      </span>
                      {l.dollars26w != null && (
                        <span className="text-[10px] text-slate-500 shrink-0">{fmt$(l.dollars26w)}</span>
                      )}
                      {l.survived26w && (
                        <span className="text-green-600 font-bold text-xs shrink-0">✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                No {comboCat} launches match this combination.
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
