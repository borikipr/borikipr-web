"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalyticsEmptyState } from "./AnalyticsEmptyState";
import {
  analyticsChartColors,
  chartTooltipStyle,
  formatChartNumber,
  type AnalyticsChartDatum,
} from "./chart-utils";

export function AnalyticsBarChart({
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
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={analyticsChartColors.grid} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#4d4d4d", fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={formatChartNumber}
          tick={{ fill: "#4d4d4d", fontSize: 11 }}
        />
        <Tooltip
          cursor={{ fill: "rgba(17, 81, 139, 0.06)" }}
          formatter={(value) => [formatChartNumber(Number(value)), "Total"]}
          contentStyle={chartTooltipStyle()}
        />
        <Bar
          dataKey="value"
          fill={analyticsChartColors.blue}
          radius={[8, 8, 0, 0]}
          barSize={34}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

