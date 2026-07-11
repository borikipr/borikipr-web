export type AnalyticsChartDatum = {
  name: string;
  value: number;
  detail?: string;
};

export type AnalyticsLineChartDatum = {
  name: string;
  visitors?: number;
  pageviews?: number;
};

export const analyticsChartColors = {
  blue: "#11518B",
  gold: "#D4AF37",
  lightBlue: "#6EA7D4",
  neutral: "#9CA3AF",
  darkNeutral: "#4B5563",
  grid: "#E8E8E8",
};

export const analyticsPalette = [
  analyticsChartColors.blue,
  analyticsChartColors.gold,
  analyticsChartColors.lightBlue,
  analyticsChartColors.darkNeutral,
  analyticsChartColors.neutral,
];

export function formatChartNumber(value: number) {
  return value.toLocaleString("es-PR");
}

export function chartTooltipStyle() {
  return {
    border: "1px solid #e8e8e8",
    borderRadius: 12,
    boxShadow: "0 18px 40px rgba(0,0,0,0.12)",
    fontSize: 12,
  };
}

