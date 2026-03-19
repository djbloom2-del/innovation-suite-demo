# Attribute Intelligence Module — Design Document

**Date:** 2026-03-19
**Status:** Approved
**Location:** Winner DNA page (`/winner-dna`) — new "Attribute Intelligence" section appended below existing panels

---

## Problem

The current platform surfaces attribute performance as individual, static views (win rate by attribute, a fixed set of 6 boolean claims). When SPINS data arrives it will carry dozens to hundreds of attributes per category. The existing model cannot scale to that volume, cannot compute interaction effects between attributes, and does not expose the Innovation Index — a critical signal showing whether the market is moving toward or away from an attribute in new launches vs. established items.

---

## Goals

1. Surface the most successful attribute combinations automatically — no user configuration required.
2. Compute and expose the **Innovation Index** for individual attributes and combinations.
3. Let users search, pin, and explore any attribute from a large universe and immediately see combination performance and the marginal contribution of each attribute to the set.
4. Prepare the data layer to handle 50–200+ attributes when SPINS data replaces synthetic data.

---

## Key Definitions

### New Item vs. Existing Item

| Term | Definition |
|------|-----------|
| New Item | A launch with `ageWeeks < 52` — it has sales in the latest 52 weeks but zero sales in the prior 52 weeks (first year in market) |
| Existing Item | A launch with `ageWeeks >= 52` — it had sales in both the current and prior 52-week windows |

### Innovation Index

```
Innovation Index =
  (attr's share of new-item $) ÷ (attr's share of existing-item $) × 100
```

- **100** = attribute is equally represented in new and existing items (neutral)
- **> 100** = attribute is being adopted faster by new launches than established items (innovating / emerging)
- **< 100** = attribute is more entrenched in older items; new launches moving away (commoditising)

This formula applies identically to single attributes and combinations (filter for launches carrying all attributes in the set).

### Marginal Contribution

For a set of N pinned attributes, the marginal contribution of attribute X is:

```
marginalContribution(X) = winRate(full set) − winRate(full set excluding X)
```

Expressed in percentage points. Positive = X adds lift to the combination; negative = X is a drag.

---

## Architecture

### Data Layer — `src/data/attributes.ts`

Add a new pure computation function `computeAttributeIntelligence(launches, category)` that returns:

```typescript
interface AttributeIntelligenceResult {
  // Per-attribute metrics (for ranked table and waterfall)
  singles: AttributeIntelRecord[];
  // All 2-attr and 3-attr combos from the pinned set, ranked by Innovation Index
  combos: ComboIntelRecord[];
}

interface AttributeIntelRecord {
  attr: string;                  // attribute name (any string — not limited to ATTR_KEYS)
  innovationIndex: number;       // see formula above
  winRate: number;               // win rate of launches with this attribute
  baselineWinRate: number;       // category win rate (for lift calculation)
  lift: number;                  // winRate / baselineWinRate
  newItemDollarShare: number;    // % of new-item $ carrying this attr
  existingItemDollarShare: number;
  launchCount: number;
  penetrationRate: number;       // share of category launches with this attr
  marginalContribution: number;  // delta win rate if this attr is added to the rest of the pinned set
}

interface ComboIntelRecord {
  attrs: string[];               // 2 or 3 attribute names
  innovationIndex: number;
  winRate: number;
  lift: number;                  // vs. category baseline
  launchCount: number;
  newItemDollarShare: number;
  existingItemDollarShare: number;
}
```

The function is called dynamically from the Winner DNA page — it receives the full `LAUNCHES` array filtered to the selected category, plus the user's pinned attribute list. Because it is a pure function over the launch data, it scales to any attribute universe without schema changes.

**Attribute matching:** The existing `matchesAttr()` helper is currently hard-coded to the 6 boolean ATTR_KEYS. A new `matchesAttrDynamic(launch, attrName)` helper will replace it for the intelligence layer, dispatching to the correct field based on attribute name. When SPINS data arrives the `AttributeSet` type will expand; the matching function is the only place that needs updating.

### UI Layer — `src/app/winner-dna/page.tsx`

A new `<AttributeIntelligenceSection />` component is added at the bottom of the Winner DNA page. It is self-contained: it owns its own state and calls `computeAttributeIntelligence` via `useMemo`.

---

## UI Design

### Section Header

```
[ Attribute Intelligence ]
Category: [Bars] [Beverages] [Snacks] [Supplements] [Frozen Meals]
Search attributes: [ type to search and pin... ]   Pinned: [Organic ×] [Protein ×] [Non-GMO ×]
```

- Category pill filter (single select, default = first category)
- Text search input that filters the full attribute universe; selecting an attribute pins it
- Pinned attributes shown as removable chips
- "Clear all" resets pins

---

### Panel 1 — Combination Summary (always live)

A KPI strip showing the full-set metrics for all currently pinned attributes:

| Metric | Description |
|--------|-------------|
| Combo Win Rate | Win rate of launches carrying ALL pinned attributes |
| Innovation Index | Innovation Index for the full combination |
| Lift vs. Baseline | Combo win rate ÷ category baseline win rate |
| Matching Launches | Count of category launches that carry all pinned attributes |

When no attributes are pinned, this strip shows category-level defaults.

---

### Panel 2 — Attribute Waterfall

A horizontal waterfall chart (Recharts `ComposedChart` with `Bar` + `ReferenceLine`):

- **Leftmost bar:** category baseline win rate (grey)
- **Each subsequent bar:** one pinned attribute's marginal contribution — green if positive, red if negative
- **Rightmost bar:** full-combination win rate (blue)
- Attributes are **auto-sorted** by absolute marginal contribution (largest contributor first)
- Each bar is labeled with the attribute name and the delta (e.g., "+9pp", "−3pp")
- Tooltip on hover shows: attribute name, marginal contribution, win rate if this attribute is included vs. excluded

This answers: "Which attribute in my combination is doing the most work?"

When fewer than 2 attributes are pinned, the waterfall shows a placeholder prompt.

---

### Panel 3 — Ranked Combination Table

A sortable table of all meaningful subsets of the pinned attributes:

| Columns | |
|---------|-|
| Attributes | Comma-separated attribute names, badges |
| Innovation Index | Colour-coded (green ≥ 120, amber 80–119, red < 80) |
| Win Rate | % |
| Lift | ×N vs. category baseline |
| New Item $ Share | % of new-item dollars carrying this set |
| Existing Item $ Share | % of existing-item dollars |
| Launches | Count |

- Includes all singles, all 2-attr pairs, and all 3-attr triples from the pinned set
- Default sort: Innovation Index descending
- User can re-sort by any column
- With N pinned attributes, maximum rows = N + C(N,2) + C(N,3); capped at N ≤ 8 to keep the table readable (with a note if the user pins more)

This answers: "Which subset of my pinned attributes is actually driving the Innovation Index?"

---

## Visual Layout

```
┌─ Attribute Intelligence ──────────────────────────────────────┐
│  Category: [Bars] [Beverages] ...                             │
│  Search: [_______________]  Pinned: [Organic×] [Protein×] ... │
├───────────────────────────────────────────────────────────────┤
│  KPI Strip: Combo Win Rate | Innovation Index | Lift | Count  │
├─────────────────────────┬─────────────────────────────────────┤
│  Waterfall Chart        │  Ranked Combo Table                 │
│  (left ~45%)            │  (right ~55%)                       │
│                         │                                     │
│  Baseline → +Protein    │  ┌────────────────────────────────┐ │
│  → +Non-GMO → −Keto     │  │ Attrs | Innov. | WR | Lift ... │ │
│  → Combo total          │  │ ...rows...                     │ │
│                         │  └────────────────────────────────┘ │
└─────────────────────────┴─────────────────────────────────────┘
```

---

## Data Flow

```
LAUNCHES (all 80)
    │
    ▼ filter by selected category
catLaunches
    │
    ├─► split by ageWeeks < 52 / ≥ 52 → newItems / existingItems
    │       used to compute Innovation Index for all subsets
    │
    ├─► getWinners(catLaunches) → baseline win rate
    │
    └─► computeAttributeIntelligence(catLaunches, pinnedAttrs)
            │
            ├─► singles[]  → KPI strip + waterfall marginal contributions
            └─► combos[]   → ranked combo table
```

All computation is done in a single `useMemo` triggered by `[selectedCategory, pinnedAttrs]`. No new data files required for the prototype.

---

## Scalability Notes (SPINS transition)

| Concern | Mitigation |
|---------|-----------|
| 50–200 attributes per category | Search-to-pin UI means only pinned attrs are shown; full universe never rendered at once |
| Attribute matching dispatch | Single `matchesAttrDynamic()` function; expand with new attr types without touching UI |
| Combo explosion at large N | Table capped at singles + pairs + triples (max 3-way combos) regardless of pin count; computation is O(2^N) but N is bounded by user pins, practically ≤ 6–8 |
| New attribute schema fields | `AttributeSet` type in `types.ts` + `matchesAttrDynamic()` are the only two touch points |

---

## Files Changed

| File | Change |
|------|--------|
| `src/data/attributes.ts` | Add `computeAttributeIntelligence()`, `matchesAttrDynamic()`, `AttributeIntelRecord`, `ComboIntelRecord` |
| `src/app/winner-dna/page.tsx` | Add `<AttributeIntelligenceSection />` component at page bottom |
| `src/lib/types.ts` | Add `AttributeIntelRecord`, `ComboIntelRecord` interfaces |
| `src/app/prototype-radar/page.tsx` | **Delete** — prototype only, not part of final build |

---

## Out of Scope

- Attribute trend signals over time (requires time-series data)
- Cross-category attribute comparison (future)
- Saved/bookmarked attribute pin sets (future)
- The Innovation Opportunity Briefs section on Whitespace Lab is not changed
