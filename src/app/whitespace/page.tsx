"use client";

import { useMemo } from "react";
import {
  WHITESPACE_OPPORTUNITIES,
  getWhitespaceBubbleData,
} from "@/data/whitespace";
import { getRisingUnderpenetrated } from "@/data/attributes";
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
import { fmt$, fmtPct, categoryColor } from "@/lib/utils";
import { Lightbulb, TrendingUp, Target } from "lucide-react";

const QUADRANT_LABELS = [
  { x: 2.5, y: 28, text: "Open & Growing", color: "#16a34a", desc: "Best Whitespace" },
  { x: 7.5, y: 28, text: "Crowded & Growing", color: "#d97706", desc: "Competitive" },
  { x: 2.5, y: 8, text: "Open & Declining", color: "#6b7280", desc: "Niche" },
  { x: 7.5, y: 8, text: "Crowded & Declining", color: "#dc2626", desc: "Avoid" },
];

function WhitespaceBadge({ score }: { score: number }) {
  const color =
    score >= 85
      ? "bg-green-100 text-green-700"
      : score >= 75
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-700";
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
      {score}
    </span>
  );
}

export default function WhitespaceLab() {
  const bubbleData = useMemo(() => getWhitespaceBubbleData(), []);
  const risingAttrs = useMemo(() => getRisingUnderpenetrated(), []);
  const opportunities = WHITESPACE_OPPORTUNITIES.sort(
    (a, b) => b.whitespaceScore - a.whitespaceScore
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5">
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
                dataKey="crowding"
                name="Crowding"
                type="number"
                domain={[0, 10]}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                label={{ value: "← Less Crowded   More Crowded →", position: "insideBottom", offset: -12, fontSize: 10, fill: "#94a3b8" }}
              />
              <YAxis
                dataKey="growthRate"
                name="Growth Rate"
                type="number"
                domain={[0, 35]}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
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
                  // In Recharts 3.x, ZAxis area is in props.size; derive radius from it
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
          <p className="text-xs text-slate-400 mb-4">
            High win rate, low penetration — underserved demand
          </p>
          <div className="space-y-3">
            {risingAttrs.slice(0, 8).map((attr) => (
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
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${attr.penetrationRate * 100}%` }}
                  />
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">{Math.round(attr.penetrationRate * 100)}% of launches feature this</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Opportunity cards */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={15} className="text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-700">Innovation Opportunity Briefs</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {opportunities.map((opp) => (
            <div
              key={`${opp.category}-${opp.attributeValue}`}
              className="border border-slate-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: categoryColor(opp.category) }}
                    >
                      {opp.category}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-800 mt-1">
                    {opp.attributeValue}
                  </div>
                  <div className="text-[10px] text-slate-400">{opp.attributeName}</div>
                </div>
                <WhitespaceBadge score={opp.whitespaceScore} />
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-3">{opp.description}</p>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-50">
                <div className="text-center">
                  <div className="text-xs font-bold text-green-600">{fmtPct(opp.winRate, 0)}</div>
                  <div className="text-[9px] text-slate-400">Win Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-slate-700">{fmtPct(opp.penetrationRate, 0)}</div>
                  <div className="text-[9px] text-slate-400">Penetration</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-blue-600">{Math.round(opp.growthSignal * 100)}%</div>
                  <div className="text-[9px] text-slate-400">Growth Signal</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
