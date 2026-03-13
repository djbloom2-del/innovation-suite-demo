"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  data: number[];
  color?: string;
  height?: number;
  showTooltip?: boolean;
}

export function Sparkline({ data, color = "#2563eb", height = 32, showTooltip = false }: Props) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        {showTooltip && (
          <Tooltip
            contentStyle={{ fontSize: 11, padding: "4px 8px", border: "1px solid #e2e8f0" }}
            formatter={(v: any) => [`$${(v as number).toFixed(0)}`, ""]}
            labelFormatter={() => ""}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
