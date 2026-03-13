"use client";

import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getTopBrandsByGrowth } from "@/data/brands";
import { categoryColor } from "@/lib/utils";

export function FastestGrowingBrands() {
  const brands = getTopBrandsByGrowth(8);
  const data = brands.map((b) => ({
    name: b.name,
    growth: Math.round(((b.totalDollars - b.totalDollarsPrior) / (b.totalDollarsPrior || 1)) * 100),
    category: b.categories[0],
  }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">Fastest Growing Brands</h2>
        <Link href="/brands" className="text-xs text-blue-600 hover:underline">View all →</Link>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
          <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={72} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v: any) => [`${v}%`, "Growth"]}
            contentStyle={{ fontSize: 11, border: "1px solid #e2e8f0" }}
          />
          <Bar dataKey="growth" radius={[0, 4, 4, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={categoryColor(entry.category)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
