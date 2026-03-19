// ── Innovation Type Classification ────────────────────────────────────────────
//
// Classifies CPG launches into the standard 5-type taxonomy used by SPINS,
// Nielsen, and IRI. The algorithm mirrors how a real data pipeline would work:
// compare each new UPC against the brand's existing portfolio to determine
// whether this is a genuinely new bet or a line extension.
//
// Future upgrade: when connected to the full SPINS warehouse, replace
// classifyInnovationType() with a direct read of SPINS innovation coding.

import type { Launch, InnovationType } from "./types";

// ── Metadata ──────────────────────────────────────────────────────────────────

export interface InnovationTypeMeta {
  label: string;
  shortLabel: string;
  description: string;
  bgClass: string;      // Tailwind bg- class for active chip
  textClass: string;    // Tailwind text- class for inactive chip text
  borderClass: string;  // Tailwind border- class for inactive chip
  chartColor: string;   // hex for Recharts
  sortOrder: number;    // ascending — lower = shown first
}

export const INNOVATION_TYPE_META: Record<InnovationType, InnovationTypeMeta> = {
  "Flavor Extension": {
    label: "Flavor Extension",
    shortLabel: "Flavor",
    description:
      "Same brand, category, and form — new flavor or variety. Most common innovation type (~50% of launches).",
    bgClass: "bg-violet-600",
    textClass: "text-violet-700",
    borderClass: "border-violet-300",
    chartColor: "#7c3aed",
    sortOrder: 1,
  },
  "New to World": {
    label: "New to World",
    shortLabel: "New",
    description:
      "Subcategory and form combination rare across the full market. Genuinely novel territory with no established playbook.",
    bgClass: "bg-emerald-600",
    textClass: "text-emerald-700",
    borderClass: "border-emerald-300",
    chartColor: "#059669",
    sortOrder: 2,
  },
  "Format Extension": {
    label: "Format Extension",
    shortLabel: "Format",
    description:
      "Same brand and category, new physical form (e.g. a bar brand launching bites or an RTD).",
    bgClass: "bg-sky-600",
    textClass: "text-sky-700",
    borderClass: "border-sky-300",
    chartColor: "#0284c7",
    sortOrder: 3,
  },
  "Category Extension": {
    label: "Category Extension",
    shortLabel: "Cat. Ext.",
    description:
      "Brand entering a new category it doesn't currently compete in.",
    bgClass: "bg-amber-500",
    textClass: "text-amber-700",
    borderClass: "border-amber-300",
    chartColor: "#d97706",
    sortOrder: 4,
  },
  "Pack Size Variant": {
    label: "Pack Size Variant",
    shortLabel: "Pack Size",
    description:
      "Same product, different count or pack size (multipack, family, trial). Coded via packFormat attribute.",
    bgClass: "bg-slate-500",
    textClass: "text-slate-600",
    borderClass: "border-slate-300",
    chartColor: "#64748b",
    sortOrder: 5,
  },
  "Unclassified": {
    label: "Unclassified",
    shortLabel: "N/A",
    description:
      "Missing form, flavor, or subcategory data — cannot be reliably classified.",
    bgClass: "bg-rose-500",
    textClass: "text-rose-700",
    borderClass: "border-rose-300",
    chartColor: "#f43f5e",
    sortOrder: 6,
  },
};

export const INNOVATION_TYPES = Object.keys(INNOVATION_TYPE_META) as InnovationType[];

// ── Classification Engine ─────────────────────────────────────────────────────
//
// Six rules fire in priority order; the first match wins.
//
// Rule 1 — Missing data guard        → "Unclassified"
// Rule 2 — packFormat !== "Single"   → "Pack Size Variant"
// Rule 3 — Brand in new category     → "Category Extension"
// Rule 4 — Brand in category, new form → "Format Extension"
// Rule 5 — Brand in category + form  → "Flavor Extension"
// Rule 6 — Rare subcategory+form     → "New to World" (else Flavor Extension fallback)

export function classifyInnovationType(
  launch: Launch,
  allLaunches: Launch[]
): InnovationType {
  // Rule 1: Missing data guard
  if (!launch.attributes.form || !launch.attributes.flavor || !launch.subcategory) {
    return "Unclassified";
  }

  // Rule 2: Pack Size Variant — driven by explicit packFormat attribute, not string parsing
  if (launch.attributes.packFormat !== "Single") {
    return "Pack Size Variant";
  }

  // All other launches by this brand (excluding self)
  const otherByBrand = allLaunches.filter(
    (l) => l.brand === launch.brand && l.upc !== launch.upc
  );

  // Rule 3: Category Extension — brand has other products, but none in this category
  if (otherByBrand.length > 0) {
    const brandCategories = new Set(otherByBrand.map((l) => l.category));
    if (!brandCategories.has(launch.category)) {
      return "Category Extension";
    }
  }

  // Rule 4: Format Extension — brand is in this category but with a different form
  const sameBrandCategory = otherByBrand.filter((l) => l.category === launch.category);
  if (sameBrandCategory.length > 0) {
    const existingForms = new Set(sameBrandCategory.map((l) => l.attributes.form));
    if (!existingForms.has(launch.attributes.form)) {
      return "Format Extension";
    }
  }

  // Rule 5: Flavor Extension — brand is in this category with the same form
  const sameBrandCategoryForm = sameBrandCategory.filter(
    (l) => l.attributes.form === launch.attributes.form
  );
  if (sameBrandCategoryForm.length > 0) {
    return "Flavor Extension";
  }

  // Rule 6: New to World — subcategory + form combination rare across entire market (<4 items)
  const marketCount = allLaunches.filter(
    (l) =>
      l.subcategory === launch.subcategory &&
      l.attributes.form === launch.attributes.form
  ).length;

  if (marketCount < 4) {
    return "New to World";
  }

  // Fallback: brand is entering an established market space as its first item in this area.
  // Functionally this is a new product line entering a proven category — treat as Flavor Extension.
  return "Flavor Extension";
}
