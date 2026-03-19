# Innovation Type Classification — Design Doc
**Date:** 2026-03-19
**Status:** Approved

---

## Problem

The platform currently treats every new product launch as an undifferentiated "new item." In reality, CPG innovation spans a wide spectrum: a brand launching their first-ever product in a new category is fundamentally different from them adding a new flavor to an existing line. Understanding the innovation type helps analysts assess risk profile, benchmark win rates appropriately, and understand a company's innovation strategy at a glance.

## Solution

Classify every launch into one of five standard CPG innovation types (plus Unclassified for incomplete data), derived algorithmically from existing data fields — mirroring how a real SPINS data pipeline would classify new UPCs against a brand's established portfolio.

---

## Innovation Type Taxonomy

| Type | Definition | Typical % of launches |
|------|------------|----------------------|
| **Flavor / Variety Extension** | Same brand, category, and form — new flavor or variety | ~50% |
| **New to World** | Subcategory + form combination rare across entire market | ~12% |
| **Format Extension** | Same brand and category, new physical form (e.g. bar → bites) | ~14% |
| **Category Extension** | Brand entering a new category | ~8% |
| **Pack Size Variant** | Same product, different count or size | ~6% |
| **Unclassified** | Missing form, flavor, or subcategory data | <5% |

---

## Data Model Changes

### `src/lib/types.ts`

Add `InnovationType` union type:
```typescript
export type InnovationType =
  | "Flavor Extension"
  | "New to World"
  | "Format Extension"
  | "Category Extension"
  | "Pack Size Variant"
  | "Unclassified";
```

Add `packFormat` to `AttributeSet`:
```typescript
packFormat: "Single" | "Multipack" | "Family" | "Trial" | "Variety Pack";
```
Most products are `"Single"`. This replaces the fragile description-string-parsing approach. In real SPINS data, pack size is coded at the attribute level, not inferred from product names.

Add `innovationType` to `Launch`:
```typescript
innovationType: InnovationType;
```

---

## Classification Engine

### `src/lib/innovation.ts` (new file)

**`classifyInnovationType(launch: Launch, allLaunches: Launch[]): InnovationType`**

Six rules fire in priority order; first match returns:

```
Rule 1 — Missing data guard
  if !launch.attributes.form || !launch.attributes.flavor || !launch.subcategory
  → "Unclassified"

Rule 2 — Pack Size Variant
  if launch.attributes.packFormat !== "Single"
  → "Pack Size Variant"

Rule 3 — Category Extension
  otherByBrand = allLaunches where brand === launch.brand, upc !== launch.upc
  if otherByBrand.length > 0 AND none are in launch.category
  → "Category Extension"

Rule 4 — Format Extension
  sameBrandCategory = otherByBrand filtered to launch.category
  if sameBrandCategory.length > 0 AND none share launch.attributes.form
  → "Format Extension"

Rule 5 — Flavor Extension
  sameBrandCategoryForm = sameBrandCategory filtered to launch.attributes.form
  if sameBrandCategoryForm.length > 0
  → "Flavor Extension"

Rule 6 — New to World / fallback
  marketCount = allLaunches where subcategory === launch.subcategory
                AND attributes.form === launch.attributes.form
  if marketCount < 4 → "New to World"
  else → "Flavor Extension"  (entering established market as a solo brand entry)
```

**`INNOVATION_TYPE_META: Record<InnovationType, InnovationTypeMeta>`**

```typescript
interface InnovationTypeMeta {
  label: string;           // display name
  shortLabel: string;      // for compact badges
  description: string;     // tooltip / legend copy
  color: string;           // Tailwind bg- class
  textColor: string;       // Tailwind text- class
  borderColor: string;     // Tailwind border- class
  sortOrder: number;       // for consistent display order
}
```

Color palette (distinct, accessible):
- Flavor Extension → violet
- New to World → emerald
- Format Extension → sky
- Category Extension → amber
- Pack Size Variant → slate
- Unclassified → rose

---

## Data Layer

### `src/data/launches.ts`

1. Add `packFormat` to every `LaunchSpec` record in the raw data array:
   - ~90% of records: `packFormat: "Single"`
   - ~6 records spread across categories: `packFormat: "Multipack"` or `"Family"`

2. Add a post-processing step after all launches are built:
```typescript
import { classifyInnovationType } from "@/lib/innovation";

// After rawLaunches array is fully constructed:
export const LAUNCHES: Launch[] = rawLaunches.map(l => ({
  ...l,
  innovationType: classifyInnovationType(l, rawLaunches),
}));
```

---

## Filtering (Launch Explorer)

### `src/lib/filters.ts`

Add to `FilterState`:
```typescript
innovationTypes: InnovationType[];   // [] = no filter
```

Add to `DEFAULT_FILTERS`:
```typescript
innovationTypes: [],
```

Add to `applyLaunchFilters`:
```typescript
if (f.innovationTypes.length > 0 && !f.innovationTypes.includes(l.innovationType)) return false;
```

### `src/app/launches/page.tsx`

New filter group: **"Innovation Type"**, rendered as colored multi-select pills using `INNOVATION_TYPE_META` colors. Pattern is identical to the existing Attribute filter pills. Placed after attribute filters, before the results grid.

---

## Analytics (Winner DNA — DNA Tab)

### `src/app/winner-dna/page.tsx`

New section: **"Innovation Type Performance"** added after the Attribute Combination Explorer.

Two panels in a 2-column grid:

**Left panel — Mix Chart**
- Horizontal bar chart (Recharts `BarChart` horizontal layout)
- One bar per innovation type, sorted by count descending
- X-axis: count of launches
- Bar fill: type color from `INNOVATION_TYPE_META`
- Label: type name + count + % of total

**Right panel — Win Rate by Type**
- Same horizontal bar chart
- X-axis: % survived 26 weeks (win rate)
- Secondary data point: avg Launch Quality Score shown as text on bar
- Insight: New to World and Format Extensions typically win at higher rates than Flavor Extensions

Both panels respect the existing category/retailer/attribute filters on the DNA tab so analysts can ask "for Beverages specifically, what's the win rate by innovation type?"

---

## File Summary

| File | Action |
|------|--------|
| `src/lib/types.ts` | Add `InnovationType`, `packFormat` to `AttributeSet`, `innovationType` to `Launch` |
| `src/lib/innovation.ts` | **Create** — classifier function + `INNOVATION_TYPE_META` |
| `src/data/launches.ts` | Add `packFormat` to each `LaunchSpec`, add post-processing step |
| `src/lib/filters.ts` | Add `innovationTypes` to `FilterState` + `DEFAULT_FILTERS` + filter clause |
| `src/app/launches/page.tsx` | Add Innovation Type filter pill group |
| `src/app/winner-dna/page.tsx` | Add Innovation Type Performance section to DNA tab |

---

## Verification

1. `npm run build` passes with zero TypeScript errors
2. Open Launch Explorer → Innovation Type filter pills appear → selecting "New to World" narrows results to only those launches
3. Check that all 5 non-Unclassified types appear across the 80 launches (no type has 0 results)
4. Open Winner DNA → DNA tab → Innovation Type Performance section renders both panels
5. Apply a category filter (e.g. Beverages only) → both Winner DNA panels update to reflect filtered set
6. Hover a launch in Explorer with `packFormat: "Multipack"` → confirms it classifies as "Pack Size Variant"
