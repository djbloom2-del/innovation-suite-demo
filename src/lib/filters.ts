import type { Launch, LaunchFilters } from "./types";
import { ageLabel, priceTierLabel } from "./utils";

export function applyLaunchFilters(launches: Launch[], filters: LaunchFilters): Launch[] {
  let result = [...launches];

  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    result = result.filter(
      (l) =>
        l.description.toLowerCase().includes(q) ||
        l.brand.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q)
    );
  }

  if (filters.categories.length > 0) {
    result = result.filter((l) => filters.categories.includes(l.category));
  }

  if (filters.brands.length > 0) {
    result = result.filter(
      (l) => filters.brands.includes(l.brand) || filters.brands.includes(l.company)
    );
  }

  if (filters.ageBands.length > 0) {
    result = result.filter((l) => filters.ageBands.includes(ageLabel(l.ageWeeks)));
  }

  if (filters.priceTiers.length > 0) {
    result = result.filter((l) => filters.priceTiers.includes(priceTierLabel(l.priceLatest)));
  }

  if (filters.survived26w !== null) {
    result = result.filter((l) => l.survived26w === filters.survived26w);
  }

  if (filters.attributes.length > 0) {
    result = result.filter((l) =>
      filters.attributes.some((attr) => {
        if (attr === "Organic") return l.attributes.isOrganic;
        if (attr === "Non-GMO") return l.attributes.isNonGmo;
        if (attr === "Gluten-Free") return l.attributes.isGlutenFree;
        if (attr === "Vegan") return l.attributes.isVegan;
        if (attr === "Keto") return l.attributes.isKeto;
        if (attr === "Protein") return l.attributes.isProteinFocused;
        return false;
      })
    );
  }

  if (filters.innovationTypes.length > 0) {
    result = result.filter((l) => filters.innovationTypes.includes(l.innovationType));
  }

  if (filters.launchOutcomes.length > 0) {
    result = result.filter((l) => filters.launchOutcomes.includes(l.launchOutcome));
  }

  if (filters.velocityTiers.length > 0) {
    result = result.filter((l) => filters.velocityTiers.includes(l.velocityTier));
  }

  if (filters.channels.length > 0) {
    result = result.filter((l) => filters.channels.includes(l.channel));
  }

  // Sort
  result.sort((a, b) => {
    switch (filters.sortBy) {
      case "qualityScore":
        return b.launchQualityScore - a.launchQualityScore;
      case "growth":
        return (b.growthRate12w ?? -Infinity) - (a.growthRate12w ?? -Infinity);
      case "velocity":
        return b.velocityLatest - a.velocityLatest;
      case "distribution":
        return b.tdpLatest - a.tdpLatest;
      default:
        return b.launchQualityScore - a.launchQualityScore;
    }
  });

  return result;
}

export const DEFAULT_FILTERS: LaunchFilters = {
  categories: [],
  brands: [],
  ageBands: [],
  priceTiers: [],
  survived26w: null,
  attributes: [],
  innovationTypes: [],
  launchOutcomes: [],
  velocityTiers: [],
  channels: [],
  needStates: [],
  sortBy: "qualityScore",
  searchQuery: "",
};
