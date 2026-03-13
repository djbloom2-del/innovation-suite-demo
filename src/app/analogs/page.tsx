"use client";

import { useState, useMemo } from "react";
import type { Launch } from "@/lib/types";
import { LAUNCHES } from "@/data/launches";
import { findAnalogs, type AnalogResult } from "@/lib/analogs";
import { fmt$, fmtPct, fmtGrowth, scoreColor, scoreBg, categoryColor } from "@/lib/utils";
import { Search, CheckCircle2, XCircle, Clock, Trophy } from "lucide-react";

function OutcomePill({ launch }: { launch: Launch }) {
  if (launch.survived52w === true)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <Trophy size={9} /> Winner
      </span>
    );
  if (launch.survived26w === false)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
        <XCircle size={9} /> Failed
      </span>
    );
  if (launch.survived26w === true)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
        <CheckCircle2 size={9} /> Surviving
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
      <Clock size={9} /> Early
    </span>
  );
}

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-medium text-slate-600 w-6 text-right">{value}</span>
    </div>
  );
}

function WinningRanges({ analogs }: { analogs: AnalogResult[] }) {
  const winners = analogs.filter((a) => a.launch.survived52w === true || a.launch.survived26w === true);
  const losers = analogs.filter((a) => a.launch.survived26w === false);

  if (winners.length === 0) return null;

  const avgWinnerVelocity = winners.reduce((s, a) => s + a.launch.velocityLatest, 0) / winners.length;
  const avgWinnerTdp = winners.reduce((s, a) => s + a.launch.tdpLatest, 0) / winners.length;
  const avgWinnerPromo = winners.reduce((s, a) => s + a.launch.promoDependency, 0) / winners.length;
  const avgWinnerPrice = winners.reduce((s, a) => s + a.launch.priceLatest, 0) / winners.length;

  const avgLoserVelocity = losers.length > 0 ? losers.reduce((s, a) => s + a.launch.velocityLatest, 0) / losers.length : null;
  const avgLoserTdp = losers.length > 0 ? losers.reduce((s, a) => s + a.launch.tdpLatest, 0) / losers.length : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-1">Winning Range Benchmarks</h2>
      <p className="text-xs text-slate-400 mb-4">
        Based on analog winners vs. losers · use as a target corridor for new concepts
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Price Point", winner: `$${avgWinnerPrice.toFixed(2)}`, loser: null, sub: "winner avg" },
          { label: "Velocity @ 12w", winner: `$${avgWinnerVelocity.toFixed(0)}`, loser: avgLoserVelocity ? `$${avgLoserVelocity.toFixed(0)}` : null, sub: "$/TDP/wk" },
          { label: "Distribution", winner: `${Math.round(avgWinnerTdp)} TDP`, loser: avgLoserTdp ? `${Math.round(avgLoserTdp)} TDP` : null, sub: "at 12w" },
          { label: "Promo Dep.", winner: `<${Math.round(avgWinnerPromo * 100 + 5)}%`, loser: null, sub: "target max" },
        ].map(({ label, winner, loser, sub }) => (
          <div key={label} className="border border-slate-100 rounded-lg p-3">
            <div className="text-[10px] text-slate-400 mb-1">{label}</div>
            <div className="text-sm font-bold text-green-600">{winner}</div>
            {loser && <div className="text-xs text-red-500 mt-0.5">Losers: {loser}</div>}
            <div className="text-[9px] text-slate-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalogFinder() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUpc, setSelectedUpc] = useState<string | null>(null);

  const filteredLaunches = useMemo(() => {
    if (!searchQuery.trim()) return LAUNCHES.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return LAUNCHES.filter(
      (l) =>
        l.description.toLowerCase().includes(q) ||
        l.brand.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [searchQuery]);

  const selectedLaunch = useMemo(
    () => LAUNCHES.find((l) => l.upc === selectedUpc) ?? null,
    [selectedUpc]
  );

  const analogs = useMemo(
    () => (selectedLaunch ? findAnalogs(selectedLaunch, LAUNCHES, 5) : []),
    [selectedLaunch]
  );

  const winners = analogs.filter((a) => a.launch.survived52w || a.launch.survived26w);
  const losers = analogs.filter((a) => a.launch.survived26w === false);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Search panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Find a Launch Concept</h2>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name, brand, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
          {filteredLaunches.map((l) => (
            <button
              key={l.upc}
              onClick={() => setSelectedUpc(l.upc)}
              className={`text-left p-3 rounded-lg border text-xs transition-all ${
                selectedUpc === l.upc
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-100 hover:border-slate-300"
              }`}
            >
              <div className="font-semibold text-slate-700 truncate">{l.description}</div>
              <div className="text-slate-400 mt-0.5">{l.brand} · {l.category}</div>
              <div className="mt-1">
                <OutcomePill launch={l} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedLaunch && (
        <>
          {/* Selected launch summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-4">
            <div className="flex-1">
              <div className="text-xs text-blue-600 font-medium mb-0.5">Selected Concept</div>
              <div className="text-sm font-bold text-slate-800">{selectedLaunch.description}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {selectedLaunch.brand} · {selectedLaunch.category} ·{" "}
                {selectedLaunch.launchQualityScore} quality score
              </div>
            </div>
            <div className="flex gap-3 text-center shrink-0">
              <div>
                <div className="text-xs font-bold text-slate-800">{fmt$(selectedLaunch.velocityLatest)}</div>
                <div className="text-[10px] text-slate-400">Velocity</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">{selectedLaunch.tdpLatest}</div>
                <div className="text-[10px] text-slate-400">TDP</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">${selectedLaunch.priceLatest.toFixed(2)}</div>
                <div className="text-[10px] text-slate-400">Price</div>
              </div>
            </div>
          </div>

          {/* Analog match cards */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Top 5 Historical Analogs</h2>
            <p className="text-xs text-slate-400 mb-4">
              Most similar past launches by category, attributes, price tier, and performance profile
            </p>
            <div className="space-y-3">
              {analogs.map((analog, idx) => (
                <div
                  key={analog.launch.upc}
                  className="border border-slate-100 rounded-lg p-4 hover:border-slate-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="text-lg font-bold text-slate-200 w-5 text-center shrink-0">{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-700 truncate">{analog.launch.description}</span>
                          <OutcomePill launch={analog.launch} />
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {analog.launch.brand} · {analog.launch.category} · Launched {analog.launch.launchCohortMonth.slice(0, 7)}
                        </div>
                        {analog.sharedAttributes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {analog.sharedAttributes.map((attr) => (
                              <span key={attr} className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                                {attr}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-lg font-bold ${scoreColor(analog.similarityScore)}`}>
                        {analog.similarityScore}%
                      </div>
                      <div className="text-[10px] text-slate-400">match</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-50 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400">Quality Score</div>
                      <div className={`font-bold ${scoreColor(analog.launch.launchQualityScore)}`}>
                        {analog.launch.launchQualityScore}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Velocity</div>
                      <div className="font-medium text-slate-700">{fmt$(analog.launch.velocityLatest)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">TDP @ 12w</div>
                      <div className="font-medium text-slate-700">{analog.launch.tdpLatest}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Price</div>
                      <div className="font-medium text-slate-700">${analog.launch.priceLatest.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Winner vs Loser comparison */}
          {winners.length > 0 && losers.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-1">What Differentiated the Winners?</h2>
              <p className="text-xs text-slate-400 mb-4">
                Comparing {winners.length} winner(s) vs {losers.length} failure(s) among your analogs
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {["Metric", "Winners (avg)", "Failures (avg)", "Delta"].map((h) => (
                        <th key={h} className="text-left pb-2 text-slate-400 font-medium pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        metric: "Velocity ($/TDP/wk)",
                        win: winners.reduce((s, a) => s + a.launch.velocityLatest, 0) / winners.length,
                        lose: losers.reduce((s, a) => s + a.launch.velocityLatest, 0) / losers.length,
                        fmt: (v: number) => fmt$(v),
                        higherIsBetter: true,
                      },
                      {
                        metric: "Distribution (TDP)",
                        win: winners.reduce((s, a) => s + a.launch.tdpLatest, 0) / winners.length,
                        lose: losers.reduce((s, a) => s + a.launch.tdpLatest, 0) / losers.length,
                        fmt: (v: number) => Math.round(v).toLocaleString(),
                        higherIsBetter: true,
                      },
                      {
                        metric: "Promo Dependency",
                        win: winners.reduce((s, a) => s + a.launch.promoDependency, 0) / winners.length,
                        lose: losers.reduce((s, a) => s + a.launch.promoDependency, 0) / losers.length,
                        fmt: (v: number) => fmtPct(v, 0),
                        higherIsBetter: false,
                      },
                      {
                        metric: "Quality Score",
                        win: winners.reduce((s, a) => s + a.launch.launchQualityScore, 0) / winners.length,
                        lose: losers.reduce((s, a) => s + a.launch.launchQualityScore, 0) / losers.length,
                        fmt: (v: number) => Math.round(v).toString(),
                        higherIsBetter: true,
                      },
                    ].map(({ metric, win, lose, fmt, higherIsBetter }) => {
                      const delta = win - lose;
                      const pct = Math.round((delta / lose) * 100);
                      const positive = higherIsBetter ? delta > 0 : delta < 0;
                      return (
                        <tr key={metric} className="border-b border-slate-50">
                          <td className="py-2 font-medium text-slate-700 pr-4">{metric}</td>
                          <td className="py-2 pr-4 text-green-600 font-medium">{fmt(win)}</td>
                          <td className="py-2 pr-4 text-red-500 font-medium">{fmt(lose)}</td>
                          <td className={`py-2 font-bold ${positive ? "text-green-600" : "text-red-500"}`}>
                            {positive ? "+" : ""}{pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <WinningRanges analogs={analogs} />
        </>
      )}

      {!selectedLaunch && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <Search size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a launch concept above to find historical analogs</p>
          <p className="text-xs mt-1">The system will surface the 5 most similar past launches and their outcomes</p>
        </div>
      )}
    </div>
  );
}
