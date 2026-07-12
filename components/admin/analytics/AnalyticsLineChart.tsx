"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
  type AnalyticsLineChartDatum,
} from "./chart-utils";

export function AnalyticsLineChart({
  data,
  emptyMessage = "Los datos de tendencia no están disponibles en la respuesta actual del proveedor.",
  height = 260,
}: {
  data: AnalyticsLineChartDatum[];
  emptyMessage?: string;
  height?: number;
}) {
  if (data.length === 0) {
    return <AnalyticsEmptyState message={emptyMessage} />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
        <Tooltip contentStyle={chartTooltipStyle()} />
        <Legend />
        <Line
          type="monotone"
          dataKey="visitors"
          name="Visitantes"
          stroke={analyticsChartColors.blue}
          strokeWidth={3}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="pageviews"
          name="Páginas vistas"
          stroke={analyticsChartColors.gold}
          strokeWidth={3}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
