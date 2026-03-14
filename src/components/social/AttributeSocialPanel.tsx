"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import type { AttrKey } from "@/data/attributes";
import { RedditFeed } from "./RedditFeed";

// ── Attribute metadata ───────────────────────────────────────────────────────

const ATTR_META: Record<AttrKey, { sub: string; query: string }> = {
  "Organic":     { sub: "nutrition",   query: "organic food products review" },
  "Non-GMO":     { sub: "nutrition",   query: "non gmo food labeling" },
  "Gluten-Free": { sub: "glutenfree",  query: "gluten free snacks products" },
  "Vegan":       { sub: "vegan",       query: "vegan snacks food products" },
  "Keto":        { sub: "keto",        query: "keto snacks food review" },
  "Protein":     { sub: "fitness",     query: "high protein snacks food" },
};

// Keep these in sync with ATTR_COLORS in winner-dna/page.tsx
const ATTR_COLORS: Record<AttrKey, string> = {
  "Organic":     "#2563eb",
  "Non-GMO":     "#16a34a",
  "Gluten-Free": "#7c3aed",
  "Vegan":       "#d97706",
  "Keto":        "#0891b2",
  "Protein":     "#db2777",
};

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  attrs: readonly AttrKey[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function AttributeSocialPanel({ attrs }: Props) {
  const [activeAttr, setActiveAttr] = useState<AttrKey>(attrs[0]);

  // If the attrs prop changes and activeAttr is no longer in the list, reset
  const safeAttr: AttrKey = attrs.includes(activeAttr) ? activeAttr : attrs[0];
  const meta = ATTR_META[safeAttr];

  if (attrs.length === 0) return null;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle size={14} className="text-blue-500" />
        <h2 className="text-sm font-semibold text-slate-700">Social Signals — Reddit</h2>
        <span className="text-[10px] text-slate-400 ml-auto">Live consumer discussions</span>
      </div>

      {/* Attribute pills */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {attrs.map((attr) => {
          const isActive = attr === safeAttr;
          const color = ATTR_COLORS[attr];
          return (
            <button
              key={attr}
              onClick={() => setActiveAttr(attr)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
              style={
                isActive
                  ? { backgroundColor: color, borderColor: color, color: "#fff" }
                  : { backgroundColor: "#fff", borderColor: "#e2e8f0", color: "#475569" }
              }
            >
              {attr}
            </button>
          );
        })}
      </div>

      {/* Subreddit context badge */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] text-slate-400">Searching</span>
        <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
          r/{meta.sub}
        </span>
        <span className="text-[10px] text-slate-400">for</span>
        <span className="text-[10px] text-slate-500 italic">"{meta.query}"</span>
      </div>

      {/* Feed */}
      <RedditFeed
        query={meta.query}
        subreddit={meta.sub}
        sort="top"
        timePeriod="week"
        limit={5}
        emptyMessage={`No recent Reddit discussions found for ${safeAttr}.`}
      />
    </div>
  );
}
