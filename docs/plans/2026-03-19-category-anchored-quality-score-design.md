# Category-Anchored Launch Quality Score — Design

**Date:** 2026-03-19
**Status:** Approved

---

## Problem

The current `launchQualityScore` ranks launches against their cohort peers (launches from the same time window). This creates a category-blind comparison: a Frozen Meals launch hitting $12/store velocity scores identically to a Beverage launch at the same figure, even though $12 is strong in Frozen Meals and weak in Beverages. CPG analysts selling into retailers need a score that reflects "how good is this for *this* category" — not just "how good relative to whatever else launched that quarter."

---

## Goal

Produce a 0–100 `launchQualityScore` where:

- **50** = performing at the category median (acceptable, expected)
- **75+** = meaningfully outperforming the category (strong)
- **25 or below** = struggling relative to category norms (weak)
- Cross-category comparability is preserved: a 75 in Supplements means "exceptional for Supplements" just as a 75 in Frozen Meals means "exceptional for Frozen Meals"

---

## Approved Design: Category-Indexed Ratios (Option A)

### Score Dimensions & Weights

| Dimension | Weight | Benchmark Anchor |
|-----------|--------|-----------------|
| Velocity vs. category median | 35% | `bench.medianVelocity26w` |
| Distribution vs. category median | 25% | `bench.medianTdp12w` |
| Growth vs. category growth rate | 20% | `bench.growthRate` |
| Base mix (non-promo dependency) | 15% | Unchanged |
| Survival ladder | 5% | Unchanged |

### Formulas

```typescript
// Velocity: 50 = at-median, 100 = 2× median or better, 0 = zero
velocityScore = clamp(velocityLatest / bench.medianVelocity26w / 2, 0, 1) * 100

// Distribution: 50 = at-median TDP, 100 = 2× median TDP, 0 = no distribution
distributionScore = clamp(tdpLatest / bench.medianTdp12w / 2, 0, 1) * 100

// Growth: 50 = matching category growth rate
//         100 = growing 20+ percentage points faster than category
//         0   = growing 20+ pp slower (or declining sharply)
growthScore = clamp((growthRate12w - bench.growthRate + 0.20) / 0.40, 0, 1) * 100
// Note: growthRate12w === null → growthScore = 50 (neutral, insufficient data)

// Base mix: percentage of dollars not dependent on promo — unchanged
baseMixScore = (1 - promoDependency) * 100

// Survival ladder — unchanged from current
survivalScore:
  survived52w === true  → 100
  survived26w === true  → 75
  survived12w === true  → 50
  survived12w === false → 0
  else (too early)      → 50

// Composite
launchQualityScore = round(
  velocityScore     * 0.35 +
  distributionScore * 0.25 +
  growthScore       * 0.20 +
  baseMixScore      * 0.15 +
  survivalScore     * 0.05
)
```

### Why These Thresholds

- **Velocity / distribution**: Using 2× median as the ceiling keeps 50 = median and allows room to differentiate outliers. A launch at 1.5× median scores 75; at 2× scores 100.
- **Growth ±20pp window**: Category growth rates differ (11%–31% in our data). A 20pp band above/below gives meaningful signal without making the range too narrow or too wide.
- **Survival 5%**: Survival is a lagging confirmation signal, not a leading driver — kept small.

---

## Methodology Visibility Requirement

Users need to understand what the score means. Implementation must surface the scoring methodology in the UI. Recommended placement:

1. **Info tooltip on QualityScoreGauge** — An `(i)` icon beside the gauge that opens a small popover explaining the five dimensions and their weights.
2. **Score breakdown panel on Launch detail page** — A collapsible "Score Breakdown" section showing each dimension's raw value, the category benchmark it's compared against, and the resulting sub-score. This is the primary transparency surface.

The breakdown panel is the main requirement; the tooltip is a nice-to-have shortcut.

---

## Implementation Scope

| File | Change |
|------|--------|
| `src/lib/utils.ts` | Add `computeQualityScore(l: Launch, bench: CategoryBenchmark): number` |
| `src/data/launches.ts` | Call `computeQualityScore(l, getBenchmark(l.category))` inside `buildLaunch()` instead of the current formula |
| `src/app/launches/[id]/page.tsx` | Add Score Breakdown panel: 5 rows (dimension, value, benchmark, sub-score) |
| `src/components/shared/QualityScoreGauge.tsx` | Optional: add `(i)` tooltip with one-line methodology summary |

Out of scope: no changes to score color thresholds (green ≥75, blue ≥50, amber ≥25, red <25), no changes to `scoreColor()`, `scoreBg()`, `scoreHex()`.

---

## Success Criteria

1. `launchQualityScore` values recalculated using category benchmarks — not cohort peers
2. Supplements launches (high-velocity category) no longer systematically over-score vs. Frozen Meals
3. Score breakdown visible on Launch detail page showing all 5 sub-scores
4. TypeScript strict mode passes, `npm run build` succeeds
5. Manual check: a Frozen Meals launch at `medianVelocity26w` (15.1) should score ~50 on velocity dimension
