import type { Launch, AttributeSet, Retailer } from "@/lib/types";

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

function buildLaunch(spec: LaunchSpec, peers: Launch[] = []): Launch {
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

  // Percentiles vs cohort (simplified from distribution)
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
    attributes: spec.attributes,
  };
}

const SPECS: LaunchSpec[] = [
  // ─── BARS ──────────────────────────────────────────────────────────────────
  { upc: "012345000001", description: "PeakBar Protein Crunch – Chocolate PB", brand: "PeakBar", company: "Peak Performance Brands", category: "Bars", subcategory: "Protein Bars", daysAgoLaunched: 420, patternType: "winner", baseVelocity: 34, launchTdp: 680, priceLatest: 2.99, promoMix: 0.12, attributes: { form: "Bar", flavor: "Chocolate Peanut Butter", brandPositioning: "Performance", functionalIngredient: "Whey Protein", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Muscle Recovery", eatingOccasion: "Post-Workout" } },
  { upc: "012345000002", description: "PeakBar Protein Crunch – Vanilla Almond", brand: "PeakBar", company: "Peak Performance Brands", category: "Bars", subcategory: "Protein Bars", daysAgoLaunched: 280, patternType: "winner", baseVelocity: 31, launchTdp: 590, priceLatest: 2.99, promoMix: 0.10, attributes: { form: "Bar", flavor: "Vanilla Almond", brandPositioning: "Performance", functionalIngredient: "Whey Protein", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Muscle Recovery", eatingOccasion: "Post-Workout" } },
  { upc: "012345000003", description: "Elevate Protein Bar – Dark Chocolate", brand: "Elevate", company: "Elevate Natural Foods", category: "Bars", subcategory: "Protein Bars", daysAgoLaunched: 350, patternType: "steady", baseVelocity: 22, launchTdp: 440, priceLatest: 3.29, promoMix: 0.18, attributes: { form: "Bar", flavor: "Dark Chocolate", brandPositioning: "Clean Label", functionalIngredient: "Plant Protein", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: true, healthFocus: "General Wellness", eatingOccasion: "Snacking" } },
  { upc: "012345000004", description: "WildRoots Grain-Free Bar – Cashew + Honey", brand: "WildRoots", company: "WildRoots Co.", category: "Bars", subcategory: "Snack Bars", daysAgoLaunched: 190, patternType: "steady", baseVelocity: 18, launchTdp: 320, priceLatest: 3.79, promoMix: 0.15, attributes: { form: "Bar", flavor: "Cashew Honey", brandPositioning: "Natural", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Clean Eating", eatingOccasion: "Snacking" } },
  { upc: "012345000005", description: "PlantPower Energy Bar – Mixed Berry", brand: "PlantPower", company: "Elevate Natural Foods", category: "Bars", subcategory: "Energy Bars", daysAgoLaunched: 510, patternType: "winner", baseVelocity: 29, launchTdp: 720, priceLatest: 3.49, promoMix: 0.14, attributes: { form: "Bar", flavor: "Mixed Berry", brandPositioning: "Plant-Based", functionalIngredient: "Adaptogens", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: true, healthFocus: "Energy", eatingOccasion: "Pre-Workout" } },
  { upc: "012345000006", description: "Keto Fuel Bar – Chocolate Fudge", brand: "Keto Fuel", company: "Peak Performance Brands", category: "Bars", subcategory: "Keto Bars", daysAgoLaunched: 140, patternType: "sleeper", baseVelocity: 16, launchTdp: 280, priceLatest: 3.99, promoMix: 0.20, attributes: { form: "Bar", flavor: "Chocolate Fudge", brandPositioning: "Keto", functionalIngredient: "MCT Oil", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "Weight Management", eatingOccasion: "Snacking" } },
  { upc: "012345000007", description: "CleanStart Snack Bar – Coconut Lime", brand: "CleanStart", company: "WildRoots Co.", category: "Bars", subcategory: "Snack Bars", daysAgoLaunched: 60, patternType: "steady", baseVelocity: 14, launchTdp: 210, priceLatest: 2.79, promoMix: 0.22, attributes: { form: "Bar", flavor: "Coconut Lime", brandPositioning: "Clean Label", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Clean Eating", eatingOccasion: "Snacking" } },
  { upc: "012345000008", description: "ProGrid Performance Bar – Mint Choc Chip", brand: "ProGrid", company: "Peak Performance Brands", category: "Bars", subcategory: "Protein Bars", daysAgoLaunched: 320, patternType: "fader", baseVelocity: 12, launchTdp: 380, priceLatest: 3.29, promoMix: 0.30, attributes: { form: "Bar", flavor: "Mint Chocolate Chip", brandPositioning: "Performance", functionalIngredient: "Whey Protein", isOrganic: false, isNonGmo: false, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Muscle Recovery", eatingOccasion: "Post-Workout" } },
  { upc: "012345000009", description: "SunBurst Fruit & Nut Bar – Apricot Pistachio", brand: "SunBurst", company: "Elevate Natural Foods", category: "Bars", subcategory: "Snack Bars", daysAgoLaunched: 245, patternType: "steady", baseVelocity: 17, launchTdp: 360, priceLatest: 3.59, promoMix: 0.16, attributes: { form: "Bar", flavor: "Apricot Pistachio", brandPositioning: "Artisan", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: false, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "General Wellness", eatingOccasion: "Snacking" } },
  { upc: "012345000010", description: "FitCore Protein Bar – Salted Caramel", brand: "FitCore", company: "Peak Performance Brands", category: "Bars", subcategory: "Protein Bars", daysAgoLaunched: 480, patternType: "winner", baseVelocity: 38, launchTdp: 780, priceLatest: 2.89, promoMix: 0.11, attributes: { form: "Bar", flavor: "Salted Caramel", brandPositioning: "Performance", functionalIngredient: "Whey Protein", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Muscle Recovery", eatingOccasion: "Post-Workout" } },
  { upc: "012345000011", description: "VerdeLite Bar – Matcha + White Chocolate", brand: "VerdeLite", company: "Elevate Natural Foods", category: "Bars", subcategory: "Snack Bars", daysAgoLaunched: 90, patternType: "sleeper", baseVelocity: 11, launchTdp: 190, priceLatest: 4.19, promoMix: 0.18, attributes: { form: "Bar", flavor: "Matcha White Chocolate", brandPositioning: "Functional", functionalIngredient: "Matcha", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Focus & Calm", eatingOccasion: "Morning" } },
  { upc: "012345000012", description: "NourishMe Bar – Apple Cinnamon", brand: "NourishMe", company: "WildRoots Co.", category: "Bars", subcategory: "Snack Bars", daysAgoLaunched: 380, patternType: "fader", baseVelocity: 9, launchTdp: 290, priceLatest: 2.99, promoMix: 0.35, attributes: { form: "Bar", flavor: "Apple Cinnamon", brandPositioning: "Natural", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: false, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: null, eatingOccasion: "Snacking" } },
  { upc: "012345000013", description: "IronWill Protein Bar – Birthday Cake", brand: "IronWill", company: "Peak Performance Brands", category: "Bars", subcategory: "Protein Bars", daysAgoLaunched: 155, patternType: "steady", baseVelocity: 20, launchTdp: 390, priceLatest: 3.19, promoMix: 0.19, attributes: { form: "Bar", flavor: "Birthday Cake", brandPositioning: "Performance", functionalIngredient: "Whey Protein", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Muscle Recovery", eatingOccasion: "Post-Workout" } },
  { upc: "012345000014", description: "TrueGrit Endurance Bar – Peanut Butter", brand: "TrueGrit", company: "Peak Performance Brands", category: "Bars", subcategory: "Energy Bars", daysAgoLaunched: 560, patternType: "winner", baseVelocity: 26, launchTdp: 650, priceLatest: 3.79, promoMix: 0.13, attributes: { form: "Bar", flavor: "Peanut Butter", brandPositioning: "Endurance", functionalIngredient: "BCAAs", isOrganic: false, isNonGmo: true, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Endurance", eatingOccasion: "Pre-Workout" } },
  { upc: "012345000015", description: "Harvest Gold Grain Bar – Oat & Honey", brand: "Harvest Gold", company: "WildRoots Co.", category: "Bars", subcategory: "Snack Bars", daysAgoLaunched: 430, patternType: "fader", baseVelocity: 8, launchTdp: 240, priceLatest: 1.99, promoMix: 0.40, attributes: { form: "Bar", flavor: "Oat Honey", brandPositioning: "Value", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: null, eatingOccasion: "Snacking" } },
  { upc: "012345000016", description: "ZenFuel Adaptogen Bar – Ashwagandha Cacao", brand: "ZenFuel", company: "Clarity Wellness", category: "Bars", subcategory: "Functional Bars", daysAgoLaunched: 75, patternType: "sleeper", baseVelocity: 13, launchTdp: 170, priceLatest: 4.99, promoMix: 0.12, attributes: { form: "Bar", flavor: "Cacao", brandPositioning: "Functional", functionalIngredient: "Ashwagandha", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Stress Relief", eatingOccasion: "Snacking" } },

  // ─── BEVERAGES ─────────────────────────────────────────────────────────────
  { upc: "023456000001", description: "Clarity Energy – Blood Orange", brand: "Clarity Energy", company: "Clarity Wellness", category: "Beverages", subcategory: "Energy Drinks", daysAgoLaunched: 390, patternType: "winner", baseVelocity: 42, launchTdp: 920, priceLatest: 3.49, promoMix: 0.09, attributes: { form: "Ready-to-Drink", flavor: "Blood Orange", brandPositioning: "Clean Energy", functionalIngredient: "Caffeine + L-Theanine", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Morning" } },
  { upc: "023456000002", description: "Clarity Energy – Cucumber Mint", brand: "Clarity Energy", company: "Clarity Wellness", category: "Beverages", subcategory: "Energy Drinks", daysAgoLaunched: 260, patternType: "winner", baseVelocity: 38, launchTdp: 840, priceLatest: 3.49, promoMix: 0.10, attributes: { form: "Ready-to-Drink", flavor: "Cucumber Mint", brandPositioning: "Clean Energy", functionalIngredient: "Caffeine + L-Theanine", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Afternoon" } },
  { upc: "023456000003", description: "VoltPure RTD Coffee – Oat Milk Latte", brand: "VoltPure", company: "Clarity Wellness", category: "Beverages", subcategory: "RTD Coffee", daysAgoLaunched: 450, patternType: "winner", baseVelocity: 35, launchTdp: 760, priceLatest: 4.99, promoMix: 0.12, attributes: { form: "Ready-to-Drink", flavor: "Caramel Oat Latte", brandPositioning: "Premium", functionalIngredient: "Cold Brew Coffee", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Morning" } },
  { upc: "023456000004", description: "VoltPure RTD Coffee – Black Bold", brand: "VoltPure", company: "Clarity Wellness", category: "Beverages", subcategory: "RTD Coffee", daysAgoLaunched: 310, patternType: "steady", baseVelocity: 28, launchTdp: 620, priceLatest: 4.49, promoMix: 0.14, attributes: { form: "Ready-to-Drink", flavor: "Black", brandPositioning: "Premium", functionalIngredient: "Cold Brew Coffee", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Morning" } },
  { upc: "023456000005", description: "AquaZen Functional Water – Magnesium + Citrus", brand: "AquaZen", company: "Clarity Wellness", category: "Beverages", subcategory: "Functional Water", daysAgoLaunched: 200, patternType: "sleeper", baseVelocity: 19, launchTdp: 480, priceLatest: 2.99, promoMix: 0.16, attributes: { form: "Ready-to-Drink", flavor: "Citrus", brandPositioning: "Functional Hydration", functionalIngredient: "Magnesium", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Hydration", eatingOccasion: "Workout" } },
  { upc: "023456000006", description: "AquaZen Functional Water – Elderberry + Zinc", brand: "AquaZen", company: "Clarity Wellness", category: "Beverages", subcategory: "Functional Water", daysAgoLaunched: 130, patternType: "steady", baseVelocity: 16, launchTdp: 390, priceLatest: 2.99, promoMix: 0.17, attributes: { form: "Ready-to-Drink", flavor: "Elderberry", brandPositioning: "Immune Support", functionalIngredient: "Elderberry + Zinc", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Immune Support", eatingOccasion: "Morning" } },
  { upc: "023456000007", description: "PureLift Energy Drink – Watermelon", brand: "PureLift", company: "Peak Performance Brands", category: "Beverages", subcategory: "Energy Drinks", daysAgoLaunched: 170, patternType: "fader", baseVelocity: 14, launchTdp: 520, priceLatest: 2.49, promoMix: 0.32, attributes: { form: "Ready-to-Drink", flavor: "Watermelon", brandPositioning: "Performance", functionalIngredient: "Caffeine", isOrganic: false, isNonGmo: false, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Pre-Workout" } },
  { upc: "023456000008", description: "RootRevive Adaptogen Drink – Ginger Turmeric", brand: "RootRevive", company: "Elevate Natural Foods", category: "Beverages", subcategory: "Functional Beverages", daysAgoLaunched: 95, patternType: "sleeper", baseVelocity: 22, launchTdp: 290, priceLatest: 4.29, promoMix: 0.11, attributes: { form: "Ready-to-Drink", flavor: "Ginger Turmeric", brandPositioning: "Functional", functionalIngredient: "Ashwagandha + Turmeric", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Anti-Inflammatory", eatingOccasion: "Morning" } },
  { upc: "023456000009", description: "MindFuel Nootropic Drink – Berry Focus", brand: "MindFuel", company: "Clarity Wellness", category: "Beverages", subcategory: "Functional Beverages", daysAgoLaunched: 220, patternType: "winner", baseVelocity: 31, launchTdp: 680, priceLatest: 4.49, promoMix: 0.08, attributes: { form: "Ready-to-Drink", flavor: "Mixed Berry", brandPositioning: "Nootropic", functionalIngredient: "Lion's Mane + Caffeine", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Focus & Cognition", eatingOccasion: "Morning" } },
  { upc: "023456000010", description: "HydraElite Sports Water – Lemon Electrolyte", brand: "HydraElite", company: "Peak Performance Brands", category: "Beverages", subcategory: "Sports Hydration", daysAgoLaunched: 360, patternType: "steady", baseVelocity: 24, launchTdp: 720, priceLatest: 2.79, promoMix: 0.20, attributes: { form: "Ready-to-Drink", flavor: "Lemon", brandPositioning: "Performance", functionalIngredient: "Electrolytes", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Hydration", eatingOccasion: "Workout" } },
  { upc: "023456000011", description: "BrewCraft Cold Brew – Caramel Macchiato", brand: "BrewCraft", company: "WildRoots Co.", category: "Beverages", subcategory: "RTD Coffee", daysAgoLaunched: 540, patternType: "winner", baseVelocity: 33, launchTdp: 810, priceLatest: 4.99, promoMix: 0.11, attributes: { form: "Ready-to-Drink", flavor: "Caramel Macchiato", brandPositioning: "Artisan", functionalIngredient: "Cold Brew Coffee", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Morning" } },
  { upc: "023456000012", description: "FloraFizz Probiotic Soda – Cherry Hibiscus", brand: "FloraFizz", company: "Elevate Natural Foods", category: "Beverages", subcategory: "Probiotic Beverages", daysAgoLaunched: 115, patternType: "sleeper", baseVelocity: 18, launchTdp: 340, priceLatest: 3.79, promoMix: 0.13, attributes: { form: "Ready-to-Drink", flavor: "Cherry Hibiscus", brandPositioning: "Gut Health", functionalIngredient: "Probiotics", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Gut Health", eatingOccasion: "Mealtime" } },
  { upc: "023456000013", description: "NightCalm Relaxation Drink – Lavender Chamomile", brand: "NightCalm", company: "Clarity Wellness", category: "Beverages", subcategory: "Functional Beverages", daysAgoLaunched: 80, patternType: "steady", baseVelocity: 15, launchTdp: 260, priceLatest: 3.99, promoMix: 0.14, attributes: { form: "Ready-to-Drink", flavor: "Lavender Chamomile", brandPositioning: "Relaxation", functionalIngredient: "Melatonin + L-Theanine", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Sleep", eatingOccasion: "Evening" } },
  { upc: "023456000014", description: "ZestShot Energy Shot – Tropical", brand: "ZestShot", company: "Peak Performance Brands", category: "Beverages", subcategory: "Energy Shots", daysAgoLaunched: 300, patternType: "fader", baseVelocity: 11, launchTdp: 580, priceLatest: 2.99, promoMix: 0.28, attributes: { form: "Shot", flavor: "Tropical", brandPositioning: "Performance", functionalIngredient: "Caffeine + B12", isOrganic: false, isNonGmo: false, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Afternoon" } },
  { upc: "023456000015", description: "SunDrop Vitamin C Water – Orange", brand: "SunDrop", company: "WildRoots Co.", category: "Beverages", subcategory: "Functional Water", daysAgoLaunched: 420, patternType: "fader", baseVelocity: 10, launchTdp: 420, priceLatest: 1.99, promoMix: 0.38, attributes: { form: "Ready-to-Drink", flavor: "Orange", brandPositioning: "Value", functionalIngredient: "Vitamin C", isOrganic: false, isNonGmo: false, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Immune Support", eatingOccasion: "Morning" } },
  { upc: "023456000016", description: "Equilibrium Balance Drink – Peach Ashwagandha", brand: "Equilibrium", company: "Elevate Natural Foods", category: "Beverages", subcategory: "Functional Beverages", daysAgoLaunched: 55, patternType: "sleeper", baseVelocity: 20, launchTdp: 210, priceLatest: 4.79, promoMix: 0.09, attributes: { form: "Ready-to-Drink", flavor: "Peach", brandPositioning: "Functional", functionalIngredient: "Ashwagandha", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Stress Relief", eatingOccasion: "Afternoon" } },

  // ─── SNACKS ────────────────────────────────────────────────────────────────
  { upc: "034567000001", description: "CrispLite Cauliflower Puffs – White Cheddar", brand: "CrispLite", company: "Elevate Natural Foods", category: "Snacks", subcategory: "Veggie Snacks", daysAgoLaunched: 360, patternType: "winner", baseVelocity: 28, launchTdp: 640, priceLatest: 4.99, promoMix: 0.11, attributes: { form: "Puffs", flavor: "White Cheddar", brandPositioning: "Better-for-You", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Clean Snacking", eatingOccasion: "Snacking" } },
  { upc: "034567000002", description: "CrispLite Cauliflower Puffs – Ranch", brand: "CrispLite", company: "Elevate Natural Foods", category: "Snacks", subcategory: "Veggie Snacks", daysAgoLaunched: 240, patternType: "winner", baseVelocity: 25, launchTdp: 570, priceLatest: 4.99, promoMix: 0.12, attributes: { form: "Puffs", flavor: "Ranch", brandPositioning: "Better-for-You", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Clean Snacking", eatingOccasion: "Snacking" } },
  { upc: "034567000003", description: "PureChip Avocado Chips – Sea Salt", brand: "PureChip", company: "WildRoots Co.", category: "Snacks", subcategory: "Chips", daysAgoLaunched: 290, patternType: "steady", baseVelocity: 19, launchTdp: 410, priceLatest: 5.49, promoMix: 0.15, attributes: { form: "Chips", flavor: "Sea Salt", brandPositioning: "Premium", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Clean Snacking", eatingOccasion: "Snacking" } },
  { upc: "034567000004", description: "PureChip Avocado Chips – Jalapeño", brand: "PureChip", company: "WildRoots Co.", category: "Snacks", subcategory: "Chips", daysAgoLaunched: 175, patternType: "sleeper", baseVelocity: 15, launchTdp: 320, priceLatest: 5.49, promoMix: 0.14, attributes: { form: "Chips", flavor: "Jalapeño", brandPositioning: "Premium", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Clean Snacking", eatingOccasion: "Snacking" } },
  { upc: "034567000005", description: "NourishCrunch Quinoa Crisps – BBQ", brand: "NourishCrunch", company: "Elevate Natural Foods", category: "Snacks", subcategory: "Grain Snacks", daysAgoLaunched: 470, patternType: "winner", baseVelocity: 22, launchTdp: 550, priceLatest: 4.79, promoMix: 0.13, attributes: { form: "Crisps", flavor: "BBQ", brandPositioning: "Better-for-You", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: true, healthFocus: "Plant-Based Protein", eatingOccasion: "Snacking" } },
  { upc: "034567000006", description: "SeaHarvest Seaweed Snacks – Sesame", brand: "SeaHarvest", company: "WildRoots Co.", category: "Snacks", subcategory: "Seaweed Snacks", daysAgoLaunched: 330, patternType: "steady", baseVelocity: 17, launchTdp: 380, priceLatest: 3.99, promoMix: 0.16, attributes: { form: "Sheets", flavor: "Sesame", brandPositioning: "Natural", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Minerals", eatingOccasion: "Snacking" } },
  { upc: "034567000007", description: "BeanBurst Roasted Chickpeas – Smoky Paprika", brand: "BeanBurst", company: "Elevate Natural Foods", category: "Snacks", subcategory: "Legume Snacks", daysAgoLaunched: 400, patternType: "winner", baseVelocity: 24, launchTdp: 580, priceLatest: 4.49, promoMix: 0.10, attributes: { form: "Crunchy", flavor: "Smoky Paprika", brandPositioning: "Plant Protein", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: true, healthFocus: "Plant-Based Protein", eatingOccasion: "Snacking" } },
  { upc: "034567000008", description: "BeanBurst Roasted Chickpeas – Everything Bagel", brand: "BeanBurst", company: "Elevate Natural Foods", category: "Snacks", subcategory: "Legume Snacks", daysAgoLaunched: 220, patternType: "winner", baseVelocity: 21, launchTdp: 490, priceLatest: 4.49, promoMix: 0.11, attributes: { form: "Crunchy", flavor: "Everything Bagel", brandPositioning: "Plant Protein", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: true, healthFocus: "Plant-Based Protein", eatingOccasion: "Snacking" } },
  { upc: "034567000009", description: "SlimBite Turkey Bites – Original", brand: "SlimBite", company: "Peak Performance Brands", category: "Snacks", subcategory: "Meat Snacks", daysAgoLaunched: 110, patternType: "steady", baseVelocity: 13, launchTdp: 270, priceLatest: 6.99, promoMix: 0.20, attributes: { form: "Bites", flavor: "Original", brandPositioning: "Protein Snack", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "Protein", eatingOccasion: "Snacking" } },
  { upc: "034567000010", description: "GrainFree Snack Crackers – Rosemary Sea Salt", brand: "GrainFree", company: "WildRoots Co.", category: "Snacks", subcategory: "Crackers", daysAgoLaunched: 460, patternType: "steady", baseVelocity: 16, launchTdp: 430, priceLatest: 5.99, promoMix: 0.17, attributes: { form: "Crackers", flavor: "Rosemary Sea Salt", brandPositioning: "Grain-Free", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Clean Eating", eatingOccasion: "Snacking" } },
  { upc: "034567000011", description: "VerdeCrisp Kale Chips – Nacho", brand: "VerdeCrisp", company: "Elevate Natural Foods", category: "Snacks", subcategory: "Veggie Snacks", daysAgoLaunched: 380, patternType: "fader", baseVelocity: 9, launchTdp: 280, priceLatest: 4.99, promoMix: 0.30, attributes: { form: "Chips", flavor: "Nacho", brandPositioning: "Natural", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Clean Snacking", eatingOccasion: "Snacking" } },
  { upc: "034567000012", description: "AlmondCraft Clusters – Dark Chocolate", brand: "AlmondCraft", company: "WildRoots Co.", category: "Snacks", subcategory: "Nut Snacks", daysAgoLaunched: 160, patternType: "sleeper", baseVelocity: 14, launchTdp: 300, priceLatest: 6.49, promoMix: 0.13, attributes: { form: "Clusters", flavor: "Dark Chocolate", brandPositioning: "Artisan", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Clean Snacking", eatingOccasion: "Snacking" } },
  { upc: "034567000013", description: "SnackMate Mixed Seeds – Spicy Lime", brand: "SnackMate", company: "WildRoots Co.", category: "Snacks", subcategory: "Seed Snacks", daysAgoLaunched: 520, patternType: "fader", baseVelocity: 7, launchTdp: 220, priceLatest: 3.99, promoMix: 0.38, attributes: { form: "Loose", flavor: "Spicy Lime", brandPositioning: "Value", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: null, eatingOccasion: "Snacking" } },
  { upc: "034567000014", description: "TrueRoots Cassava Chips – Original", brand: "TrueRoots", company: "WildRoots Co.", category: "Snacks", subcategory: "Chips", daysAgoLaunched: 270, patternType: "steady", baseVelocity: 17, launchTdp: 360, priceLatest: 4.79, promoMix: 0.16, attributes: { form: "Chips", flavor: "Sea Salt", brandPositioning: "Natural", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Clean Eating", eatingOccasion: "Snacking" } },
  { upc: "034567000015", description: "PitaPerfect Baked Chips – Hummus", brand: "PitaPerfect", company: "Elevate Natural Foods", category: "Snacks", subcategory: "Crackers", daysAgoLaunched: 195, patternType: "fader", baseVelocity: 11, launchTdp: 310, priceLatest: 3.99, promoMix: 0.26, attributes: { form: "Chips", flavor: "Hummus", brandPositioning: "Mediterranean", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: false, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: null, eatingOccasion: "Snacking" } },
  { upc: "034567000016", description: "SeedBar Savory Trail Mix – Pepita Cranberry", brand: "SeedBar", company: "WildRoots Co.", category: "Snacks", subcategory: "Trail Mix", daysAgoLaunched: 70, patternType: "sleeper", baseVelocity: 12, launchTdp: 180, priceLatest: 5.49, promoMix: 0.12, attributes: { form: "Mix", flavor: "Sweet & Savory", brandPositioning: "Natural", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Clean Eating", eatingOccasion: "Snacking" } },

  // ─── SUPPLEMENTS ───────────────────────────────────────────────────────────
  { upc: "045678000001", description: "VitaGlow Gummies – Elderberry + Vitamin C", brand: "VitaGlow", company: "Clarity Wellness", category: "Supplements", subcategory: "Immune Support", daysAgoLaunched: 410, patternType: "winner", baseVelocity: 55, launchTdp: 720, priceLatest: 19.99, promoMix: 0.10, attributes: { form: "Gummies", flavor: "Elderberry", brandPositioning: "Immune", functionalIngredient: "Elderberry + Vitamin C", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Immune Support", eatingOccasion: "Daily" } },
  { upc: "045678000002", description: "VitaGlow Gummies – Ashwagandha + Sleep", brand: "VitaGlow", company: "Clarity Wellness", category: "Supplements", subcategory: "Sleep & Stress", daysAgoLaunched: 280, patternType: "winner", baseVelocity: 48, launchTdp: 640, priceLatest: 22.99, promoMix: 0.09, attributes: { form: "Gummies", flavor: "Berry", brandPositioning: "Sleep & Calm", functionalIngredient: "Ashwagandha + Melatonin", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Sleep", eatingOccasion: "Evening" } },
  { upc: "045678000003", description: "MuscleMend Collagen Powder – Unflavored", brand: "MuscleMend", company: "Peak Performance Brands", category: "Supplements", subcategory: "Protein Supplements", daysAgoLaunched: 490, patternType: "winner", baseVelocity: 42, launchTdp: 580, priceLatest: 34.99, promoMix: 0.11, attributes: { form: "Powder", flavor: "Unflavored", brandPositioning: "Performance", functionalIngredient: "Collagen Peptides", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "Joint & Skin Health", eatingOccasion: "Daily" } },
  { upc: "045678000004", description: "MuscleMend Collagen Powder – Vanilla", brand: "MuscleMend", company: "Peak Performance Brands", category: "Supplements", subcategory: "Protein Supplements", daysAgoLaunched: 340, patternType: "steady", baseVelocity: 36, launchTdp: 510, priceLatest: 34.99, promoMix: 0.12, attributes: { form: "Powder", flavor: "Vanilla", brandPositioning: "Performance", functionalIngredient: "Collagen Peptides", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "Joint & Skin Health", eatingOccasion: "Morning" } },
  { upc: "045678000005", description: "FocusPeak Nootropic Capsules – Lion's Mane", brand: "FocusPeak", company: "Clarity Wellness", category: "Supplements", subcategory: "Cognitive Health", daysAgoLaunched: 180, patternType: "winner", baseVelocity: 51, launchTdp: 420, priceLatest: 29.99, promoMix: 0.08, attributes: { form: "Capsules", flavor: "Unflavored", brandPositioning: "Nootropic", functionalIngredient: "Lion's Mane + Bacopa", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Cognitive Health", eatingOccasion: "Morning" } },
  { upc: "045678000006", description: "ProbioBalance Daily Probiotic – 50B CFU", brand: "ProbioBalance", company: "Elevate Natural Foods", category: "Supplements", subcategory: "Digestive Health", daysAgoLaunched: 360, patternType: "winner", baseVelocity: 44, launchTdp: 560, priceLatest: 27.99, promoMix: 0.10, attributes: { form: "Capsules", flavor: "Unflavored", brandPositioning: "Gut Health", functionalIngredient: "Probiotics + Prebiotics", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Gut Health", eatingOccasion: "Daily" } },
  { upc: "045678000007", description: "OmegaPlus Fish Oil Gummies – Lemon", brand: "OmegaPlus", company: "Clarity Wellness", category: "Supplements", subcategory: "Omega-3", daysAgoLaunched: 510, patternType: "steady", baseVelocity: 33, launchTdp: 490, priceLatest: 24.99, promoMix: 0.14, attributes: { form: "Gummies", flavor: "Lemon", brandPositioning: "Heart Health", functionalIngredient: "Omega-3 DHA + EPA", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Heart Health", eatingOccasion: "Daily" } },
  { upc: "045678000008", description: "SleepEase Melatonin Gummies – Cherry", brand: "SleepEase", company: "Clarity Wellness", category: "Supplements", subcategory: "Sleep & Stress", daysAgoLaunched: 430, patternType: "winner", baseVelocity: 58, launchTdp: 680, priceLatest: 14.99, promoMix: 0.09, attributes: { form: "Gummies", flavor: "Cherry", brandPositioning: "Sleep", functionalIngredient: "Melatonin + L-Theanine", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Sleep", eatingOccasion: "Evening" } },
  { upc: "045678000009", description: "GreensComplete Superfood Powder – Mixed Berry", brand: "GreensComplete", company: "Elevate Natural Foods", category: "Supplements", subcategory: "Greens Powders", daysAgoLaunched: 145, patternType: "sleeper", baseVelocity: 28, launchTdp: 310, priceLatest: 44.99, promoMix: 0.11, attributes: { form: "Powder", flavor: "Mixed Berry", brandPositioning: "Superfoods", functionalIngredient: "Spirulina + Chlorella", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "General Wellness", eatingOccasion: "Morning" } },
  { upc: "045678000010", description: "IronMind Pre-Workout – Watermelon", brand: "IronMind", company: "Peak Performance Brands", category: "Supplements", subcategory: "Pre-Workout", daysAgoLaunched: 390, patternType: "fader", baseVelocity: 22, launchTdp: 380, priceLatest: 39.99, promoMix: 0.26, attributes: { form: "Powder", flavor: "Watermelon", brandPositioning: "Performance", functionalIngredient: "Creatine + Caffeine", isOrganic: false, isNonGmo: false, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Performance", eatingOccasion: "Pre-Workout" } },
  { upc: "045678000011", description: "ElectroPlus Hydration Powder – Lemon Lime", brand: "ElectroPlus", company: "Peak Performance Brands", category: "Supplements", subcategory: "Sports Nutrition", daysAgoLaunched: 210, patternType: "steady", baseVelocity: 31, launchTdp: 420, priceLatest: 19.99, promoMix: 0.15, attributes: { form: "Powder", flavor: "Lemon Lime", brandPositioning: "Hydration", functionalIngredient: "Electrolytes", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Hydration", eatingOccasion: "Workout" } },
  { upc: "045678000012", description: "ZincShield Immune Gummies – Orange", brand: "ZincShield", company: "Clarity Wellness", category: "Supplements", subcategory: "Immune Support", daysAgoLaunched: 100, patternType: "sleeper", baseVelocity: 24, launchTdp: 280, priceLatest: 17.99, promoMix: 0.12, attributes: { form: "Gummies", flavor: "Orange", brandPositioning: "Immune", functionalIngredient: "Zinc + Vitamin D", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Immune Support", eatingOccasion: "Daily" } },
  { upc: "045678000013", description: "TurmericMax Anti-Inflammatory – Ginger Blend", brand: "TurmericMax", company: "Elevate Natural Foods", category: "Supplements", subcategory: "Anti-Inflammatory", daysAgoLaunched: 480, patternType: "steady", baseVelocity: 29, launchTdp: 400, priceLatest: 24.99, promoMix: 0.13, attributes: { form: "Capsules", flavor: "Unflavored", brandPositioning: "Anti-Inflammatory", functionalIngredient: "Turmeric + Black Pepper", isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Anti-Inflammatory", eatingOccasion: "Daily" } },
  { upc: "045678000014", description: "MagnesiumCalm Powder – Berry", brand: "MagnesiumCalm", company: "Clarity Wellness", category: "Supplements", subcategory: "Sleep & Stress", daysAgoLaunched: 60, patternType: "steady", baseVelocity: 27, launchTdp: 230, priceLatest: 29.99, promoMix: 0.10, attributes: { form: "Powder", flavor: "Berry", brandPositioning: "Relaxation", functionalIngredient: "Magnesium Glycinate", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: true, isProteinFocused: false, healthFocus: "Sleep", eatingOccasion: "Evening" } },
  { upc: "045678000015", description: "CoQ10 Heart Health Capsules", brand: "OmegaPlus", company: "Clarity Wellness", category: "Supplements", subcategory: "Heart Health", daysAgoLaunched: 550, patternType: "fader", baseVelocity: 18, launchTdp: 310, priceLatest: 32.99, promoMix: 0.22, attributes: { form: "Capsules", flavor: "Unflavored", brandPositioning: "Heart Health", functionalIngredient: "CoQ10", isOrganic: false, isNonGmo: false, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Heart Health", eatingOccasion: "Daily" } },
  { upc: "045678000016", description: "B12 Boost Energy Gummies – Raspberry", brand: "VitaGlow", company: "Clarity Wellness", category: "Supplements", subcategory: "Energy Support", daysAgoLaunched: 85, patternType: "sleeper", baseVelocity: 21, launchTdp: 200, priceLatest: 16.99, promoMix: 0.11, attributes: { form: "Gummies", flavor: "Raspberry", brandPositioning: "Energy", functionalIngredient: "B12 + Iron", isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Energy", eatingOccasion: "Morning" } },

  // ─── FROZEN MEALS ──────────────────────────────────────────────────────────
  { upc: "056789000001", description: "FreshBowl Korean BBQ Cauliflower Rice", brand: "FreshBowl", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Asian-Inspired", daysAgoLaunched: 380, patternType: "winner", baseVelocity: 22, launchTdp: 540, priceLatest: 7.99, promoMix: 0.13, attributes: { form: "Bowl", flavor: "Korean BBQ", brandPositioning: "Better-for-You", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "Low Carb", eatingOccasion: "Lunch / Dinner" } },
  { upc: "056789000002", description: "FreshBowl Mediterranean Grain Bowl", brand: "FreshBowl", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Grain Bowls", daysAgoLaunched: 250, patternType: "winner", baseVelocity: 19, launchTdp: 490, priceLatest: 7.99, promoMix: 0.14, attributes: { form: "Bowl", flavor: "Mediterranean", brandPositioning: "Better-for-You", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: false, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Balanced Nutrition", eatingOccasion: "Lunch / Dinner" } },
  { upc: "056789000003", description: "CleanEats Turkey Meatballs + Zucchini", brand: "CleanEats", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "High Protein", daysAgoLaunched: 310, patternType: "winner", baseVelocity: 18, launchTdp: 460, priceLatest: 8.49, promoMix: 0.12, attributes: { form: "Entrée", flavor: "Italian", brandPositioning: "Clean Label", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "High Protein", eatingOccasion: "Dinner" } },
  { upc: "056789000004", description: "CleanEats Chicken Tikka Masala", brand: "CleanEats", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "International", daysAgoLaunched: 190, patternType: "steady", baseVelocity: 15, launchTdp: 380, priceLatest: 8.49, promoMix: 0.15, attributes: { form: "Entrée", flavor: "Indian", brandPositioning: "Global Cuisine", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Balanced Nutrition", eatingOccasion: "Dinner" } },
  { upc: "056789000005", description: "PlantHarvest Lentil Curry", brand: "PlantHarvest", company: "Elevate Natural Foods", category: "Frozen Meals", subcategory: "Plant-Based", daysAgoLaunched: 440, patternType: "steady", baseVelocity: 14, launchTdp: 420, priceLatest: 6.99, promoMix: 0.17, attributes: { form: "Bowl", flavor: "Indian Spiced", brandPositioning: "Plant-Based", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Plant-Based", eatingOccasion: "Lunch / Dinner" } },
  { upc: "056789000006", description: "PlantHarvest Vegan Mushroom Risotto", brand: "PlantHarvest", company: "Elevate Natural Foods", category: "Frozen Meals", subcategory: "Plant-Based", daysAgoLaunched: 145, patternType: "steady", baseVelocity: 12, launchTdp: 290, priceLatest: 7.49, promoMix: 0.16, attributes: { form: "Bowl", flavor: "Mushroom Herb", brandPositioning: "Plant-Based", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Plant-Based", eatingOccasion: "Dinner" } },
  { upc: "056789000007", description: "SlimFit Teriyaki Salmon Bowl", brand: "SlimFit", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Seafood", daysAgoLaunched: 200, patternType: "winner", baseVelocity: 21, launchTdp: 410, priceLatest: 9.99, promoMix: 0.11, attributes: { form: "Bowl", flavor: "Teriyaki", brandPositioning: "Lean & Fit", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "High Protein", eatingOccasion: "Lunch / Dinner" } },
  { upc: "056789000008", description: "SlimFit Shrimp Fried Cauliflower Rice", brand: "SlimFit", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Asian-Inspired", daysAgoLaunched: 95, patternType: "sleeper", baseVelocity: 13, launchTdp: 250, priceLatest: 8.99, promoMix: 0.14, attributes: { form: "Bowl", flavor: "Asian", brandPositioning: "Lean & Fit", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "Low Carb", eatingOccasion: "Lunch / Dinner" } },
  { upc: "056789000009", description: "WholeMeal Shepherd's Pie – Beef & Veggies", brand: "WholeMeal", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Comfort Food", daysAgoLaunched: 470, patternType: "fader", baseVelocity: 10, launchTdp: 350, priceLatest: 7.99, promoMix: 0.28, attributes: { form: "Entrée", flavor: "Classic", brandPositioning: "Comfort", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: null, eatingOccasion: "Dinner" } },
  { upc: "056789000010", description: "NutriKids Mac & Cauliflower (Hidden Veggies)", brand: "NutriKids", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Kids Meals", daysAgoLaunched: 280, patternType: "steady", baseVelocity: 13, launchTdp: 390, priceLatest: 5.99, promoMix: 0.20, attributes: { form: "Entrée", flavor: "Cheese", brandPositioning: "Kids Health", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Kids Nutrition", eatingOccasion: "Lunch" } },
  { upc: "056789000011", description: "PastaPlant Zucchini Noodle Bolognese", brand: "PastaPlant", company: "Elevate Natural Foods", category: "Frozen Meals", subcategory: "Plant-Based", daysAgoLaunched: 135, patternType: "sleeper", baseVelocity: 11, launchTdp: 220, priceLatest: 8.49, promoMix: 0.13, attributes: { form: "Entrée", flavor: "Italian", brandPositioning: "Plant-Based", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: false, healthFocus: "Plant-Based", eatingOccasion: "Dinner" } },
  { upc: "056789000012", description: "OrchardKitchen Stuffed Peppers", brand: "OrchardKitchen", company: "WildRoots Co.", category: "Frozen Meals", subcategory: "Comfort Food", daysAgoLaunched: 390, patternType: "fader", baseVelocity: 9, launchTdp: 280, priceLatest: 6.99, promoMix: 0.32, attributes: { form: "Entrée", flavor: "Italian", brandPositioning: "Artisan", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: null, eatingOccasion: "Dinner" } },
  { upc: "056789000013", description: "GrillMaster Grass-Fed Beef Burger Patties", brand: "GrillMaster", company: "Peak Performance Brands", category: "Frozen Meals", subcategory: "Proteins", daysAgoLaunched: 510, patternType: "steady", baseVelocity: 17, launchTdp: 480, priceLatest: 10.99, promoMix: 0.18, attributes: { form: "Patties", flavor: "Classic Beef", brandPositioning: "Premium Quality", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: true, isVegan: false, isKeto: true, isProteinFocused: true, healthFocus: "High Protein", eatingOccasion: "Dinner" } },
  { upc: "056789000014", description: "FreezeFrame Breakfast Burrito – Egg & Veggie", brand: "FreezeFrame", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Breakfast", daysAgoLaunched: 165, patternType: "steady", baseVelocity: 14, launchTdp: 340, priceLatest: 4.99, promoMix: 0.20, attributes: { form: "Burrito", flavor: "Egg & Veggie", brandPositioning: "Better-for-You", functionalIngredient: null, isOrganic: false, isNonGmo: true, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: true, healthFocus: "Balanced Nutrition", eatingOccasion: "Breakfast" } },
  { upc: "056789000015", description: "WokWise Chicken Fried Rice – Lower Sodium", brand: "WokWise", company: "FreshBowl Meals", category: "Frozen Meals", subcategory: "Asian-Inspired", daysAgoLaunched: 350, patternType: "fader", baseVelocity: 11, launchTdp: 420, priceLatest: 6.49, promoMix: 0.25, attributes: { form: "Bowl", flavor: "Asian", brandPositioning: "Value", functionalIngredient: null, isOrganic: false, isNonGmo: false, isGlutenFree: false, isVegan: false, isKeto: false, isProteinFocused: false, healthFocus: "Lower Sodium", eatingOccasion: "Lunch / Dinner" } },
  { upc: "056789000016", description: "SimpleMeal Quinoa & Black Bean Bowl", brand: "SimpleMeal", company: "Elevate Natural Foods", category: "Frozen Meals", subcategory: "Plant-Based", daysAgoLaunched: 50, patternType: "sleeper", baseVelocity: 10, launchTdp: 160, priceLatest: 6.99, promoMix: 0.13, attributes: { form: "Bowl", flavor: "Mexican Spiced", brandPositioning: "Plant-Based", functionalIngredient: null, isOrganic: true, isNonGmo: true, isGlutenFree: true, isVegan: true, isKeto: false, isProteinFocused: true, healthFocus: "Plant-Based", eatingOccasion: "Lunch / Dinner" } },
];

export const LAUNCHES: Launch[] = SPECS.map((spec) => buildLaunch(spec));

export function getLaunchByUpc(upc: string): Launch | undefined {
  return LAUNCHES.find((l) => l.upc === upc);
}

export function getLaunchsByCategory(category: Launch["category"]): Launch[] {
  return LAUNCHES.filter((l) => l.category === category);
}

export function getWinners(launches = LAUNCHES): Launch[] {
  return launches.filter((l) => l.launchQualityScore >= 70);
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
