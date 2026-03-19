# Category-Anchored Launch Quality Score — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the cohort-relative `launchQualityScore` formula with category-indexed ratios anchored to `CATEGORY_BENCHMARKS`, and expose the scoring methodology as a Score Breakdown panel on the Launch detail page.

**Architecture:** Add `computeQualityScore()` and `getQualityScoreDimensions()` to `utils.ts`. Call them from `buildLaunch()` in `launches.ts` (needs a new `getBenchmark` import). Surface the per-dimension breakdown on the detail page right column.

**Tech Stack:** Next.js 16 App Router, TypeScript strict mode, Tailwind v4, no test framework — use `npx tsc --noEmit` as the verification step after each task.

---

## Background: Current vs. New Formula

**Current formula** (cohort-relative percentiles — category-blind):
```
launchQualityScore =
  dollarsPercentileVsCohort * 0.30 +
  velocityPercentileVsCohort * 0.25 +
  distributionPercentileVsCohort * 0.20 +
  baseMix * 100 * 0.15 +
  survivalScore * 100 * 0.10
```

**New formula** (category-indexed ratios):
```
velocityScore     = clamp(velocityLatest / bench.medianVelocity26w / 2, 0, 1) * 100  → weight 35%
distributionScore = clamp(tdpLatest / bench.medianTdp12w / 2, 0, 1) * 100            → weight 25%
growthScore       = clamp((growthRate12w - bench.growthRate + 0.20) / 0.40, 0, 1)*100 → weight 20%
                    (null growthRate → 50, neutral)
baseMixScore      = baseMix * 100                                                      → weight 15%
survivalScore     = 100 (survived52w) | 75 (survived26w) | 50 (survived12w/unknown) | 0 (failed)
                                                                                       → weight  5%
```

Scoring anchor: **50 = at-category-median**, **75 = meaningfully outperforming**, **100 = exceptional**.

---

## Task 1: Add `computeQualityScore` and `getQualityScoreDimensions` to `src/lib/utils.ts`

**Files:**
- Modify: `src/lib/utils.ts`

**Step 1: Add `CategoryBenchmark` to the existing import from `@/lib/types`**

Find line 3 in `src/lib/utils.ts`:
```typescript
import type { Launch, LaunchOutcome, VelocityTier } from "@/lib/types";
```
Replace with:
```typescript
import type { Launch, LaunchOutcome, VelocityTier, CategoryBenchmark } from "@/lib/types";
```

**Step 2: Add the helper types and functions at the bottom of `src/lib/utils.ts`**

Add after the existing `getGrowthContribution()` function (the last function in the file):

```typescript
// ── Quality Score (category-anchored) ─────────────────────────────────────

export interface QualityScoreDimension {
  label: string;
  value: string;       // formatted display value (e.g. "$24.1/store")
  benchmark: string;   // formatted benchmark (e.g. "median $31.2")
  score: number;       // 0–100, the sub-score for this dimension
  weight: number;      // 0–1 weight
  contribution: number; // score * weight (unrounded)
}

export interface QualityScoreBreakdown {
  total: number; // final rounded 0–100 score
  dimensions: QualityScoreDimension[];
}

/**
 * Compute the category-anchored launch quality score.
 * Can be called with raw buildLaunch() values or a full Launch object.
 */
export function computeQualityScoreBreakdown(
  params: {
    velocityLatest: number;
    tdpLatest: number;
    growthRate12w: number | null;
    baseMix: number;
    survived12w: boolean;
    survived26w: boolean | null;
    survived52w: boolean | null;
  },
  bench: CategoryBenchmark
): QualityScoreBreakdown {
  const velocityScore   = Math.min(params.velocityLatest / bench.medianVelocity26w / 2, 1) * 100;
  const distributionScore = Math.min(params.tdpLatest / bench.medianTdp12w / 2, 1) * 100;
  const growthScore     = params.growthRate12w == null
    ? 50
    : Math.min(Math.max((params.growthRate12w - bench.growthRate + 0.20) / 0.40, 0), 1) * 100;
  const baseMixScore    = params.baseMix * 100;
  const survivalScore   = params.survived52w === true  ? 100
    : params.survived52w === false ? 0
    : params.survived26w === true  ? 75
    : params.survived26w === false ? 0
    : 50; // too early to assess

  const dimensions: QualityScoreDimension[] = [
    {
      label: "Velocity",
      value: `$${params.velocityLatest.toFixed(1)}/store`,
      benchmark: `median $${bench.medianVelocity26w.toFixed(1)}`,
      score: Math.round(velocityScore),
      weight: 0.35,
      contribution: velocityScore * 0.35,
    },
    {
      label: "Distribution",
      value: `${Math.round(params.tdpLatest)} TDP`,
      benchmark: `median ${bench.medianTdp12w} TDP`,
      score: Math.round(distributionScore),
      weight: 0.25,
      contribution: distributionScore * 0.25,
    },
    {
      label: "Growth",
      value: params.growthRate12w == null ? "—" : `${(params.growthRate12w * 100).toFixed(1)}%`,
      benchmark: `category ${(bench.growthRate * 100).toFixed(0)}%`,
      score: Math.round(growthScore),
      weight: 0.20,
      contribution: growthScore * 0.20,
    },
    {
      label: "Base Mix",
      value: `${(params.baseMix * 100).toFixed(0)}% base`,
      benchmark: "100% ideal",
      score: Math.round(baseMixScore),
      weight: 0.15,
      contribution: baseMixScore * 0.15,
    },
    {
      label: "Survival",
      value: params.survived52w === true ? "52w ✓" : params.survived26w === true ? "26w ✓" : params.survived12w ? "12w ✓" : "—",
      benchmark: `${(bench.survivalRate26w * 100).toFixed(0)}% survive 26w`,
      score: survivalScore,
      weight: 0.05,
      contribution: survivalScore * 0.05,
    },
  ];

  const total = Math.round(dimensions.reduce((sum, d) => sum + d.contribution, 0));

  return { total, dimensions };
}

/** Convenience wrapper — returns only the final score. Used in buildLaunch(). */
export function computeQualityScore(
  params: Parameters<typeof computeQualityScoreBreakdown>[0],
  bench: CategoryBenchmark
): number {
  return computeQualityScoreBreakdown(params, bench).total;
}
```

**Step 3: Verify TypeScript compiles**

```bash
cd "C:\Users\David\projects\Innovation Suite\innovation-suite-demo"
npx tsc --noEmit
```
Expected: zero errors.

**Step 4: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat: add computeQualityScore (category-anchored formula) to utils"
```

---

## Task 2: Wire `computeQualityScore` into `buildLaunch()` in `src/data/launches.ts`

**Files:**
- Modify: `src/data/launches.ts`

**Step 1: Add two new imports at the top of `src/data/launches.ts`**

Find line 1–2 (the existing imports):
```typescript
import type { Launch, AttributeSet, Retailer, InnovationType, LaunchOutcome, VelocityTier } from "@/lib/types";
import { classifyInnovationType } from "@/lib/innovation";
```
Replace with:
```typescript
import type { Launch, AttributeSet, Retailer, InnovationType, LaunchOutcome, VelocityTier } from "@/lib/types";
import { classifyInnovationType } from "@/lib/innovation";
import { computeQualityScore } from "@/lib/utils";
import { getBenchmark } from "@/data/categories";
```

**Step 2: Replace the quality score block inside `buildLaunch()`**

Find lines 128–137 (the current quality score computation):
```typescript
  // Quality score (30% dollars pctile + 25% velocity pctile + 20% dist pctile + 15% base mix + 10% survival)
  const baseMix = 1 - spec.promoMix;
  const survivalScore = survived52w === true ? 1 : survived52w === false ? 0 : survived26w === true ? 0.6 : survived26w === false ? 0 : 0.3;
  const launchQualityScore = Math.round(
    dollarsPercentileVsCohort * 0.3 +
    velocityPercentileVsCohort * 0.25 +
    distributionPercentileVsCohort * 0.2 +
    baseMix * 100 * 0.15 +
    survivalScore * 100 * 0.1
  );
```
Replace with:
```typescript
  // Quality score — category-anchored ratios (see computeQualityScore in utils.ts)
  const baseMix = 1 - spec.promoMix;
  const bench = getBenchmark(spec.category);
  const launchQualityScore = computeQualityScore(
    {
      velocityLatest,
      tdpLatest,
      growthRate12w,
      baseMix,
      survived12w,
      survived26w,
      survived52w,
    },
    bench
  );
```

**Step 3: Verify TypeScript compiles**

```bash
cd "C:\Users\David\projects\Innovation Suite\innovation-suite-demo"
npx tsc --noEmit
```
Expected: zero errors.

**Step 4: Spot-check in browser**

Start dev server (`npm run dev`) and open Launch Explorer at `http://localhost:3000/launches`.
- Scores should now vary more noticeably between Frozen Meals (low category medians) and Supplements (high medians).
- A Frozen Meals launch with velocity ≈ 15 (at-median 15.1) should score ~50 on velocity dimension.
- No launch should show NaN or 0 for all launches.

**Step 5: Commit**

```bash
git add src/data/launches.ts
git commit -m "feat: wire category-anchored quality score into buildLaunch"
```

---

## Task 3: Add Score Breakdown panel to Launch detail page

**Files:**
- Modify: `src/app/launches/[id]/page.tsx`

**Step 1: Add `computeQualityScoreBreakdown` and `scoreHex` to the existing import from `@/lib/utils`**

Find the utils import block (lines 27–39):
```typescript
import {
  fmt$,
  fmtN,
  fmtPct,
  fmtGrowth,
  categoryColor,
  getDollarPerTdp,
  getCategoryTier,
  getPromoDepth,
  getGrowthContribution,
  OUTCOME_META,
  VELOCITY_TIER_META,
  cn,
} from "@/lib/utils";
```
Replace with:
```typescript
import {
  fmt$,
  fmtN,
  fmtPct,
  fmtGrowth,
  categoryColor,
  getDollarPerTdp,
  getCategoryTier,
  getPromoDepth,
  getGrowthContribution,
  OUTCOME_META,
  VELOCITY_TIER_META,
  cn,
  computeQualityScoreBreakdown,
  scoreHex,
} from "@/lib/utils";
```

**Step 2: Compute the breakdown object near the top of `LaunchDetailPage()`**

Find the line (after `const growthContrib = ...`):
```typescript
  const promoPrice = launch.baseMix > 0 && launch.promoDependency > 0
```
Insert before it:
```typescript
  const qsBreakdown = computeQualityScoreBreakdown(
    {
      velocityLatest: launch.velocityLatest,
      tdpLatest:      launch.tdpLatest,
      growthRate12w:  launch.growthRate12w,
      baseMix:        launch.baseMix,
      survived12w:    launch.survived12w,
      survived26w:    launch.survived26w,
      survived52w:    launch.survived52w,
    },
    bench
  );

```

**Step 3: Add the Score Breakdown panel in the RIGHT COLUMN**

Find the comment `{/* 2. Milestones */}` in the right column and insert the Score Breakdown panel **before** it (between Key Metrics and Milestones):

```tsx
            {/* 2. Score Breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700">Quality Score Breakdown</h2>
                <span
                  className="text-lg font-bold"
                  style={{ color: scoreHex(launch.launchQualityScore) }}
                >
                  {launch.launchQualityScore}
                </span>
              </div>
              <p className="text-[9px] text-slate-400 mb-3 leading-snug">
                50 = category median · 75 = outperforming · 100 = exceptional
              </p>
              <div className="space-y-2">
                {qsBreakdown.dimensions.map((d) => (
                  <div key={d.label} className="flex items-center gap-2">
                    {/* Label + values */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] font-medium text-slate-600">{d.label}</span>
                        <span className="text-[9px] text-slate-400 truncate ml-1">{d.value}</span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-slate-100 rounded-full mt-0.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${d.score}%`,
                            backgroundColor: scoreHex(d.score),
                          }}
                        />
                      </div>
                    </div>
                    {/* Sub-score + weight */}
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-bold" style={{ color: scoreHex(d.score) }}>
                        {d.score}
                      </div>
                      <div className="text-[8px] text-slate-300">{Math.round(d.weight * 100)}%</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[9px] text-slate-400 leading-relaxed">
                Velocity 35% · Distribution 25% · Growth 20% · Base Mix 15% · Survival 5%
              </div>
            </div>

```

**Step 4: Verify TypeScript compiles**

```bash
cd "C:\Users\David\projects\Innovation Suite\innovation-suite-demo"
npx tsc --noEmit
```
Expected: zero errors.

**Step 5: Visual check in browser**

Open any launch detail page (e.g. `http://localhost:3000/launches/012345000001`).
- Right column should show a new "Quality Score Breakdown" card between Key Metrics and Milestones.
- Five rows: Velocity, Distribution, Growth, Base Mix, Survival.
- Each row shows a progress bar colored green/blue/amber/red matching the sub-score.
- Footer shows the weight breakdown.
- Open a Frozen Meals launch and a Supplements launch — verify scores differ meaningfully.

**Step 6: Commit**

```bash
git add src/app/launches/\[id\]/page.tsx
git commit -m "feat: add quality score breakdown panel to launch detail page"
```

---

## Task 4: Full build verification

**Step 1: Run TypeScript check**

```bash
cd "C:\Users\David\projects\Innovation Suite\innovation-suite-demo"
npx tsc --noEmit
```
Expected: zero errors.

**Step 2: Run production build**

```bash
npm run build
```
Expected: all 12 routes build successfully, zero errors, zero warnings about missing exports.

**Step 3: Manual spot checks**

1. Launch Explorer (`/launches`) — QS scores are spread across the 0–100 range, not clustered at one end
2. Click a Bars launch → Score Breakdown card visible in right column
3. Click a Frozen Meals launch → velocity dimension shows a lower score relative to a Supplements launch at the same absolute velocity (category-anchored behavior confirmed)
4. Growth dimension shows "—" for launches < 12 weeks old (null `growthRate12w`) → score = 50 (neutral)
5. Survival row: a survived52w launch shows "52w ✓" and score = 100

**Step 4: Commit summary**

All changes are already committed task-by-task. No additional commit needed.

---

## Key File Summary

| File | Change |
|------|--------|
| `src/lib/utils.ts` | Add `QualityScoreDimension`, `QualityScoreBreakdown` interfaces; add `computeQualityScoreBreakdown()` and `computeQualityScore()` |
| `src/data/launches.ts` | Import `computeQualityScore` + `getBenchmark`; replace old 10-line quality score block with 8-line category-anchored version |
| `src/app/launches/[id]/page.tsx` | Import `computeQualityScoreBreakdown` + `scoreHex`; compute `qsBreakdown`; add Score Breakdown panel in right column |
