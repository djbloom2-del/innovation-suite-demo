# Attribute Intelligence Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Attribute Intelligence" section to the Winner DNA page that computes the Innovation Index, a marginal-contribution waterfall, and a ranked combination table for any set of user-pinned attributes.

**Architecture:** Pure computation functions in `src/data/attributes.ts` feed a self-contained `AttributeIntelligenceSection` React component that is appended to the Winner DNA page. All computation runs inside a single `useMemo` keyed on category + pinned attributes — no new data files, no new routes.

**Tech Stack:** Next.js 16 App Router, TypeScript strict mode, Recharts (`ComposedChart`, `Bar`, `Cell`, `LabelList`), Tailwind v4, lucide-react

---

## Context

### Attribute data today
- `src/data/attributes.ts` — `ATTR_KEYS` (6 boolean claims), `matchesAttr(l, attr: AttrKey)`, `ATTRIBUTE_PERFORMANCE`, `ATTRIBUTE_COMBOS` (static, hardcoded)
- `src/lib/types.ts` — `AttributeSet`, `AttributePerf`, `AttributeCombo`
- Winner DNA page already imports from attributes; the new section is additive only

### Key definitions
- **New item:** `ageWeeks < 52` (first year, no prior-year sales)
- **Existing item:** `ageWeeks >= 52`
- **Innovation Index** = `(attr $ share of new items) / (attr $ share of existing items) × 100`
  - 100 = neutral, >100 = emerging in new launches, <100 = entrenched in older items
- **Marginal contribution of attr X** = `winRate(full pinned set) − winRate(full pinned set excluding X)`
- **Winners** = `getWinners()` from `src/data/launches.ts` (already exported)

### Prototype to delete
`src/app/prototype-radar/page.tsx` — radar chart prototype committed for evaluation, now confirmed unused

---

## Task 1: Remove prototype and add TypeScript interfaces

**Files:**
- Delete: `src/app/prototype-radar/page.tsx`
- Modify: `src/lib/types.ts`

**Step 1: Delete the prototype page**

```bash
rm src/app/prototype-radar/page.tsx
```

**Step 2: Add interfaces to `src/lib/types.ts`**

Add after the `AttributeCombo` interface (around line 169):

```typescript
export interface AttributeIntelRecord {
  attr: string;
  innovationIndex: number;        // (newShare / existingShare) × 100; 100 = neutral
  winRate: number;                // win rate of launches with this attr
  baselineWinRate: number;        // category-wide win rate (for lift)
  lift: number;                   // winRate / baselineWinRate
  newItemDollarShare: number;     // attr $ / total new-item $ in category
  existingItemDollarShare: number;
  launchCount: number;
  penetrationRate: number;        // attr launches / all category launches
  marginalContribution: number;   // winRate(full set) − winRate(set without this attr); 0 when < 2 pinned
}

export interface ComboIntelRecord {
  attrs: string[];                // 2 or 3 attribute names
  innovationIndex: number;
  winRate: number;
  lift: number;
  launchCount: number;
  newItemDollarShare: number;
  existingItemDollarShare: number;
}
```

**Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/lib/types.ts
git rm src/app/prototype-radar/page.tsx
git commit -m "feat: add AttributeIntelRecord + ComboIntelRecord types; remove radar prototype"
```

---

## Task 2: Add computation layer to `src/data/attributes.ts`

**Files:**
- Modify: `src/data/attributes.ts`

Add all of the following to the **bottom** of the file.

**Step 1: Add imports at top of file**

`src/data/attributes.ts` already imports `Launch` and `LAUNCHES`. Add `AttributeIntelRecord` and `ComboIntelRecord` to the type imports from `@/lib/types`:

```typescript
import type { AttributePerf, AttributeCombo, Category, AttributeIntelRecord, ComboIntelRecord } from "@/lib/types";
```

**Step 2: Add `matchesAttrDynamic` helper**

This replaces the hard-coded `matchesAttr` for the intelligence layer and is the single touch-point when SPINS adds new attribute fields.

```typescript
// ─── Dynamic attribute matcher (scales to any attribute universe) ─────────────
export function matchesAttrDynamic(l: Launch, attrName: string): boolean {
  const a = l.attributes;
  if (attrName === "Organic")     return a.isOrganic;
  if (attrName === "Non-GMO")     return a.isNonGmo;
  if (attrName === "Gluten-Free") return a.isGlutenFree;
  if (attrName === "Vegan")       return a.isVegan;
  if (attrName === "Keto")        return a.isKeto;
  if (attrName === "Protein")     return a.isProteinFocused;
  // Future SPINS attributes added here — no UI changes required
  return false;
}
```

**Step 3: Add `combosOf` helper (private)**

```typescript
// ─── Combination enumeration helper ──────────────────────────────────────────
function combosOf<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [
    ...combosOf(rest, k - 1).map((c) => [first, ...c]),
    ...combosOf(rest, k),
  ];
}
```

**Step 4: Add `computeAttributeIntelligence`**

```typescript
// ─── Core intelligence computation ───────────────────────────────────────────

/**
 * Computes Innovation Index, win rate, lift, and marginal contribution for
 * every attribute in `attrs`, plus all 2-attr and 3-attr subsets.
 *
 * @param catLaunches  All launches filtered to a single category
 * @param attrs        User-pinned attribute names (any strings)
 */
export function computeAttributeIntelligence(
  catLaunches: Launch[],
  attrs: string[],
): { singles: AttributeIntelRecord[]; combos: ComboIntelRecord[] } {
  if (attrs.length === 0) return { singles: [], combos: [] };

  const winners    = getWinners(catLaunches);
  const winnerSet  = new Set(winners.map((w) => w.upc));
  const baselineWR = catLaunches.length > 0 ? winners.length / catLaunches.length : 0;

  const newItems      = catLaunches.filter((l) => l.ageWeeks < 52);
  const existingItems = catLaunches.filter((l) => l.ageWeeks >= 52);
  const totalNew$     = newItems.reduce((s, l) => s + l.dollarsLatest, 0);
  const totalExisting$= existingItems.reduce((s, l) => s + l.dollarsLatest, 0);

  function wrOf(pool: Launch[]): number {
    if (!pool.length) return 0;
    return pool.filter((l) => winnerSet.has(l.upc)).length / pool.length;
  }

  function innovIdx(pool: Launch[]): number {
    const newWith      = pool.filter((l) => l.ageWeeks < 52);
    const existWith    = pool.filter((l) => l.ageWeeks >= 52);
    const newShare     = totalNew$      > 0 ? newWith.reduce((s, l)   => s + l.dollarsLatest, 0) / totalNew$      : 0;
    const existShare   = totalExisting$ > 0 ? existWith.reduce((s, l) => s + l.dollarsLatest, 0) / totalExisting$ : 0;
    if (existShare === 0) return newShare > 0 ? 200 : 100;
    return Math.round((newShare / existShare) * 100);
  }

  // Full-combo win rate (used for marginal contribution)
  const fullCombo   = catLaunches.filter((l) => attrs.every((a) => matchesAttrDynamic(l, a)));
  const fullComboWR = wrOf(fullCombo);

  // Singles
  const singles: AttributeIntelRecord[] = attrs.map((attr) => {
    const withAttr  = catLaunches.filter((l) => matchesAttrDynamic(l, attr));
    // Set of all pinned attrs except this one
    const rest      = attrs.filter((a) => a !== attr);
    const withoutAttr = rest.length > 0
      ? catLaunches.filter((l) => rest.every((a) => matchesAttrDynamic(l, a)))
      : catLaunches;

    const newWith    = withAttr.filter((l) => l.ageWeeks < 52);
    const existWith  = withAttr.filter((l) => l.ageWeeks >= 52);
    const newShare   = totalNew$      > 0 ? newWith.reduce((s, l)   => s + l.dollarsLatest, 0) / totalNew$      : 0;
    const existShare = totalExisting$ > 0 ? existWith.reduce((s, l) => s + l.dollarsLatest, 0) / totalExisting$ : 0;

    return {
      attr,
      innovationIndex:         innovIdx(withAttr),
      winRate:                 wrOf(withAttr),
      baselineWinRate:         baselineWR,
      lift:                    baselineWR > 0 ? wrOf(withAttr) / baselineWR : 1,
      newItemDollarShare:      newShare,
      existingItemDollarShare: existShare,
      launchCount:             withAttr.length,
      penetrationRate:         catLaunches.length > 0 ? withAttr.length / catLaunches.length : 0,
      // marginalContribution: how much does fullComboWR drop when we remove this attr?
      marginalContribution:    attrs.length >= 2 ? fullComboWR - wrOf(withoutAttr) : 0,
    };
  });

  // 2-attr and 3-attr combos
  const comboSets = [...combosOf(attrs, 2), ...combosOf(attrs, 3)];
  const combos: ComboIntelRecord[] = comboSets.map((set) => {
    const matched = catLaunches.filter((l) => set.every((a) => matchesAttrDynamic(l, a)));
    const newWith    = matched.filter((l) => l.ageWeeks < 52);
    const existWith  = matched.filter((l) => l.ageWeeks >= 52);
    return {
      attrs:                   set,
      innovationIndex:         innovIdx(matched),
      winRate:                 wrOf(matched),
      lift:                    baselineWR > 0 ? wrOf(matched) / baselineWR : 1,
      launchCount:             matched.length,
      newItemDollarShare:      totalNew$      > 0 ? newWith.reduce((s, l)   => s + l.dollarsLatest, 0) / totalNew$      : 0,
      existingItemDollarShare: totalExisting$ > 0 ? existWith.reduce((s, l) => s + l.dollarsLatest, 0) / totalExisting$ : 0,
    };
  });

  return { singles, combos };
}

/**
 * Returns all ATTR_KEYS ranked by Innovation Index for a given category.
 * Used for the "nothing pinned" default table view.
 */
export function getTopSinglesByInnovationIndex(
  catLaunches: Launch[],
): AttributeIntelRecord[] {
  const allAttrs = [...ATTR_KEYS] as string[];
  const { singles } = computeAttributeIntelligence(catLaunches, allAttrs);
  return singles.sort((a, b) => b.innovationIndex - a.innovationIndex);
}
```

**Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 6: Commit**

```bash
git add src/data/attributes.ts
git commit -m "feat: add matchesAttrDynamic, computeAttributeIntelligence, getTopSinglesByInnovationIndex"
```

---

## Task 3: Build `AttributeIntelligenceSection` — controls, KPI strip, and skeleton

**Files:**
- Create: `src/components/winner-dna/AttributeIntelligenceSection.tsx`
- Modify: `src/app/winner-dna/page.tsx`

**Step 1: Create the component file**

Create `src/components/winner-dna/AttributeIntelligenceSection.tsx` with the full structure below. This task wires up the category filter, search/pin controls, and KPI strip only — the waterfall and table panels are placeholders (added in Tasks 4 and 5).

```tsx
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
import { fmt$, fmtPct } from "@/lib/utils";
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
```

**Step 2: Wire into `src/app/winner-dna/page.tsx`**

At the very top of the file, add the import (after existing imports):

```typescript
import { AttributeIntelligenceSection } from "@/components/winner-dna/AttributeIntelligenceSection";
```

At the bottom of the JSX returned by the page component (after the last existing section closing tag, before the outer `</div>`), add:

```tsx
<AttributeIntelligenceSection />
```

**Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Visual check**

Navigate to `http://localhost:3000/winner-dna`. Scroll to the bottom. You should see:
- Section header "Attribute Intelligence"
- 5 category pills
- Search input with quick-pin buttons below it
- 4 KPI tiles (win rate, innovation index, lift, count)
- Two dashed placeholder boxes

**Step 5: Commit**

```bash
git add src/components/winner-dna/AttributeIntelligenceSection.tsx src/app/winner-dna/page.tsx
git commit -m "feat: add AttributeIntelligenceSection skeleton with controls and KPI strip"
```

---

## Task 4: Add the waterfall chart

**Files:**
- Modify: `src/components/winner-dna/AttributeIntelligenceSection.tsx`

The waterfall uses a stacked `BarChart` with two series: a transparent spacer (`base`) and a coloured visible bar (`value`). Each bar is coloured individually with `Cell`.

**Step 1: Add Recharts imports at top of component file**

Add to the existing recharts import (the component already has no recharts import — add fresh):

```typescript
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
```

**Step 2: Add waterfall data builder (module-level, above the component)**

```typescript
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
    (a, b) => Math.abs(b.marginalContribution) - Math.abs(a.marginalContribution),
  );

  const data: WaterfallPoint[] = [];
  let running = pct(baselineWinRate);

  // Baseline bar — full height from 0
  data.push({ name: "Baseline", base: 0, value: running, rawDelta: running, type: "baseline" });

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
  data.push({ name: "Combination", base: 0, value: pct(comboWinRate), rawDelta: pct(comboWinRate), type: "total" });

  return data;
}

const WATERFALL_FILL: Record<WaterfallPoint["type"], string> = {
  baseline: "#94a3b8",
  positive: "#16a34a",
  negative: "#dc2626",
  total:    "#2563eb",
};
```

**Step 3: Add `waterfallData` memo inside the component**

Inside the component body, after the existing memos, add:

```typescript
const waterfallData = useMemo(() => {
  if (pinnedAttrs.length < 2) return null;
  return buildWaterfallData(baselineWinRate, singles, comboWinRate);
}, [baselineWinRate, singles, comboWinRate, pinnedAttrs.length]);
```

**Step 4: Replace the waterfall placeholder with the real chart**

Replace the waterfall dashed placeholder `<div>` with:

```tsx
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
  ) : !waterfallData ? null : (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={waterfallData} margin={{ top: 24, right: 16, bottom: 8, left: 8 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
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
              if (typeof v !== "number") return "";
              // Only show delta labels, not baseline/total raw values
              return v > 0 && v < 100 ? `+${v.toFixed(1)}pp` : v < 0 ? `${v.toFixed(1)}pp` : `${v.toFixed(1)}%`;
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
```

**Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If `formatter={(v: any) =>` triggers a strict error, the `any` type is already used — this is the project's known pattern for Recharts tooltip formatters (see MEMORY.md).

**Step 6: Visual check**

Navigate to `http://localhost:3000/winner-dna`. Scroll to Attribute Intelligence. Pin any 2+ attributes. The waterfall should render with grey baseline bar, green/red delta bars per attribute (sorted by impact), blue total bar, and pp labels on top.

**Step 7: Commit**

```bash
git add src/components/winner-dna/AttributeIntelligenceSection.tsx
git commit -m "feat: add marginal contribution waterfall to AttributeIntelligenceSection"
```

---

## Task 5: Add the ranked combination table and final build check

**Files:**
- Modify: `src/components/winner-dna/AttributeIntelligenceSection.tsx`

**Step 1: Add `tableRows` memo inside the component**

Add after the existing memos (after `waterfallData`):

```typescript
type TableRow = {
  attrs: string[];
  innovationIndex: number;
  winRate: number;
  lift: number;
  launchCount: number;
  newItemDollarShare: number;
  existingItemDollarShare: number;
};

const tableRows = useMemo((): TableRow[] => {
  if (pinnedAttrs.length === 0) {
    // Default: show all-singles ranked by Innovation Index
    return defaultSingles.map((s) => ({
      attrs:                   [s.attr],
      innovationIndex:         s.innovationIndex,
      winRate:                 s.winRate,
      lift:                    s.lift,
      launchCount:             s.launchCount,
      newItemDollarShare:      s.newItemDollarShare,
      existingItemDollarShare: s.existingItemDollarShare,
    }));
  }

  const singleRows: TableRow[] = singles.map((s) => ({
    attrs:                   [s.attr],
    innovationIndex:         s.innovationIndex,
    winRate:                 s.winRate,
    lift:                    s.lift,
    launchCount:             s.launchCount,
    newItemDollarShare:      s.newItemDollarShare,
    existingItemDollarShare: s.existingItemDollarShare,
  }));

  const comboRows: TableRow[] = combos.map((c) => ({ ...c }));

  const all = [...singleRows, ...comboRows];

  return all.sort((a, b) => {
    if (comboSort === "innovationIndex") return b.innovationIndex - a.innovationIndex;
    if (comboSort === "winRate")         return b.winRate - a.winRate;
    if (comboSort === "lift")            return b.lift - a.lift;
    return b.launchCount - a.launchCount;
  });
}, [pinnedAttrs, singles, combos, defaultSingles, comboSort]);
```

**Step 2: Replace the table placeholder with the real table**

Replace the table dashed placeholder `<div>` with:

```tsx
{/* ── Ranked combo table ── */}
<div className="bg-white rounded-xl border border-slate-200 p-5">
  <div className="flex items-center justify-between gap-3 mb-1">
    <div>
      <h3 className="text-xs font-semibold text-slate-700">
        {pinnedAttrs.length === 0
          ? `All Attributes — ${selectedCat} (ranked by Innovation Index)`
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
              {fmtPct(row.newItemDollarShare, 1)}
            </td>
            {/* Existing Item $ share */}
            <td className="py-2 pl-3 text-right text-slate-600">
              {fmtPct(row.existingItemDollarShare, 1)}
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
```

**Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Full build**

```bash
npm run build
```

Expected: exit 0, no errors.

**Step 5: Visual check**

- Navigate to `http://localhost:3000/winner-dna`, scroll to Attribute Intelligence
- With nothing pinned: table shows all 6 attributes ranked by Innovation Index for the selected category
- Pin "Protein": KPI strip updates, table shows the single row for Protein
- Pin "Non-GMO": waterfall appears (baseline → +/− Protein → +/− Non-GMO → Combination); table shows 2 singles + 1 pair
- Pin "Organic": table now shows 3 singles + 3 pairs + 1 triple; waterfall has 3 delta bars
- Switch categories: all panels recompute; pinned attrs reset
- Sort by Win Rate, Lift, Launch Count: table re-orders

**Step 6: Commit**

```bash
git add src/components/winner-dna/AttributeIntelligenceSection.tsx
git commit -m "feat: add ranked combination table to AttributeIntelligenceSection; complete attribute intelligence module"
```

---

## Summary of Changes

| File | Action |
|------|--------|
| `src/app/prototype-radar/page.tsx` | Deleted |
| `src/lib/types.ts` | +`AttributeIntelRecord`, +`ComboIntelRecord` |
| `src/data/attributes.ts` | +`matchesAttrDynamic`, +`computeAttributeIntelligence`, +`getTopSinglesByInnovationIndex` |
| `src/components/winner-dna/AttributeIntelligenceSection.tsx` | Created (new) |
| `src/app/winner-dna/page.tsx` | +import + `<AttributeIntelligenceSection />` at page bottom |
