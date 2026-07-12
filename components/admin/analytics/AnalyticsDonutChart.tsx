"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { AnalyticsEmptyState } from "./AnalyticsEmptyState";
import {
  analyticsPalette,
  chartTooltipStyle,
  formatChartNumber,
  type AnalyticsChartDatum,
} from "./chart-utils";

export function AnalyticsDonutChart({
  data,
  emptyMessage = "No hay datos disponibles para el rango seleccionado.",
  height = 260,
}: {
  data: AnalyticsChartDatum[];
  emptyMessage?: string;
  height?: number;
}) {
  if (data.length === 0) {
    return <AnalyticsEmptyState message={emptyMessage} />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={3}
        >
          {data.map((entry, index) => (
            <Cell
              key={`${entry.name}-${index}`}
              fill={analyticsPalette[index % analyticsPalette.length]}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [formatChartNumber(Number(value)), "Total"]}
          contentStyle={chartTooltipStyle()}
        />
        <Legend
          iconType="circle"
          formatter={(value) => (
            <span className="text-xs text-[#4d4d4d]">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

