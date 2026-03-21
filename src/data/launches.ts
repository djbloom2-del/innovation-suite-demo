import type { Launch, AttributeSet, Retailer, InnovationType, LaunchOutcome, VelocityTier, RetailChannel } from "@/lib/types";
import { classifyInnovationType } from "@/lib/innovation";
import { computeQualityScore } from "@/lib/utils";
import { getBenchmark } from "@/data/categories";
import { computeNeedState, launchToNeedStateInput } from "@/data/needStates";

type RawLaunch = Omit<Launch, "innovationType" | "velocityTier" | "needState" | "needStateSecondary">;

// Snapshot date used for all relative-date calculations (launch age, cohort months, etc.)
export const DATA_SNAPSHOT_DATE = "2026-03-08";

// Deterministic seeded RNG
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function daysAgo(n: number): string {
  const d = new Date(DATA_SNAPSHOT_DATE);
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function firstOfMonth(dateStr: string): string {
  return dateStr.slice(0, 7) + "-01";
}

function cohortMonth(launchDate: string): string {
  return firstOfMonth(launchDate);
}

function ageWeeksFrom(launchDate: string): number {
  const launch = new Date(launchDate);
  const now = new Date(DATA_SNAPSHOT_DATE);
  return Math.floor((now.getTime() - launch.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

interface LaunchSpec {
  upc: string;
  description: string;
  brand: string;
  company: string;
  category: Launch["category"];
  subcategory: string;
  daysAgoLaunched: number;
  patternType: Launch["patternType"];
  baseVelocity: number; // $ per store selling at launch
  launchTdp: number;
  priceLatest: number;
  promoMix: number; // 0-1
  attributes: AttributeSet;
}

function assignChannel(category: Launch["category"], rand: number): RetailChannel {
  if (category === "Supplements") return rand < 0.60 ? "Natural" : rand < 0.85 ? "Both" : "MULO";
  if (category === "Beverages")   return rand < 0.35 ? "Natural" : rand < 0.65 ? "Both" : "MULO";
  if (category === "Bars")        return rand < 0.30 ? "Natural" : rand < 0.65 ? "Both" : "MULO";
  if (category === "Snacks")      return rand < 0.15 ? "Natural" : rand < 0.45 ? "Both" : "MULO";
  // Frozen Meals
  return rand < 0.10 ? "Natural" : rand < 0.35 ? "Both" : "MULO";
}

function classifyOutcome(
  age: number,
  dollarsY1: number | null,
  dollarsY2: number | null,
  dollarsY3: number | null,
  velocityY1: number | null,
  velocityY2: number | null,
): LaunchOutcome {
  if (age < 52) return "Early Stage";
  if (age < 104 || dollarsY2 === null) return "Year 1";
  // Y3 verdict supersedes Y2
  if (age >= 156 && dollarsY3 !== null && dollarsY2 !== null) {
    return dollarsY3 > dollarsY2 ? "Sustaining" : "Declining";
  }
  // Y2 verdict
  const sizeGrew     = dollarsY1 !== null && dollarsY2 > dollarsY1;
  const velocityGrew = velocityY1 !== null && velocityY2 !== null && velocityY2 > velocityY1;
  return (sizeGrew || velocityGrew) ? "Successful" : "Fading";
}

function buildLaunch(spec: LaunchSpec, peers: Launch[] = []): RawLaunch {
  const r = rng(parseInt(spec.upc.slice(-4)));
  const launchDate = daysAgo(spec.daysAgoLaunched);
  const age = ageWeeksFrom(launchDate);

  // Pattern-based growth multipliers
  const patterns: Record<Launch["patternType"], { velocityGrowth: number; tdpGrowth: number; survivalAdj: number }> = {
    winner: { velocityGrowth: 1.35, tdpGrowth: 1.8, survivalAdj: 0.92 },
    steady: { velocityGrowth: 1.08, tdpGrowth: 1.3, survivalAdj: 0.75 },
    fader: { velocityGrowth: 0.78, tdpGrowth: 0.9, survivalAdj: 0.38 },
    sleeper: { velocityGrowth: 1.22, tdpGrowth: 1.5, survivalAdj: 0.82 },
  };
  const pat = patterns[spec.patternType];
  const jitter = 0.85 + r() * 0.3;

  const velocityLatest = spec.baseVelocity * pat.velocityGrowth * jitter;
  const tdpLatest = spec.launchTdp * pat.tdpGrowth * jitter;
  const storesSellingLatest = Math.round(tdpLatest / (1 + r() * 0.4));
  const dollarsLatest = (velocityLatest * storesSellingLatest * 4) / 52;

  // Milestones
  const dollars4w = spec.baseVelocity * spec.launchTdp * 0.4 * (0.9 + r() * 0.2);
  const dollars12w = dollars4w * 2.8 * (0.9 + r() * 0.2) * (spec.patternType === "fader" ? 0.7 : 1);
  const dollars26w = age >= 26
    ? dollars12w * 2.1 * (0.85 + r() * 0.3) * (spec.patternType === "fader" ? 0.5 : 1)
    : null;
  const dollars52w = age >= 52
    ? (dollars26w ?? dollars12w * 2) * 1.9 * (0.8 + r() * 0.4) * (spec.patternType === "fader" ? 0.4 : 1)
    : null;

  const distributionGainSinceLaunch = (tdpLatest - spec.launchTdp) * (0.85 + r() * 0.3);
  const growthRate12w = spec.patternType === "fader"
    ? -(0.05 + r() * 0.25)
    : 0.05 + r() * (spec.patternType === "winner" ? 0.55 : 0.25);
  const growthRateYago = age >= 52 ? growthRate12w * (0.7 + r() * 0.6) : null;

  const survived12w = age >= 12 ? pat.survivalAdj > r() * 0.8 : false;
  const survived26w = age >= 26 ? pat.survivalAdj * 0.85 > r() * 0.9 : null;
  const survived52w = age >= 52 ? pat.survivalAdj * 0.7 > r() : null;

  // Percentiles vs cohort — used for display in Launch Detail and Alert Feed only
  // (no longer feed launchQualityScore; see computeQualityScore in utils.ts for the current formula)
  const velocityPercentileVsCohort = Math.min(
    100,
    Math.round((spec.patternType === "winner" ? 65 : spec.patternType === "fader" ? 25 : 48) + r() * 30)
  );
  const dollarsPercentileVsCohort = Math.min(
    100,
    Math.round(velocityPercentileVsCohort * (0.9 + r() * 0.2))
  );
  const distributionPercentileVsCohort = Math.min(
    100,
    Math.round((spec.patternType === "winner" ? 60 : 42) + r() * 30)
  );

  // Channel — separate seed, computed before quality score so it can be passed in
  const rChannel = rng(parseInt(spec.upc.slice(-4)) + 88771);
  const channel = assignChannel(spec.category, rChannel());

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
      channel,
    },
    bench
  );

  // basePrice: separate RNG so existing r() call sequence is completely untouched
  const r2 = rng(parseInt(spec.upc.slice(-4)) + 7777);
  const basePrice = spec.priceLatest * (1 + Math.max(0, spec.promoMix) * (0.12 + r2() * 0.18));

  // Retailer channel — separate seed so existing RNG sequence is unaffected
  const rRetailer = rng(parseInt(spec.upc.slice(-4)) * 31337);
  const rv = rRetailer();
  const retailerThresholds: Record<string, [number, number, number]> = {
    Bars: [0.5, 0.8, 0.9],
    Beverages: [0.3, 0.7, 0.8],
    Snacks: [0.2, 0.6, 0.7],
    Supplements: [0.6, 0.85, 0.9],
    "Frozen Meals": [0.1, 0.6, 0.7],
  };
  const [t1, t2, t3] = retailerThresholds[spec.category] ?? [0.4, 0.75, 0.9];
  const retailer = (rv < t1 ? "Natural" : rv < t2 ? "Conventional" : rv < t3 ? "Club" : "Mass") as Retailer;

  // ── Year-over-Year lifecycle (separate seeds — no collision with existing RNGs) ──
  const rY2 = rng(parseInt(spec.upc.slice(-4)) + 19991);
  const rY3 = rng(parseInt(spec.upc.slice(-4)) + 44433);

  const dollarsY1 = dollars52w; // Y1 = full first year (already computed)

  const y2Mult: Record<string, () => number> = {
    winner:  () => 1.18 + rY2() * 0.35,  // +18% to +53%
    steady:  () => 0.93 + rY2() * 0.14,  // -7% to +7%
    fader:   () => 0.48 + rY2() * 0.22,  // -52% to -30%
    sleeper: () => 1.35 + rY2() * 0.40,  // +35% to +75%
  };
  const dollarsY2 = age >= 104 && dollarsY1 !== null
    ? dollarsY1 * y2Mult[spec.patternType]()
    : null;

  const y3Mult: Record<string, () => number> = {
    winner:  () => 1.09 + rY3() * 0.18,  // +9% to +27%
    steady:  () => 0.91 + rY3() * 0.13,  // -9% to +4%
    fader:   () => 0.42 + rY3() * 0.18,  // -58% to -40%
    sleeper: () => 1.14 + rY3() * 0.22,  // +14% to +36%
  };
  const dollarsY3 = age >= 156 && dollarsY2 !== null
    ? dollarsY2 * y3Mult[spec.patternType]()
    : null;

  // Velocity proxy: annual dollars ÷ (stores × 52 weeks)
  const velocityY1 = dollarsY1 !== null && storesSellingLatest > 0
    ? dollarsY1 / (storesSellingLatest * 52)
    : null;
  const velocityY2 = dollarsY2 !== null && storesSellingLatest > 0
    ? dollarsY2 / (storesSellingLatest * 52)
    : null;
  const velocityY3 = dollarsY3 !== null && storesSellingLatest > 0
    ? dollarsY3 / (storesSellingLatest * 52)
    : null;

  const growthY1toY2 = dollarsY1 && dollarsY2 && dollarsY1 > 0
    ? (dollarsY2 - dollarsY1) / dollarsY1
    : null;
  const growthY2toY3 = dollarsY2 && dollarsY3 && dollarsY2 > 0
    ? (dollarsY3 - dollarsY2) / dollarsY2
    : null;

  const launchOutcome = classifyOutcome(age, dollarsY1, dollarsY2, dollarsY3, velocityY1, velocityY2);

  return {
    upc: spec.upc,
    description: spec.description,
    brand: spec.brand,
    company: spec.company,
    category: spec.category,
    subcategory: spec.subcategory,
    retailer,
    firstSeenDate: launchDate,
    launchCohortMonth: cohortMonth(launchDate),
    ageWeeks: age,
    patternType: spec.patternType,
    dollarsLatest,
    velocityLatest,
    tdpLatest,
    storesSellingLatest,
    priceLatest: spec.priceLatest,
    basePrice,
    promoDependency: spec.promoMix * (0.85 + r() * 0.3),
    baseMix,
    priceIndexVsCategory: 0.88 + r() * 0.35,
    dollarShareCategory: (dollarsLatest / 1_000_000) * 0.004,
    growthRate12w,
    growthRateYago,
    dollars4w,
    dollars12w,
    dollars26w,
    dollars52w,
    distributionGainSinceLaunch,
    survived12w,
    survived26w,
    survived52w,
    velocityPercentileVsCohort,
    dollarsPercentileVsCohort,
    distributionPercentileVsCohort,
    launchQualityScore,
    dollarsY1,
    dollarsY2,
    dollarsY3,
    velocityY1,
    velocityY2,
    velocityY3,
    growthY1toY2,
    growthY2toY3,
    launchOutcome,
    attributes: spec.attributes,
    channel,
  };
}

const SPECS: LaunchSpec[] = [
  // ─── BARS ──────────────────────────────────────────────────────────────────
  { upc: "012345000001", description: "PeakBar Protein Crunch – Chocolate PB", brand: "PeakBar", company: "Peak Performance Brands", category: "Bars", subcategory: "Protein Bars", daysAgoLaunched: 420, patternType: "winner", baseVelocity: 34, launchTdp: 680, priceLatest: 2.99, promoMix: 0.12, attributes: { form: "Bar", flavor: "Chocolate Peanut Butter", packFormat: "Single", brandPositioning: "Performance", functionalIngredient: "Whey Protein", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Muscle Recovery", eatingOccasion: "Post-Workout" } },
  { upc: "012345000002", description: "PeakBar Protein Crunch – Vanilla Almond", brand: "PeakBar", company: "Peak Performance Brands", category: "Bars", subcategory: "Protein Bars", daysAgoLaunched: 280, patternType: "winner", baseVelocity: 31, launchTdp: 590, priceLatest: 2.99, promoMix: 0.10, attributes: { form: "Bar", flavor: "Vanilla Almond", packFormat: "Multipack", brandPositioning: "Performance", functionalIngredient: "Whey Protein", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Muscle Recovery", eatingOccasion: "Post-Workout" } },
  { upc: "012345000003", description: "Elevate Protein Bar – Dark Chocolate", brand: "Elevate", company: "Elevate Natural Foods", category: "Bars", subcategory: "Protein Bars", daysAgoLaunched: 350, patternType: "steady", baseVelocity: 22, launchTdp: 440, priceLatest: 3.29, promoMix: 0.18, attributes: { form: "Bar", flavor: "Dark Chocolate", packFormat: "Single", brandPositioning: "Clean Label", functionalIngredient: "Plant Protein", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: true, healthFocus: "General Wellness", eatingOccasion: "Snacking" } },
  { upc: "012345000004", description: "WildRoots Grain-Free Bar – Cashew + Honey", brand: "WildRoots", company: "WildRoots Co.", category: "Bars", subcategory: "Snack Bars", daysAgoLaunched: 190, patternType: "steady", baseVelocity: 18, launchTdp: 320, priceLatest: 3.79, promoMix: 0.15, attributes: { form: "Bar", flavor: "Cashew Honey", packFormat: "Single", brandPositioning: "Natural", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Clean Eating", eatingOccasion: "Snacking" } },
  { upc: "012345000005", description: "PlantPower Energy Bar – Mixed Berry", brand: "PlantPower", company: "Elevate Natural Foods", category: "Bars", subcategory: "Energy Bars", daysAgoLaunched: 770, patternType: "winner", baseVelocity: 29, launchTdp: 720, priceLatest: 3.49, promoMix: 0.14, attributes: { form: "Bar", flavor: "Mixed Berry", packFormat: "Single", brandPositioning: "Plant-Based", functionalIngredient: "Adaptogens", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: true, healthFocus: "Energy", eatingOccasion: "Pre-Workout" } },
  { upc: "012345000006", description: "Keto Fuel Bar – Chocolate Fudge", brand: "Keto Fuel", company: "Peak Performance Brands", category: "Bars", subcategory: "Keto Bars", daysAgoLaunched: 140, patternType: "sleeper", baseVelocity: 16, launchTdp: 280, priceLatest: 3.99, promoMix: 0.20, attributes: { form: "Bar", flavor: "Chocolate Fudge", packFormat: "Single", brandPositioning: "Keto", functionalIngredient: "MCT Oil", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "Weight Management", eatingOccasion: "Snacking" } },
  { upc: "012345000007", description: "CleanStart Snack Bar – Coconut Lime", brand: "CleanStart", company: "WildRoots Co.", category: "Bars", subcategory: "Snack Bars", daysAgoLaunched: 60, patternType: "steady", baseVelocity: 14, launchTdp: 210, priceLatest: 2.79, promoMix: 0.22, attributes: { form: "Bar", flavor: "Coconut Lime", packFormat: "Single", brandPositioning: "Clean Label", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Clean Eating", eatingOccasion: "Snacking" } },
  { upc: "012345000008", description: "ProGrid Performance Bar – Mint Choc Chip", brand: "ProGrid", company: "Peak Performance Brands", category: "Bars", subcategory: "Protein Bars", daysAgoLaunched: 320, patternType: "fader", baseVelocity: 12, launchTdp: 380, priceLatest: 3.29, promoMix: 0.30, attributes: { form: "Bar", flavor: "Mint Chocolate Chip", packFormat: "Single", brandPositioning: "Performance", functionalIngredient: "Whey Protein", isOrganic: false, isNonGmo: false, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Muscle Recovery", eatingOccasion: "Post-Workout" } },
  { upc: "012345000009", description: "SunBurst Fruit & Nut Bar – Apricot Pistachio", brand: "SunBurst", company: "Elevate Natural Foods", category: "Bars", subcategory: "Snack Bars", daysAgoLaunched: 245, patternType: "steady", baseVelocity: 17, launchTdp: 360, priceLatest: 3.59, promoMix: 0.16, attributes: { form: "Bar", flavor: "Apricot Pistachio", packFormat: "Single", brandPositioning: "Artisan", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: false, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "General Wellness", eatingOccasion: "Snacking" } },
  { upc: "012345000010", description: "FitCore Protein Bar – Salted Caramel", brand: "FitCore", company: "Peak Performance Brands", category: "Bars", subcategory: "Protein Bars", daysAgoLaunched: 760, patternType: "winner", baseVelocity: 38, launchTdp: 780, priceLatest: 2.89, promoMix: 0.11, attributes: { form: "Bar", flavor: "Salted Caramel", packFormat: "Single", brandPositioning: "Performance", functionalIngredient: "Whey Protein", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Muscle Recovery", eatingOccasion: "Post-Workout" } },
  { upc: "012345000011", description: "VerdeLite Bar – Matcha + White Chocolate", brand: "VerdeLite", company: "Elevate Natural Foods", category: "Bars", subcategory: "Snack Bars", daysAgoLaunched: 90, patternType: "sleeper", baseVelocity: 11, launchTdp: 190, priceLatest: 4.19, promoMix: 0.18, attributes: { form: "Bar", flavor: "Matcha White Chocolate", packFormat: "Single", brandPositioning: "Functional", functionalIngredient: "Matcha", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Focus & Calm", eatingOccasion: "Morning" } },
  { upc: "012345000012", description: "NourishMe Bar – Apple Cinnamon", brand: "NourishMe", company: "WildRoots Co.", category: "Bars", subcategory: "Snack Bars", daysAgoLaunched: 380, patternType: "fader", baseVelocity: 9, launchTdp: 290, priceLatest: 2.99, promoMix: 0.35, attributes: { form: "Bar", flavor: "Apple Cinnamon", packFormat: "Single", brandPositioning: "Natural", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: false, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: null, eatingOccasion: "Snacking" } },
  { upc: "012345000013", description: "IronWill Protein Bar – Birthday Cake", brand: "IronWill", company: "Peak Performance Brands", category: "Bars", subcategory: "Protein Bars", daysAgoLaunched: 155, patternType: "steady", baseVelocity: 20, launchTdp: 390, priceLatest: 3.19, promoMix: 0.19, attributes: { form: "Bar", flavor: "Birthday Cake", packFormat: "Single", brandPositioning: "Performance", functionalIngredient: "Whey Protein", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Muscle Recovery", eatingOccasion: "Post-Workout" } },
  { upc: "012345000014", description: "TrueGrit Endurance Bar – Peanut Butter", brand: "TrueGrit", company: "Peak Performance Brands", category: "Bars", subcategory: "Energy Bars", daysAgoLaunched: 1098, patternType: "winner", baseVelocity: 26, launchTdp: 650, priceLatest: 3.79, promoMix: 0.13, attributes: { form: "Bar", flavor: "Peanut Butter", packFormat: "Single", brandPositioning: "Endurance", functionalIngredient: "BCAAs", isOrganic: false, isNonGmo: true, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Endurance", eatingOccasion: "Pre-Workout" } },
  { upc: "012345000015", description: "Harvest Gold Grain Bar – Oat & Honey", brand: "Harvest Gold", company: "WildRoots Co.", category: "Bars", subcategory: "Snack Bars", daysAgoLaunched: 735, patternType: "fader", baseVelocity: 8, launchTdp: 240, priceLatest: 1.99, promoMix: 0.40, attributes: { form: "Bar", flavor: "Oat Honey", packFormat: "Single", brandPositioning: "Value", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: null, eatingOccasion: "Snacking" } },
  { upc: "012345000016", description: "ZenFuel Adaptogen Bar – Ashwagandha Cacao", brand: "ZenFuel", company: "Clarity Wellness", category: "Bars", subcategory: "Functional Bars", daysAgoLaunched: 75, patternType: "sleeper", baseVelocity: 13, launchTdp: 170, priceLatest: 4.99, promoMix: 0.12, attributes: { form: "Bar", flavor: "Cacao", packFormat: "Single", brandPositioning: "Functional", functionalIngredient: "Ashwagandha", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Stress Relief", eatingOccasion: "Snacking" } },

  // ─── BEVERAGES ─────────────────────────────────────────────────────────────
  { upc: "023456000001", description: "Clarity Energy – Blood Orange", brand: "Clarity Energy", company: "Clarity Wellness", category: "Beverages", subcategory: "Energy Drinks", daysAgoLaunched: 390, patternType: "winner", baseVelocity: 42, launchTdp: 920, priceLatest: 3.49, promoMix: 0.09, attributes: { form: "Ready-to-Drink", flavor: "Blood Orange", packFormat: "Single", brandPositioning: "Clean Energy", functionalIngredient: "Caffeine + L-Theanine", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Morning" } },
  { upc: "023456000002", description: "Clarity Energy – Cucumber Mint", brand: "Clarity Energy", company: "Clarity Wellness", category: "Beverages", subcategory: "Energy Drinks", daysAgoLaunched: 260, patternType: "winner", baseVelocity: 38, launchTdp: 840, priceLatest: 3.49, promoMix: 0.10, attributes: { form: "Ready-to-Drink", flavor: "Cucumber Mint", packFormat: "Single", brandPositioning: "Clean Energy", functionalIngredient: "Caffeine + L-Theanine", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Afternoon" } },
  { upc: "023456000003", description: "VoltPure RTD Coffee – Oat Milk Latte", brand: "VoltPure", company: "Clarity Wellness", category: "Beverages", subcategory: "RTD Coffee", daysAgoLaunched: 750, patternType: "winner", baseVelocity: 35, launchTdp: 760, priceLatest: 4.99, promoMix: 0.12, attributes: { form: "Ready-to-Drink", flavor: "Caramel Oat Latte", packFormat: "Single", brandPositioning: "Premium", functionalIngredient: "Cold Brew Coffee", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Morning" } },
  { upc: "023456000004", description: "VoltPure RTD Coffee – Black Bold", brand: "VoltPure", company: "Clarity Wellness", category: "Beverages", subcategory: "RTD Coffee", daysAgoLaunched: 310, patternType: "steady", baseVelocity: 28, launchTdp: 620, priceLatest: 4.49, promoMix: 0.14, attributes: { form: "Ready-to-Drink", flavor: "Black", packFormat: "Single", brandPositioning: "Premium", functionalIngredient: "Cold Brew Coffee", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Morning" } },
  { upc: "023456000005", description: "AquaZen Functional Water – Magnesium + Citrus", brand: "AquaZen", company: "Clarity Wellness", category: "Beverages", subcategory: "Functional Water", daysAgoLaunched: 200, patternType: "sleeper", baseVelocity: 19, launchTdp: 480, priceLatest: 2.99, promoMix: 0.16, attributes: { form: "Ready-to-Drink", flavor: "Citrus", packFormat: "Multipack", brandPositioning: "Functional Hydration", functionalIngredient: "Magnesium", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Hydration", eatingOccasion: "Workout" } },
  { upc: "023456000006", description: "AquaZen Functional Water – Elderberry + Zinc", brand: "AquaZen", company: "Clarity Wellness", category: "Beverages", subcategory: "Functional Water", daysAgoLaunched: 130, patternType: "steady", baseVelocity: 16, launchTdp: 390, priceLatest: 2.99, promoMix: 0.17, attributes: { form: "Ready-to-Drink", flavor: "Elderberry", packFormat: "Single", brandPositioning: "Immune Support", functionalIngredient: "Elderberry + Zinc", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Immune Support", eatingOccasion: "Morning" } },
  { upc: "023456000007", description: "PureLift Energy Drink – Watermelon", brand: "PureLift", company: "Peak Performance Brands", category: "Beverages", subcategory: "Energy Drinks", daysAgoLaunched: 170, patternType: "fader", baseVelocity: 14, launchTdp: 520, priceLatest: 2.49, promoMix: 0.32, attributes: { form: "Ready-to-Drink", flavor: "Watermelon", packFormat: "Single", brandPositioning: "Performance", functionalIngredient: "Caffeine", isOrganic: false, isNonGmo: false, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Pre-Workout" } },
  { upc: "023456000008", description: "RootRevive Adaptogen Drink – Ginger Turmeric", brand: "RootRevive", company: "Elevate Natural Foods", category: "Beverages", subcategory: "Functional Beverages", daysAgoLaunched: 95, patternType: "sleeper", baseVelocity: 22, launchTdp: 290, priceLatest: 4.29, promoMix: 0.11, attributes: { form: "Ready-to-Drink", flavor: "Ginger Turmeric", packFormat: "Single", brandPositioning: "Functional", functionalIngredient: "Ashwagandha + Turmeric", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Anti-Inflammatory", eatingOccasion: "Morning" } },
  { upc: "023456000009", description: "MindFuel Nootropic Drink – Berry Focus", brand: "MindFuel", company: "Clarity Wellness", category: "Beverages", subcategory: "Functional Beverages", daysAgoLaunched: 220, patternType: "winner", baseVelocity: 31, launchTdp: 680, priceLatest: 4.49, promoMix: 0.08, attributes: { form: "Ready-to-Drink", flavor: "Mixed Berry", packFormat: "Single", brandPositioning: "Nootropic", functionalIngredient: "Lion's Mane + Caffeine", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Focus & Cognition", eatingOccasion: "Morning" } },
  { upc: "023456000010", description: "HydraElite Sports Water – Lemon Electrolyte", brand: "HydraElite", company: "Peak Performance Brands", category: "Beverages", subcategory: "Sports Hydration", daysAgoLaunched: 360, patternType: "steady", baseVelocity: 24, launchTdp: 720, priceLatest: 2.79, promoMix: 0.20, attributes: { form: "Ready-to-Drink", flavor: "Lemon", packFormat: "Single", brandPositioning: "Performance", functionalIngredient: "Electrolytes", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Hydration", eatingOccasion: "Workout" } },
  { upc: "023456000011", description: "BrewCraft Cold Brew – Caramel Macchiato", brand: "BrewCraft", company: "WildRoots Co.", category: "Beverages", subcategory: "RTD Coffee", daysAgoLaunched: 1095, patternType: "winner", baseVelocity: 33, launchTdp: 810, priceLatest: 4.99, promoMix: 0.11, attributes: { form: "Ready-to-Drink", flavor: "Caramel Macchiato", packFormat: "Single", brandPositioning: "Artisan", functionalIngredient: "Cold Brew Coffee", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Morning" } },
  { upc: "023456000012", description: "FloraFizz Probiotic Soda – Cherry Hibiscus", brand: "FloraFizz", company: "Elevate Natural Foods", category: "Beverages", subcategory: "Probiotic Beverages", daysAgoLaunched: 115, patternType: "sleeper", baseVelocity: 18, launchTdp: 340, priceLatest: 3.79, promoMix: 0.13, attributes: { form: "Ready-to-Drink", flavor: "Cherry Hibiscus", packFormat: "Single", brandPositioning: "Gut Health", functionalIngredient: "Probiotics", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Gut Health", eatingOccasion: "Mealtime" } },
  { upc: "023456000013", description: "NightCalm Relaxation Drink – Lavender Chamomile", brand: "NightCalm", company: "Clarity Wellness", category: "Beverages", subcategory: "Functional Beverages", daysAgoLaunched: 80, patternType: "steady", baseVelocity: 15, launchTdp: 260, priceLatest: 3.99, promoMix: 0.14, attributes: { form: "Ready-to-Drink", flavor: "Lavender Chamomile", packFormat: "Single", brandPositioning: "Relaxation", functionalIngredient: "Melatonin + L-Theanine", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Sleep", eatingOccasion: "Evening" } },
  { upc: "023456000014", description: "ZestShot Energy Shot – Tropical", brand: "ZestShot", company: "Peak Performance Brands", category: "Beverages", subcategory: "Energy Shots", daysAgoLaunched: 300, patternType: "fader", baseVelocity: 11, launchTdp: 580, priceLatest: 2.99, promoMix: 0.28, attributes: { form: "Shot", flavor: "Tropical", packFormat: "Single", brandPositioning: "Performance", functionalIngredient: "Caffeine + B12", isOrganic: false, isNonGmo: false, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Afternoon" } },
  { upc: "023456000015", description: "SunDrop Vitamin C Water – Orange", brand: "SunDrop", company: "WildRoots Co.", category: "Beverages", subcategory: "Functional Water", daysAgoLaunched: 420, patternType: "fader", baseVelocity: 10, launchTdp: 420, priceLatest: 1.99, promoMix: 0.38, attributes: { form: "Ready-to-Drink", flavor: "Orange", packFormat: "Single", brandPositioning: "Value", functionalIngredient: "Vitamin C", isOrganic: false, isNonGmo: false, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Immune Support", eatingOccasion: "Morning" } },
  { upc: "023456000016", description: "Equilibrium Balance Drink – Peach Ashwagandha", brand: "Equilibrium", company: "Elevate Natural Foods", category: "Beverages", subcategory: "Functional Beverages", daysAgoLaunched: 55, patternType: "sleeper", baseVelocity: 20, launchTdp: 210, priceLatest: 4.79, promoMix: 0.09, attributes: { form: "Ready-to-Drink", flavor: "Peach", packFormat: "Single", brandPositioning: "Functional", functionalIngredient: "Ashwagandha", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Stress Relief", eatingOccasion: "Afternoon" } },

  // ─── SNACKS ────────────────────────────────────────────────────────────────
  { upc: "034567000001", description: "CrispLite Cauliflower Puffs – White Cheddar", brand: "CrispLite", company: "Elevate Natural Foods", category: "Snacks", subcategory: "Veggie Snacks", daysAgoLaunched: 360, patternType: "winner", baseVelocity: 28, launchTdp: 640, priceLatest: 4.99, promoMix: 0.11, attributes: { form: "Puffs", flavor: "White Cheddar", packFormat: "Single", brandPositioning: "Better-for-You", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Clean Snacking", eatingOccasion: "Snacking" } },
  { upc: "034567000002", description: "CrispLite Cauliflower Puffs – Ranch", brand: "CrispLite", company: "Elevate Natural Foods", category: "Snacks", subcategory: "Veggie Snacks", daysAgoLaunched: 240, patternType: "winner", baseVelocity: 25, launchTdp: 570, priceLatest: 4.99, promoMix: 0.12, attributes: { form: "Puffs", flavor: "Ranch", packFormat: "Single", brandPositioning: "Better-for-You", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Clean Snacking", eatingOccasion: "Snacking" } },
  { upc: "034567000003", description: "PureChip Avocado Chips – Sea Salt", brand: "PureChip", company: "WildRoots Co.", category: "Snacks", subcategory: "Chips", daysAgoLaunched: 290, patternType: "steady", baseVelocity: 19, launchTdp: 410, priceLatest: 5.49, promoMix: 0.15, attributes: { form: "Chips", flavor: "Sea Salt", packFormat: "Single", brandPositioning: "Premium", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Clean Snacking", eatingOccasion: "Snacking" } },
  { upc: "034567000004", description: "PureChip Avocado Chips – Jalapeño", brand: "PureChip", company: "WildRoots Co.", category: "Snacks", subcategory: "Chips", daysAgoLaunched: 175, patternType: "sleeper", baseVelocity: 15, launchTdp: 320, priceLatest: 5.49, promoMix: 0.14, attributes: { form: "Chips", flavor: "Jalapeño", packFormat: "Single", brandPositioning: "Premium", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Clean Snacking", eatingOccasion: "Snacking" } },
  { upc: "034567000005", description: "NourishCrunch Quinoa Crisps – BBQ", brand: "NourishCrunch", company: "Elevate Natural Foods", category: "Snacks", subcategory: "Grain Snacks", daysAgoLaunched: 755, patternType: "winner", baseVelocity: 22, launchTdp: 550, priceLatest: 4.79, promoMix: 0.13, attributes: { form: "Crisps", flavor: "BBQ", packFormat: "Single", brandPositioning: "Better-for-You", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: true, healthFocus: "Plant-Based Protein", eatingOccasion: "Snacking" } },
  { upc: "034567000006", description: "SeaHarvest Seaweed Snacks – Sesame", brand: "SeaHarvest", company: "WildRoots Co.", category: "Snacks", subcategory: "Seaweed Snacks", daysAgoLaunched: 330, patternType: "steady", baseVelocity: 17, launchTdp: 380, priceLatest: 3.99, promoMix: 0.16, attributes: { form: "Sheets", flavor: "Sesame", packFormat: "Single", brandPositioning: "Natural", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Minerals", eatingOccasion: "Snacking" } },
  { upc: "034567000007", description: "BeanBurst Roasted Chickpeas – Smoky Paprika", brand: "BeanBurst", company: "Elevate Natural Foods", category: "Snacks", subcategory: "Legume Snacks", daysAgoLaunched: 400, patternType: "winner", baseVelocity: 24, launchTdp: 580, priceLatest: 4.49, promoMix: 0.10, attributes: { form: "Crunchy", flavor: "Smoky Paprika", packFormat: "Single", brandPositioning: "Plant Protein", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: true, healthFocus: "Plant-Based Protein", eatingOccasion: "Snacking" } },
  { upc: "034567000008", description: "BeanBurst Roasted Chickpeas – Everything Bagel", brand: "BeanBurst", company: "Elevate Natural Foods", category: "Snacks", subcategory: "Legume Snacks", daysAgoLaunched: 220, patternType: "winner", baseVelocity: 21, launchTdp: 490, priceLatest: 4.49, promoMix: 0.11, attributes: { form: "Crunchy", flavor: "Everything Bagel", packFormat: "Single", brandPositioning: "Plant Protein", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: true, healthFocus: "Plant-Based Protein", eatingOccasion: "Snacking" } },
  { upc: "034567000009", description: "SlimBite Turkey Bites – Original", brand: "SlimBite", company: "Peak Performance Brands", category: "Snacks", subcategory: "Meat Snacks", daysAgoLaunched: 110, patternType: "steady", baseVelocity: 13, launchTdp: 270, priceLatest: 6.99, promoMix: 0.20, attributes: { form: "Bites", flavor: "Original", packFormat: "Family", brandPositioning: "Protein Snack", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "Protein", eatingOccasion: "Snacking" } },
  { upc: "034567000010", description: "GrainFree Snack Crackers – Rosemary Sea Salt", brand: "GrainFree", company: "WildRoots Co.", category: "Snacks", subcategory: "Crackers", daysAgoLaunched: 460, patternType: "steady", baseVelocity: 16, launchTdp: 430, priceLatest: 5.99, promoMix: 0.17, attributes: { form: "Crackers", flavor: "Rosemary Sea Salt", packFormat: "Single", brandPositioning: "Grain-Free", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Clean Eating", eatingOccasion: "Snacking" } },
  { upc: "034567000011", description: "VerdeCrisp Kale Chips – Nacho", brand: "VerdeCrisp", company: "Elevate Natural Foods", category: "Snacks", subcategory: "Veggie Snacks", daysAgoLaunched: 380, patternType: "fader", baseVelocity: 9, launchTdp: 280, priceLatest: 4.99, promoMix: 0.30, attributes: { form: "Chips", flavor: "Nacho", packFormat: "Single", brandPositioning: "Natural", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Clean Snacking", eatingOccasion: "Snacking" } },
  { upc: "034567000012", description: "AlmondCraft Clusters – Dark Chocolate", brand: "AlmondCraft", company: "WildRoots Co.", category: "Snacks", subcategory: "Nut Snacks", daysAgoLaunched: 160, patternType: "sleeper", baseVelocity: 14, launchTdp: 300, priceLatest: 6.49, promoMix: 0.13, attributes: { form: "Clusters", flavor: "Dark Chocolate", packFormat: "Single", brandPositioning: "Artisan", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Clean Snacking", eatingOccasion: "Snacking" } },
  { upc: "034567000013", description: "SnackMate Mixed Seeds – Spicy Lime", brand: "SnackMate", company: "WildRoots Co.", category: "Snacks", subcategory: "Seed Snacks", daysAgoLaunched: 1100, patternType: "fader", baseVelocity: 7, launchTdp: 220, priceLatest: 3.99, promoMix: 0.38, attributes: { form: "Loose", flavor: "Spicy Lime", packFormat: "Single", brandPositioning: "Value", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: null, eatingOccasion: "Snacking" } },
  { upc: "034567000014", description: "TrueRoots Cassava Chips – Original", brand: "TrueRoots", company: "WildRoots Co.", category: "Snacks", subcategory: "Chips", daysAgoLaunched: 270, patternType: "steady", baseVelocity: 17, launchTdp: 360, priceLatest: 4.79, promoMix: 0.16, attributes: { form: "Chips", flavor: "Sea Salt", packFormat: "Single", brandPositioning: "Natural", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Clean Eating", eatingOccasion: "Snacking" } },
  { upc: "034567000015", description: "PitaPerfect Baked Chips – Hummus", brand: "PitaPerfect", company: "Elevate Natural Foods", category: "Snacks", subcategory: "Crackers", daysAgoLaunched: 195, patternType: "fader", baseVelocity: 11, launchTdp: 310, priceLatest: 3.99, promoMix: 0.26, attributes: { form: "Chips", flavor: "Hummus", packFormat: "Single", brandPositioning: "Mediterranean", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: false, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: null, eatingOccasion: "Snacking" } },
  { upc: "034567000016", description: "SeedBar Savory Trail Mix – Pepita Cranberry", brand: "SeedBar", company: "WildRoots Co.", category: "Snacks", subcategory: "Trail Mix", daysAgoLaunched: 70, patternType: "sleeper", baseVelocity: 12, launchTdp: 180, priceLatest: 5.49, promoMix: 0.12, attributes: { form: "Mix", flavor: "Sweet & Savory", packFormat: "Single", brandPositioning: "Natural", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Clean Eating", eatingOccasion: "Snacking" } },

  // ─── SUPPLEMENTS ───────────────────────────────────────────────────────────
  { upc: "045678000001", description: "VitaGlow Gummies – Elderberry + Vitamin C", brand: "VitaGlow", company: "Clarity Wellness", category: "Supplements", subcategory: "Immune Support", daysAgoLaunched: 730, patternType: "winner", baseVelocity: 55, launchTdp: 720, priceLatest: 19.99, promoMix: 0.10, attributes: { form: "Gummies", flavor: "Elderberry", packFormat: "Single", brandPositioning: "Immune", functionalIngredient: "Elderberry + Vitamin C", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Immune Support", eatingOccasion: "Daily" } },
  { upc: "045678000002", description: "VitaGlow Gummies – Ashwagandha + Sleep", brand: "VitaGlow", company: "Clarity Wellness", category: "Supplements", subcategory: "Sleep & Stress", daysAgoLaunched: 280, patternType: "winner", baseVelocity: 48, launchTdp: 640, priceLatest: 22.99, promoMix: 0.09, attributes: { form: "Gummies", flavor: "Berry", packFormat: "Single", brandPositioning: "Sleep & Calm", functionalIngredient: "Ashwagandha + Melatonin", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Sleep", eatingOccasion: "Evening" } },
  { upc: "045678000003", description: "MuscleMend Collagen Powder – Unflavored", brand: "MuscleMend", company: "Peak Performance Brands", category: "Supplements", subcategory: "Protein Supplements", daysAgoLaunched: 490, patternType: "winner", baseVelocity: 42, launchTdp: 580, priceLatest: 34.99, promoMix: 0.11, attributes: { form: "Powder", flavor: "Unflavored", packFormat: "Single", brandPositioning: "Performance", functionalIngredient: "Collagen Peptides", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "Joint & Skin Health", eatingOccasion: "Daily" } },
  { upc: "045678000004", description: "MuscleMend Collagen Powder – Vanilla", brand: "MuscleMend", company: "Peak Performance Brands", category: "Supplements", subcategory: "Protein Supplements", daysAgoLaunched: 340, patternType: "steady", baseVelocity: 36, launchTdp: 510, priceLatest: 34.99, promoMix: 0.12, attributes: { form: "Powder", flavor: "Vanilla", packFormat: "Single", brandPositioning: "Performance", functionalIngredient: "Collagen Peptides", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "Joint & Skin Health", eatingOccasion: "Morning" } },
  { upc: "045678000005", description: "FocusPeak Nootropic Capsules – Lion's Mane", brand: "FocusPeak", company: "Clarity Wellness", category: "Supplements", subcategory: "Cognitive Health", daysAgoLaunched: 180, patternType: "winner", baseVelocity: 51, launchTdp: 420, priceLatest: 29.99, promoMix: 0.08, attributes: { form: "Capsules", flavor: "Unflavored", packFormat: "Single", brandPositioning: "Nootropic", functionalIngredient: "Lion's Mane + Bacopa", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Cognitive Health", eatingOccasion: "Morning" } },
  { upc: "045678000006", description: "ProbioBalance Daily Probiotic – 50B CFU", brand: "ProbioBalance", company: "Elevate Natural Foods", category: "Supplements", subcategory: "Digestive Health", daysAgoLaunched: 360, patternType: "winner", baseVelocity: 44, launchTdp: 560, priceLatest: 27.99, promoMix: 0.10, attributes: { form: "Capsules", flavor: "Unflavored", packFormat: "Single", brandPositioning: "Gut Health", functionalIngredient: "Probiotics + Prebiotics", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Gut Health", eatingOccasion: "Daily" } },
  { upc: "045678000007", description: "OmegaPlus Fish Oil Gummies – Lemon", brand: "OmegaPlus", company: "Clarity Wellness", category: "Supplements", subcategory: "Omega-3", daysAgoLaunched: 1096, patternType: "steady", baseVelocity: 33, launchTdp: 490, priceLatest: 24.99, promoMix: 0.14, attributes: { form: "Gummies", flavor: "Lemon", packFormat: "Trial", brandPositioning: "Heart Health", functionalIngredient: "Omega-3 DHA + EPA", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Heart Health", eatingOccasion: "Daily" } },
  { upc: "045678000008", description: "SleepEase Melatonin Gummies – Cherry", brand: "SleepEase", company: "Clarity Wellness", category: "Supplements", subcategory: "Sleep & Stress", daysAgoLaunched: 740, patternType: "winner", baseVelocity: 58, launchTdp: 680, priceLatest: 14.99, promoMix: 0.09, attributes: { form: "Gummies", flavor: "Cherry", packFormat: "Single", brandPositioning: "Sleep", functionalIngredient: "Melatonin + L-Theanine", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Sleep", eatingOccasion: "Evening" } },
  { upc: "045678000009", description: "GreensComplete Superfood Powder – Mixed Berry", brand: "GreensComplete", company: "Elevate Natural Foods", category: "Supplements", subcategory: "Greens Powders", daysAgoLaunched: 145, patternType: "sleeper", baseVelocity: 28, launchTdp: 310, priceLatest: 44.99, promoMix: 0.11, attributes: { form: "Powder", flavor: "Mixed Berry", packFormat: "Single", brandPositioning: "Superfoods", functionalIngredient: "Spirulina + Chlorella", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "General Wellness", eatingOccasion: "Morning" } },
  { upc: "045678000010", description: "IronMind Pre-Workout – Watermelon", brand: "IronMind", company: "Peak Performance Brands", category: "Supplements", subcategory: "Pre-Workout", daysAgoLaunched: 390, patternType: "fader", baseVelocity: 22, launchTdp: 380, priceLatest: 39.99, promoMix: 0.26, attributes: { form: "Powder", flavor: "Watermelon", packFormat: "Single", brandPositioning: "Performance", functionalIngredient: "Creatine + Caffeine", isOrganic: false, isNonGmo: false, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Performance", eatingOccasion: "Pre-Workout" } },
  { upc: "045678000011", description: "ElectroPlus Hydration Powder – Lemon Lime", brand: "ElectroPlus", company: "Peak Performance Brands", category: "Supplements", subcategory: "Sports Nutrition", daysAgoLaunched: 210, patternType: "steady", baseVelocity: 31, launchTdp: 420, priceLatest: 19.99, promoMix: 0.15, attributes: { form: "Powder", flavor: "Lemon Lime", packFormat: "Single", brandPositioning: "Hydration", functionalIngredient: "Electrolytes", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Hydration", eatingOccasion: "Workout" } },
  { upc: "045678000012", description: "ZincShield Immune Gummies – Orange", brand: "ZincShield", company: "Clarity Wellness", category: "Supplements", subcategory: "Immune Support", daysAgoLaunched: 100, patternType: "sleeper", baseVelocity: 24, launchTdp: 280, priceLatest: 17.99, promoMix: 0.12, attributes: { form: "Gummies", flavor: "Orange", packFormat: "Single", brandPositioning: "Immune", functionalIngredient: "Zinc + Vitamin D", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Immune Support", eatingOccasion: "Daily" } },
  { upc: "045678000013", description: "TurmericMax Anti-Inflammatory – Ginger Blend", brand: "TurmericMax", company: "Elevate Natural Foods", category: "Supplements", subcategory: "Anti-Inflammatory", daysAgoLaunched: 480, patternType: "steady", baseVelocity: 29, launchTdp: 400, priceLatest: 24.99, promoMix: 0.13, attributes: { form: "Capsules", flavor: "Unflavored", packFormat: "Single", brandPositioning: "Anti-Inflammatory", functionalIngredient: "Turmeric + Black Pepper", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Anti-Inflammatory", eatingOccasion: "Daily" } },
  { upc: "045678000014", description: "MagnesiumCalm Powder – Berry", brand: "MagnesiumCalm", company: "Clarity Wellness", category: "Supplements", subcategory: "Sleep & Stress", daysAgoLaunched: 60, patternType: "steady", baseVelocity: 27, launchTdp: 230, priceLatest: 29.99, promoMix: 0.10, attributes: { form: "Powder", flavor: "Berry", packFormat: "Single", brandPositioning: "Relaxation", functionalIngredient: "Magnesium Glycinate", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Sleep", eatingOccasion: "Evening" } },
  { upc: "045678000015", description: "CoQ10 Heart Health Capsules", brand: "OmegaPlus", company: "Clarity Wellness", category: "Supplements", subcategory: "Heart Health", daysAgoLaunched: 1097, patternType: "fader", baseVelocity: 18, launchTdp: 310, priceLatest: 32.99, promoMix: 0.22, attributes: { form: "Capsules", flavor: "Unflavored", packFormat: "Single", brandPositioning: "Heart Health", functionalIngredient: "CoQ10", isOrganic: false, isNonGmo: false, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Heart Health", eatingOccasion: "Daily" } },
  { upc: "045678000016", description: "B12 Boost Energy Gummies – Raspberry", brand: "VitaGlow", company: "Clarity Wellness", category: "Supplements", subcategory: "Energy Support", daysAgoLaunched: 85, patternType: "sleeper", baseVelocity: 21, launchTdp: 200, priceLatest: 16.99, promoMix: 0.11, attributes: { form: "Gummies", flavor: "Raspberry", packFormat: "Single", brandPositioning: "Energy", functionalIngredient: "B12 + Iron", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Morning" } },

  // ─── FROZEN MEALS ──────────────────────────────────────────────────────────
  { upc: "056789000001", description: "FreshBowl Korean BBQ Cauliflower Rice", brand: "FreshBowl", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Asian-Inspired", daysAgoLaunched: 380, patternType: "winner", baseVelocity: 22, launchTdp: 540, priceLatest: 7.99, promoMix: 0.13, attributes: { form: "Bowl", flavor: "Korean BBQ", packFormat: "Single", brandPositioning: "Better-for-You", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "Low Carb", eatingOccasion: "Lunch / Dinner" } },
  { upc: "056789000002", description: "FreshBowl Mediterranean Grain Bowl", brand: "FreshBowl", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Grain Bowls", daysAgoLaunched: 250, patternType: "winner", baseVelocity: 19, launchTdp: 490, priceLatest: 7.99, promoMix: 0.14, attributes: { form: "Bowl", flavor: "Mediterranean", packFormat: "Single", brandPositioning: "Better-for-You", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: false, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Balanced Nutrition", eatingOccasion: "Lunch / Dinner" } },
  { upc: "056789000003", description: "CleanEats Turkey Meatballs + Zucchini", brand: "CleanEats", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "High Protein", daysAgoLaunched: 310, patternType: "winner", baseVelocity: 18, launchTdp: 460, priceLatest: 8.49, promoMix: 0.12, attributes: { form: "Entrée", flavor: "Italian", packFormat: "Single", brandPositioning: "Clean Label", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "High Protein", eatingOccasion: "Dinner" } },
  { upc: "056789000004", description: "CleanEats Chicken Tikka Masala", brand: "CleanEats", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "International", daysAgoLaunched: 190, patternType: "steady", baseVelocity: 15, launchTdp: 380, priceLatest: 8.49, promoMix: 0.15, attributes: { form: "Entrée", flavor: "Indian", packFormat: "Variety Pack", brandPositioning: "Global Cuisine", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Balanced Nutrition", eatingOccasion: "Dinner" } },
  { upc: "056789000005", description: "PlantHarvest Lentil Curry", brand: "PlantHarvest", company: "Elevate Natural Foods", category: "Frozen Meals", subcategory: "Plant-Based", daysAgoLaunched: 745, patternType: "steady", baseVelocity: 14, launchTdp: 420, priceLatest: 6.99, promoMix: 0.17, attributes: { form: "Bowl", flavor: "Indian Spiced", packFormat: "Single", brandPositioning: "Plant-Based", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Plant-Based", eatingOccasion: "Lunch / Dinner" } },
  { upc: "056789000006", description: "PlantHarvest Vegan Mushroom Risotto", brand: "PlantHarvest", company: "Elevate Natural Foods", category: "Frozen Meals", subcategory: "Plant-Based", daysAgoLaunched: 145, patternType: "steady", baseVelocity: 12, launchTdp: 290, priceLatest: 7.49, promoMix: 0.16, attributes: { form: "Bowl", flavor: "Mushroom Herb", packFormat: "Single", brandPositioning: "Plant-Based", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Plant-Based", eatingOccasion: "Dinner" } },
  { upc: "056789000007", description: "SlimFit Teriyaki Salmon Bowl", brand: "SlimFit", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Seafood", daysAgoLaunched: 200, patternType: "winner", baseVelocity: 21, launchTdp: 410, priceLatest: 9.99, promoMix: 0.11, attributes: { form: "Bowl", flavor: "Teriyaki", packFormat: "Single", brandPositioning: "Lean & Fit", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "High Protein", eatingOccasion: "Lunch / Dinner" } },
  { upc: "056789000008", description: "SlimFit Shrimp Fried Cauliflower Rice", brand: "SlimFit", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Asian-Inspired", daysAgoLaunched: 95, patternType: "sleeper", baseVelocity: 13, launchTdp: 250, priceLatest: 8.99, promoMix: 0.14, attributes: { form: "Bowl", flavor: "Asian", packFormat: "Single", brandPositioning: "Lean & Fit", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "Low Carb", eatingOccasion: "Lunch / Dinner" } },
  { upc: "056789000009", description: "WholeMeal Shepherd's Pie – Beef & Veggies", brand: "WholeMeal", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Comfort Food", daysAgoLaunched: 470, patternType: "fader", baseVelocity: 10, launchTdp: 350, priceLatest: 7.99, promoMix: 0.28, attributes: { form: "Entrée", flavor: "Classic", packFormat: "Single", brandPositioning: "Comfort", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: null, eatingOccasion: "Dinner" } },
  { upc: "056789000010", description: "NutriKids Mac & Cauliflower (Hidden Veggies)", brand: "NutriKids", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Kids Meals", daysAgoLaunched: 280, patternType: "steady", baseVelocity: 13, launchTdp: 390, priceLatest: 5.99, promoMix: 0.20, attributes: { form: "Entrée", flavor: "Cheese", packFormat: "Single", brandPositioning: "Kids Health", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Kids Nutrition", eatingOccasion: "Lunch" } },
  { upc: "056789000011", description: "PastaPlant Zucchini Noodle Bolognese", brand: "PastaPlant", company: "Elevate Natural Foods", category: "Frozen Meals", subcategory: "Plant-Based", daysAgoLaunched: 135, patternType: "sleeper", baseVelocity: 11, launchTdp: 220, priceLatest: 8.49, promoMix: 0.13, attributes: { form: "Entrée", flavor: "Italian", packFormat: "Single", brandPositioning: "Plant-Based", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Plant-Based", eatingOccasion: "Dinner" } },
  { upc: "056789000012", description: "OrchardKitchen Stuffed Peppers", brand: "OrchardKitchen", company: "WildRoots Co.", category: "Frozen Meals", subcategory: "Comfort Food", daysAgoLaunched: 390, patternType: "fader", baseVelocity: 9, launchTdp: 280, priceLatest: 6.99, promoMix: 0.32, attributes: { form: "Entrée", flavor: "Italian", packFormat: "Single", brandPositioning: "Artisan", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: null, eatingOccasion: "Dinner" } },
  { upc: "056789000013", description: "GrillMaster Grass-Fed Beef Burger Patties", brand: "GrillMaster", company: "Peak Performance Brands", category: "Frozen Meals", subcategory: "Proteins", daysAgoLaunched: 510, patternType: "steady", baseVelocity: 17, launchTdp: 480, priceLatest: 10.99, promoMix: 0.18, attributes: { form: "Patties", flavor: "Classic Beef", packFormat: "Single", brandPositioning: "Premium Quality", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "High Protein", eatingOccasion: "Dinner" } },
  { upc: "056789000014", description: "FreezeFrame Breakfast Burrito – Egg & Veggie", brand: "FreezeFrame", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Breakfast", daysAgoLaunched: 165, patternType: "steady", baseVelocity: 14, launchTdp: 340, priceLatest: 4.99, promoMix: 0.20, attributes: { form: "Burrito", flavor: "Egg & Veggie", packFormat: "Single", brandPositioning: "Better-for-You", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Balanced Nutrition", eatingOccasion: "Breakfast" } },
  { upc: "056789000015", description: "WokWise Chicken Fried Rice – Lower Sodium", brand: "WokWise", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Asian-Inspired", daysAgoLaunched: 350, patternType: "fader", baseVelocity: 11, launchTdp: 420, priceLatest: 6.49, promoMix: 0.25, attributes: { form: "Bowl", flavor: "Asian", packFormat: "Single", brandPositioning: "Value", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Lower Sodium", eatingOccasion: "Lunch / Dinner" } },
  { upc: "056789000016", description: "SimpleMeal Quinoa & Black Bean Bowl", brand: "SimpleMeal", company: "Elevate Natural Foods", category: "Frozen Meals", subcategory: "Plant-Based", daysAgoLaunched: 50, patternType: "sleeper", baseVelocity: 10, launchTdp: 160, priceLatest: 6.99, promoMix: 0.13, attributes: { form: "Bowl", flavor: "Mexican Spiced", packFormat: "Single", brandPositioning: "Plant-Based", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: true, healthFocus: "Plant-Based", eatingOccasion: "Lunch / Dinner" } },
];

const RAW_LAUNCHES: RawLaunch[] = SPECS.map((spec) => buildLaunch(spec));

// Post-process 1: innovationType (needs all peers to classify)
const WITH_INNOVATION: (RawLaunch & { innovationType: InnovationType })[] = RAW_LAUNCHES.map((l) => ({
  ...l,
  innovationType: classifyInnovationType(l as Launch, RAW_LAUNCHES as Launch[]),
}));

// Post-process 2: velocityTier — top/mid/bottom third of category velocity
// Post-process 3: needState / needStateSecondary — classification engine
export const LAUNCHES: Launch[] = WITH_INNOVATION.map((l) => {
  const catVelocities = WITH_INNOVATION
    .filter((other) => other.category === l.category)
    .map((other) => other.velocityLatest)
    .sort((a, b) => a - b);
  const n = catVelocities.length;
  const rank = catVelocities.indexOf(l.velocityLatest);
  const tier: VelocityTier =
    rank >= Math.floor(n * 2 / 3) ? "Top" :
    rank >= Math.floor(n / 3)     ? "Mid" :
    "Bottom";
  const { primary, secondary } = computeNeedState(launchToNeedStateInput(l as Launch));
  return { ...l, velocityTier: tier, needState: primary, needStateSecondary: secondary };
});

export function getLaunchByUpc(upc: string): Launch | undefined {
  return LAUNCHES.find((l) => l.upc === upc);
}

export function getLaunchsByCategory(category: Launch["category"]): Launch[] {
  return LAUNCHES.filter((l) => l.category === category);
}

export function getWinners(launches = LAUNCHES): Launch[] {
  return launches.filter((l) => l.launchQualityScore >= 70);
}

export function getSuccessful(launches = LAUNCHES): Launch[] {
  return launches.filter(
    (l) => l.launchOutcome === "Successful" || l.launchOutcome === "Sustaining"
  );
}

export function getRecentLaunches(weeksBack = 12): Launch[] {
  return LAUNCHES.filter((l) => l.ageWeeks <= weeksBack).sort(
    (a, b) => a.ageWeeks - b.ageWeeks
  );
}

export function getBreakoutLaunches(topN = 5): Launch[] {
  return [...LAUNCHES]
    .filter((l) => l.growthRate12w !== null)
    .sort((a, b) => (b.growthRate12w ?? 0) - (a.growthRate12w ?? 0))
    .slice(0, topN);
}
