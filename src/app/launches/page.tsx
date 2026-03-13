"use client";

import { useState, useMemo } from "react";
import type { Launch, LaunchFilters } from "@/lib/types";
import { LAUNCHES } from "@/data/launches";
import { applyLaunchFilters, DEFAULT_FILTERS } from "@/lib/filters";
import { LaunchFilterPanel } from "@/components/launches/LaunchFilters";
import { LaunchCard } from "@/components/launches/LaunchCard";
import { LaunchDetailDrawer } from "@/components/launches/LaunchDetailDrawer";

export default function LaunchExplorer() {
  const [filters, setFilters] = useState<LaunchFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Launch | null>(null);

  const filtered = useMemo(() => applyLaunchFilters(LAUNCHES, filters), [filters]);

  return (
    <div className="flex gap-5 max-w-7xl mx-auto">
      <LaunchFilterPanel filters={filters} onChange={setFilters} total={filtered.length} />

      <div className="flex-1 min-w-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-sm">
            No launches match your filters. Try clearing some criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((l) => (
              <LaunchCard key={l.upc} launch={l} onClick={setSelected} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <LaunchDetailDrawer launch={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
