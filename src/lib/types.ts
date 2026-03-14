export type Category = "Bars" | "Beverages" | "Snacks" | "Supplements" | "Frozen Meals";

export type PatternType = "winner" | "steady" | "fader" | "sleeper";

export interface AttributeSet {
  form: string;
  flavor: string;
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
  sortBy: "qualityScore" | "growth" | "velocity" | "distribution";
  searchQuery: string;
}
