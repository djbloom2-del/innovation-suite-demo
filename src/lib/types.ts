export type Category = "Bars" | "Beverages" | "Snacks" | "Supplements" | "Frozen Meals";

export type PatternType = "winner" | "steady" | "fader" | "sleeper";

export type PackFormat = "Single" | "Multipack" | "Family" | "Trial" | "Variety Pack";

export type InnovationType =
  | "Flavor Extension"
  | "New to World"
  | "Format Extension"
  | "Category Extension"
  | "Pack Size Variant"
  | "Unclassified";

export type LaunchOutcome =
  | "Early Stage"   // age < 52w — Y1 not complete
  | "Year 1"        // 52 ≤ age < 104w — Y1 complete, awaiting Y2
  | "Successful"    // 104+ weeks AND (dollarsY2 > dollarsY1 OR velocityY2 > velocityY1)
  | "Fading"        // 104+ weeks AND Y2 criteria NOT met
  | "Sustaining"    // 156+ weeks AND dollarsY3 > dollarsY2
  | "Declining";    // 156+ weeks AND dollarsY3 ≤ dollarsY2

export type VelocityTier = "Top" | "Mid" | "Bottom";

export interface AttributeSet {
  form: string;
  flavor: string;
  packFormat: PackFormat;
  brandPositioning: string;
  functionalIngredient: string | null;
  isOrganic: boolean;
  isNonGmo: boolean;
  isGlutenFree: boolean;
  isVegan: boolean;
  isKeto: boolean;
  isProteinFocused: boolean;
  healthFocus: string | null;
  eatingOccasion: string | null;
}

export type Retailer = "Natural" | "Conventional" | "Club" | "Mass";

export interface Launch {
  upc: string;
  description: string;
  brand: string;
  company: string;
  category: Category;
  subcategory: string;
  retailer: Retailer;
  firstSeenDate: string; // ISO date YYYY-MM-DD
  launchCohortMonth: string; // YYYY-MM-DD (first of month)
  ageWeeks: number;
  patternType: PatternType;
  // latest snapshot
  dollarsLatest: number;
  velocityLatest: number; // $ per store selling
  tdpLatest: number; // total distribution points
  storesSellingLatest: number;
  priceLatest: number;
  basePrice: number;      // everyday non-promoted shelf price (>= priceLatest)
  promoDependency: number; // 0–1
  baseMix: number; // 0–1
  priceIndexVsCategory: number; // 1.0 = at category avg
  dollarShareCategory: number; // 0–1
  // growth
  growthRate12w: number | null;
  growthRateYago: number | null;
  // milestones
  dollars4w: number;
  dollars12w: number;
  dollars26w: number | null;
  dollars52w: number | null;
  distributionGainSinceLaunch: number;
  // survival
  survived12w: boolean;
  survived26w: boolean | null;
  survived52w: boolean | null;
  // benchmarks
  velocityPercentileVsCohort: number; // 0–100
  dollarsPercentileVsCohort: number; // 0–100
  distributionPercentileVsCohort: number; // 0–100
  // composite score
  launchQualityScore: number; // 0–100
  innovationType: InnovationType;
  // Year-over-year lifecycle
  dollarsY1: number | null;
  dollarsY2: number | null;
  dollarsY3: number | null;
  velocityY1: number | null;
  velocityY2: number | null;
  velocityY3: number | null;
  growthY1toY2: number | null;   // (dollarsY2 - dollarsY1) / dollarsY1
  growthY2toY3: number | null;   // (dollarsY3 - dollarsY2) / dollarsY2
  launchOutcome: LaunchOutcome;
  velocityTier: VelocityTier;    // Top/Mid/Bottom third of category velocity
  // attributes
  attributes: AttributeSet;
}

export interface WeeklyPeriod {
  upc: string;
  endDate: string;
  ageWeeks: number;
  dollars: number;
  velocity: number;
  tdp: number;
  storesSelling: number;
  price: number;
  promoDependency: number;
}

export interface Brand {
  name: string;
  company: string;
  categories: Category[];
  totalDollars: number;
  coreDollars: number;
  newItemDollars: number;
  totalDollarsPrior: number;
  pctGrowthFromNewItems: number;
  launchCount: number;
  winnerCount: number;
  winRate: number;
  innovationScore: number; // $ per launch
  cohortQualityTrend: { quarter: string; medianScore: number }[];
}

export interface CategoryBenchmark {
  category: Category;
  medianVelocity4w: number;
  medianVelocity12w: number;
  medianVelocity26w: number;
  medianTdp12w: number;
  survivalRate12w: number;
  survivalRate26w: number;
  survivalRate52w: number;
  winRate: number; // top quartile %
  avgLaunchQualityScore: number;
  avgPrice: number;
  totalDollars: number;
  growthRate: number;
  launchCountLast12m: number;
  crowdingScore: number; // 0–10
}

export interface AttributePerf {
  attributeName: string;
  attributeValue: string;
  category: Category;
  launchCount: number;
  winnerCount: number;
  winRate: number;
  overindexVsAll: number; // 1.0 = same as baseline
  medianVelocity: number;
  medianPriceIndex: number;
  medianPromoDependency: number;
  trend: "rising" | "stable" | "declining";
  penetrationRate: number; // share of launches with this attribute
}

export interface AttributeCombo {
  attributes: string[];
  launchCount: number;
  winnerCount: number;
  winRate: number;
  medianDollars26w: number;
  lift: number; // win_rate / baseline
}

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

export interface CohortRow {
  cohortMonth: string;
  category: Category;
  launchCount: number;
  medianScore: number;
  survivalRate12w: number;
  survivalRate26w: number;
  avgVelocity12w: number;
}

export interface WhitespaceOpportunity {
  category: Category;
  attributeName: string;
  attributeValue: string;
  winRate: number;
  penetrationRate: number;
  growthSignal: number;
  whitespaceScore: number; // 0–100
  description: string;
}

export interface LaunchFilters {
  categories: Category[];
  brands: string[];
  ageBands: string[];
  priceTiers: string[];
  survived26w: boolean | null;
  attributes: string[];
  innovationTypes: InnovationType[];
  launchOutcomes: LaunchOutcome[];
  velocityTiers: VelocityTier[];
  sortBy: "qualityScore" | "growth" | "velocity" | "distribution";
  searchQuery: string;
}
