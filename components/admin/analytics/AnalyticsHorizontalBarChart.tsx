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

export function AnalyticsHorizontalBarChart({
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

  const chartHeight = Math.max(height, data.length * 44 + 52);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
      >
        <CartesianGrid horizontal={false} stroke={analyticsChartColors.grid} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickFormatter={formatChartNumber}
          tick={{ fill: "#4d4d4d", fontSize: 11 }}
        />
        <YAxis
          dataKey="name"
          type="category"
          width={132}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#000000", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "rgba(17, 81, 139, 0.06)" }}
          formatter={(value) => [formatChartNumber(Number(value)), "Total"]}
          contentStyle={chartTooltipStyle()}
        />
        <Bar
          dataKey="value"
          fill={analyticsChartColors.blue}
          radius={[0, 8, 8, 0]}
          barSize={18}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

