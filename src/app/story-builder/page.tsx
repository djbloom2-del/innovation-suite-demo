"use client";

import { useState, useMemo, useRef } from "react";
import type { Launch } from "@/lib/types";
import { LAUNCHES, getBreakoutLaunches, getWinners } from "@/data/launches";
import { BRANDS } from "@/data/brands";
import { fmt$, fmtPct, fmtGrowth, scoreColor } from "@/lib/utils";
import { CATEGORY_BENCHMARKS } from "@/data/categories";
import { ATTR_KEYS, matchesAttr } from "@/data/attributes";
import { FileText, ShoppingCart, Users, Download, Copy, CheckCircle2 } from "lucide-react";

const STORY_TYPES = [
  {
    id: "innovation-brief",
    label: "Innovation Brief",
    icon: FileText,
    description: "Strategic overview of innovation performance for internal alignment",
  },
  {
    id: "retailer-sell",
    label: "Retailer Sell Story",
    icon: ShoppingCart,
    description: "Data-backed pitch for retail buyers to secure distribution",
  },
  {
    id: "leadership-summary",
    label: "Leadership Summary",
    icon: Users,
    description: "Executive-level innovation scorecard for quarterly reviews",
  },
] as const;

type StoryType = (typeof STORY_TYPES)[number]["id"];

function MetricBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 text-center">
      <div className="text-lg font-bold text-blue-600">{value}</div>
      <div className="text-xs font-medium text-slate-700">{label}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function InnovationBriefPreview({
  launches,
  brandName,
  context,
}: {
  launches: Launch[];
  brandName: string;
  context: string;
}) {
  const winners = launches.filter((l) => l.survived52w || l.survived26w);
  const avgScore = launches.length
    ? Math.round(launches.reduce((s, l) => s + l.launchQualityScore, 0) / launches.length)
    : 0;
  const totalDollars = launches.reduce((s, l) => s + l.dollarsLatest, 0);
  const avgVelocity = launches.length
    ? launches.reduce((s, l) => s + l.velocityLatest, 0) / launches.length
    : 0;

  return (
    <div className="space-y-4 text-slate-700">
      <div className="border-b border-slate-200 pb-3">
        <div className="text-[10px] font-medium text-blue-600 uppercase tracking-wide mb-1">Innovation Brief</div>
        <h1 className="text-lg font-bold text-slate-900">{brandName || "Brand"} Innovation Performance</h1>
        <div className="text-xs text-slate-400 mt-0.5">Period ending March 2026 · {launches.length} launches analyzed</div>
      </div>

      {context && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-slate-700">
          {context}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <MetricBox label="Launches" value={launches.length.toString()} sub="selected" />
        <MetricBox label="Win Rate" value={launches.length ? fmtPct(winners.length / launches.length, 0) : "—"} sub="survived 26w+" />
        <MetricBox label="Avg Quality" value={avgScore.toString()} sub="launch score" />
        <MetricBox label="Total Revenue" value={fmt$(totalDollars)} sub="current period" />
      </div>

      {launches.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-2">Launch Portfolio Summary</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                {["Product", "Category", "Quality", "Velocity", "Outcome"].map((h) => (
                  <th key={h} className="text-left pb-1.5 text-slate-400 font-medium pr-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {launches.map((l) => (
                <tr key={l.upc} className="border-b border-slate-50">
                  <td className="py-1.5 font-medium text-slate-700 pr-3 max-w-[140px] truncate">{l.description}</td>
                  <td className="py-1.5 text-slate-400 pr-3">{l.category}</td>
                  <td className={`py-1.5 font-bold pr-3 ${scoreColor(l.launchQualityScore)}`}>{l.launchQualityScore}</td>
                  <td className="py-1.5 text-slate-600 pr-3">{fmt$(l.velocityLatest)}</td>
                  <td className="py-1.5">
                    {l.survived52w ? (
                      <span className="text-green-600 font-medium">Winner</span>
                    ) : l.survived26w === false ? (
                      <span className="text-red-500">Failed</span>
                    ) : l.survived26w ? (
                      <span className="text-blue-600">Active</span>
                    ) : (
                      <span className="text-slate-400">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Attribute composition */}
      {launches.length > 0 && (() => {
        const attrComposition = ATTR_KEYS
          .map((a) => ({
            attr: a,
            pct: launches.filter((l) => matchesAttr(l, a)).length / launches.length,
          }))
          .filter((x) => x.pct > 0)
          .sort((a, b) => b.pct - a.pct);
        const topClaims = attrComposition.slice(0, 3).map((x) => `${x.attr} (${Math.round(x.pct * 100)}%)`);
        return attrComposition.length > 0 ? (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-slate-600">
            <strong className="text-slate-700">Attribute Profile:</strong>{" "}
            {topClaims.join(", ")} {attrComposition.length > 3 ? `+${attrComposition.length - 3} more` : ""} — core claims in the selected portfolio
          </div>
        ) : null;
      })()}

      <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
        <strong className="text-slate-600">Key Insight:</strong>{" "}
        {launches.length === 0 ? "Select launches to generate a data-driven insight." :
          avgScore >= 60
          ? `${brandName || "This brand"}'s launch portfolio shows above-average quality (${avgScore}/100), with strong velocity signals suggesting sustainable growth.`
          : `${brandName || "This brand"} has room to improve launch quality (${avgScore}/100). Focus on distribution building and reducing promo dependency in the first 12 weeks.`}
      </div>
    </div>
  );
}

function RetailerSellPreview({
  launches,
  brandName,
  context,
}: {
  launches: Launch[];
  brandName: string;
  context: string;
}) {
  const sorted = [...launches].sort((a, b) => b.launchQualityScore - a.launchQualityScore);
  const topLaunch = sorted[0];
  const avgVelocity = launches.length ? launches.reduce((s, l) => s + l.velocityLatest, 0) / launches.length : 0;
  const avgTdp = launches.length ? launches.reduce((s, l) => s + l.tdpLatest, 0) / launches.length : 0;
  const survivalRate = launches.length
    ? launches.filter((l) => l.survived26w !== false).length / launches.length
    : 0;

  // Dynamic retailer bullets from data
  const cats = [...new Set(launches.map((l) => l.category))];
  const benchmarks = CATEGORY_BENCHMARKS.filter((b) => cats.includes(b.category));
  const blendedVel = benchmarks.length > 0
    ? benchmarks.reduce((s, b) => s + b.medianVelocity12w, 0) / benchmarks.length
    : null;
  const blendedSurv = benchmarks.length > 0
    ? benchmarks.reduce((s, b) => s + b.survivalRate26w, 0) / benchmarks.length
    : null;
  const avgPromo = launches.length ? launches.reduce((s, l) => s + l.promoDependency, 0) / launches.length : 0;

  // Dynamic attribute bullets
  const topAttrs = ATTR_KEYS.filter((a) => {
    const pct = launches.length ? launches.filter((l) => matchesAttr(l, a)).length / launches.length : 0;
    return pct >= 0.5; // attribute in ≥50% of selected launches
  });

  const bullets: string[] = [];
  if (blendedVel && avgVelocity > 0) {
    const idx = avgVelocity / blendedVel;
    bullets.push(
      `Avg velocity ${fmt$(avgVelocity)}/store/wk — ${idx.toFixed(1)}× category median (${fmt$(blendedVel)})`
    );
  }
  if (avgPromo < 0.25) {
    bullets.push(
      `Low promo dependency (${Math.round(avgPromo * 100)}%) — demand driven by full-price repeat purchase`
    );
  } else {
    bullets.push(`Distribution-first launch strategy — sustainable velocity not dependent on promotions`);
  }
  if (blendedSurv && survivalRate > 0) {
    const idx = (survivalRate / blendedSurv).toFixed(1);
    bullets.push(
      `${Math.round(survivalRate * 100)}% 26-week survival rate — ${idx}× vs. category average of ${Math.round(blendedSurv * 100)}%`
    );
  } else if (survivalRate > 0) {
    bullets.push(`${Math.round(survivalRate * 100)}% of launches survived past 26 weeks`);
  }
  if (topAttrs.length > 0) {
    bullets.push(
      `Consistently delivers against consumer demand: ${topAttrs.join(", ")} across ≥50% of the range`
    );
  }
  if (bullets.length === 0) {
    bullets.push("Select launches to generate data-driven sell bullets");
  }

  return (
    <div className="space-y-4 text-slate-700">
      <div className="border-b border-slate-200 pb-3">
        <div className="text-[10px] font-medium text-green-600 uppercase tracking-wide mb-1">Retailer Sell Story</div>
        <h1 className="text-lg font-bold text-slate-900">Why {brandName || "Our Brand"} Wins on Shelf</h1>
        <div className="text-xs text-slate-400 mt-0.5">
          Innovation performance · powered by SPINS POS + Attribute data
        </div>
      </div>

      {context && (
        <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-xs text-slate-700">{context}</div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <MetricBox label="Avg Velocity" value={fmt$(avgVelocity)} sub="$/TDP/wk" />
        <MetricBox label="Avg Distribution" value={`${Math.round(avgTdp)}`} sub="TDP at 12w" />
        <MetricBox
          label="Survival Rate"
          value={launches.length ? fmtPct(survivalRate, 0) : "—"}
          sub="26-week"
        />
      </div>

      {topLaunch && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <div className="text-[10px] font-medium text-blue-600 mb-1">HERO SKU</div>
          <div className="text-sm font-bold text-slate-800">{topLaunch.description}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {topLaunch.category} · Quality Score: {topLaunch.launchQualityScore}/100
            {blendedVel && (
              <span className="ml-2 text-blue-600 font-medium">
                · {(topLaunch.velocityLatest / blendedVel).toFixed(1)}× cat. median velocity
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div>
              <div className="text-[10px] text-slate-400">Velocity</div>
              <div className="text-xs font-bold text-slate-700">{fmt$(topLaunch.velocityLatest)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Distribution</div>
              <div className="text-xs font-bold text-slate-700">{topLaunch.tdpLatest} TDP</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Price</div>
              <div className="text-xs font-bold text-slate-700">${topLaunch.priceLatest.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-600">
          Why This Range Belongs on Your Shelf
          <span className="ml-2 text-[10px] font-normal text-slate-400">← derived from SPINS data</span>
        </div>
        {bullets.map((point, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
            <CheckCircle2 size={12} className="text-green-500 shrink-0 mt-0.5" />
            <span>{point}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadershipSummaryPreview({
  launches,
  brandName,
  context,
}: {
  launches: Launch[];
  brandName: string;
  context: string;
}) {
  const winners = launches.filter((l) => l.survived52w || l.survived26w).length;
  const avgScore = launches.length ? Math.round(launches.reduce((s, l) => s + l.launchQualityScore, 0) / launches.length) : 0;
  const totalRevenue = launches.reduce((s, l) => s + l.dollarsLatest, 0);

  return (
    <div className="space-y-4 text-slate-700">
      <div className="border-b border-slate-200 pb-3">
        <div className="text-[10px] font-medium text-purple-600 uppercase tracking-wide mb-1">Q1 2026 Executive Summary</div>
        <h1 className="text-lg font-bold text-slate-900">Innovation Scorecard: {brandName || "Portfolio"}</h1>
        <div className="text-xs text-slate-400 mt-0.5">Period ending March 2026</div>
      </div>

      {context && (
        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-xs text-slate-700">{context}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs font-semibold text-slate-600 mb-2">Pipeline Health</div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Total launches</span>
              <span className="font-medium">{launches.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Active winners</span>
              <span className="font-medium text-green-600">{winners}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Avg quality score</span>
              <span className={`font-medium ${scoreColor(avgScore)}`}>{avgScore}</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs font-semibold text-slate-600 mb-2">Revenue Impact</div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">New item revenue</span>
              <span className="font-medium">{fmt$(totalRevenue)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Win rate</span>
              <span className="font-medium text-blue-600">
                {launches.length ? fmtPct(winners / launches.length, 0) : "—"}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Avg $/launch</span>
              <span className="font-medium">
                {launches.length ? fmt$(totalRevenue / launches.length) : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border border-slate-100 rounded-lg p-3">
        <div className="text-xs font-semibold text-slate-600 mb-2">Strategic Outlook</div>
        <p className="text-xs text-slate-600 leading-relaxed">
          {avgScore >= 60
            ? `Innovation portfolio is performing above benchmark with a ${avgScore}/100 average quality score. ${winners} of ${launches.length} launches have achieved distribution milestones. Recommend continued investment in the current go-to-market playbook.`
            : `Innovation portfolio quality (${avgScore}/100) is below target threshold. ${winners} of ${launches.length} launches are on track. Recommend diagnostic review of attribute strategy and launch execution.`}
        </p>
      </div>
    </div>
  );
}

function ToastNotification({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 z-50 animate-fade-in">
      <CheckCircle2 size={16} className="text-green-400" />
      {message}
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white">×</button>
    </div>
  );
}

export default function StoryBuilder() {
  const [storyType, setStoryType] = useState<StoryType>("innovation-brief");
  const [selectedUpcs, setSelectedUpcs] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [context, setContext] = useState("");
  const [launchSearch, setLaunchSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const filteredLaunches = useMemo(() => {
    const q = launchSearch.toLowerCase();
    if (!q) return LAUNCHES.slice(0, 30);
    return LAUNCHES.filter(
      (l) => l.description.toLowerCase().includes(q) || l.brand.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [launchSearch]);

  const selectedLaunches = useMemo(
    () => LAUNCHES.filter((l) => selectedUpcs.includes(l.upc)),
    [selectedUpcs]
  );

  function toggleLaunch(upc: string) {
    setSelectedUpcs((prev) =>
      prev.includes(upc) ? prev.filter((u) => u !== upc) : [...prev, upc]
    );
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleCopy() {
    const lines = [
      `# ${selectedBrand || "Brand"} Innovation Story`,
      `Period: March 2026 | Launches: ${selectedLaunches.length}`,
      ``,
      context,
      ``,
      `## Launches`,
      ...selectedLaunches.map(
        (l) =>
          `- ${l.description} (${l.category}): Quality ${l.launchQualityScore}, Velocity ${fmt$(l.velocityLatest)}`
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => showToast("Summary copied to clipboard"));
  }

  function handlePrint() {
    window.print();
  }

  const PreviewComponent =
    storyType === "retailer-sell"
      ? RetailerSellPreview
      : storyType === "leadership-summary"
      ? LeadershipSummaryPreview
      : InnovationBriefPreview;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex gap-5">
        {/* Config panel */}
        <div className="w-72 shrink-0 space-y-4">
          {/* Story type */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-600 mb-3">Story Type</h3>
            <div className="space-y-2">
              {STORY_TYPES.map(({ id, label, icon: Icon, description }) => (
                <button
                  key={id}
                  onClick={() => setStoryType(id)}
                  className={`w-full text-left p-3 rounded-lg border text-xs transition-all ${
                    storyType === id
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-100 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium text-slate-700 mb-0.5">
                    <Icon size={12} />
                    {label}
                  </div>
                  <div className="text-slate-400 leading-snug">{description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Brand selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-600 mb-2">Brand</h3>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
            >
              <option value="">Select a brand...</option>
              {BRANDS.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Launch selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-600 mb-2">
              Launches{" "}
              {selectedUpcs.length > 0 && (
                <span className="text-blue-600">({selectedUpcs.length} selected)</span>
              )}
            </h3>
            <input
              type="text"
              placeholder="Search launches..."
              value={launchSearch}
              onChange={(e) => setLaunchSearch(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 mb-2 focus:outline-none focus:border-blue-400"
            />
            <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
              {filteredLaunches.map((l) => (
                <label
                  key={l.upc}
                  className="flex items-start gap-2 text-xs cursor-pointer p-1.5 rounded hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedUpcs.includes(l.upc)}
                    onChange={() => toggleLaunch(l.upc)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <div className="font-medium text-slate-700 leading-tight truncate max-w-[160px]">
                      {l.description}
                    </div>
                    <div className="text-slate-400 text-[10px]">{l.category}</div>
                  </div>
                </label>
              ))}
            </div>
            {selectedUpcs.length > 0 && (
              <button
                onClick={() => setSelectedUpcs([])}
                className="mt-2 text-[10px] text-slate-400 hover:text-slate-600"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Context */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-600 mb-2">Custom Context</h3>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Add strategic context, goals, or additional background..."
              rows={4}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4" ref={previewRef}>
            <PreviewComponent
              launches={selectedLaunches}
              brandName={selectedBrand}
              context={context}
            />
          </div>

          {/* Export actions */}
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download size={14} />
              Export PDF
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 text-sm px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:border-slate-300 transition-colors"
            >
              <Copy size={14} />
              Copy Summary
            </button>
          </div>
        </div>
      </div>

      {toast && <ToastNotification message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
