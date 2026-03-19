"use client";

import { CATEGORIES } from "@/data/categories";
import { BRANDS } from "@/data/brands";
import type { LaunchFilters, InnovationType } from "@/lib/types";
import { INNOVATION_TYPE_META, INNOVATION_TYPES } from "@/lib/innovation";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal } from "lucide-react";

interface Props {
  filters: LaunchFilters;
  onChange: (f: LaunchFilters) => void;
  total: number;
}

const AGE_BANDS = ["0–12w", "13–26w", "27–52w", "52w+"];
const PRICE_TIERS = ["< $3", "$3–$6", "$6–$10", "$10+"];
const ATTR_FLAGS = ["Organic", "Non-GMO", "Gluten-Free", "Vegan", "Keto", "Protein"];
const SORT_OPTIONS = [
  { value: "qualityScore", label: "Quality Score" },
  { value: "growth", label: "Growth" },
  { value: "velocity", label: "Velocity" },
  { value: "distribution", label: "Distribution" },
] as const;

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
      )}
    >
      {label}
    </button>
  );
}

function InnovationChip({
  type,
  active,
  onClick,
}: {
  type: InnovationType;
  active: boolean;
  onClick: () => void;
}) {
  const meta = INNOVATION_TYPE_META[type];
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
        active
          ? `${meta.bgClass} text-white border-transparent`
          : `bg-white ${meta.textClass} ${meta.borderClass} hover:bg-slate-50`
      )}
    >
      {meta.shortLabel}
    </button>
  );
}

export function LaunchFilterPanel({ filters, onChange, total }: Props) {
  const set = (partial: Partial<LaunchFilters>) => onChange({ ...filters, ...partial });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shrink-0 w-60">
      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search launches…"
          value={filters.searchQuery}
          onChange={(e) => set({ searchQuery: e.target.value })}
          className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
        />
      </div>

      {/* Result count */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <SlidersHorizontal size={11} />
        <span>{total} launches</span>
      </div>

      {/* Sort */}
      <div>
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Sort By</div>
        <select
          value={filters.sortBy}
          onChange={(e) => set({ sortBy: e.target.value as LaunchFilters["sortBy"] })}
          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div>
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Category</div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              active={filters.categories.includes(c)}
              onClick={() => set({ categories: toggle(filters.categories, c) })}
            />
          ))}
        </div>
      </div>

      {/* Age Band */}
      <div>
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Age</div>
        <div className="flex flex-wrap gap-1.5">
          {AGE_BANDS.map((b) => (
            <Chip
              key={b}
              label={b}
              active={filters.ageBands.includes(b)}
              onClick={() => set({ ageBands: toggle(filters.ageBands, b) })}
            />
          ))}
        </div>
      </div>

      {/* Price Tier */}
      <div>
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Price Tier</div>
        <div className="flex flex-wrap gap-1.5">
          {PRICE_TIERS.map((p) => (
            <Chip
              key={p}
              label={p}
              active={filters.priceTiers.includes(p)}
              onClick={() => set({ priceTiers: toggle(filters.priceTiers, p) })}
            />
          ))}
        </div>
      </div>

      {/* Attributes */}
      <div>
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Attributes</div>
        <div className="flex flex-wrap gap-1.5">
          {ATTR_FLAGS.map((a) => (
            <Chip
              key={a}
              label={a}
              active={filters.attributes.includes(a)}
              onClick={() => set({ attributes: toggle(filters.attributes, a) })}
            />
          ))}
        </div>
      </div>

      {/* Innovation Type */}
      <div>
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Innovation Type</div>
        <div className="flex flex-wrap gap-1.5">
          {INNOVATION_TYPES.filter((t) => t !== "Unclassified").map((t) => (
            <InnovationChip
              key={t}
              type={t}
              active={filters.innovationTypes.includes(t)}
              onClick={() => set({ innovationTypes: toggle(filters.innovationTypes, t) })}
            />
          ))}
        </div>
      </div>

      {/* Survived 26w */}
      <div>
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Survival</div>
        <div className="flex gap-1.5">
          <Chip
            label="Survived 26w"
            active={filters.survived26w === true}
            onClick={() => set({ survived26w: filters.survived26w === true ? null : true })}
          />
          <Chip
            label="Failed"
            active={filters.survived26w === false}
            onClick={() => set({ survived26w: filters.survived26w === false ? null : false })}
          />
        </div>
      </div>

      {/* Clear */}
      {(filters.categories.length > 0 ||
        filters.ageBands.length > 0 ||
        filters.priceTiers.length > 0 ||
        filters.attributes.length > 0 ||
        filters.innovationTypes.length > 0 ||
        filters.searchQuery) && (
        <button
          onClick={() =>
            onChange({
              categories: [],
              brands: [],
              ageBands: [],
              priceTiers: [],
              survived26w: null,
              attributes: [],
              innovationTypes: [],
              sortBy: "qualityScore",
              searchQuery: "",
            })
          }
          className="w-full text-xs text-red-500 hover:text-red-600 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
