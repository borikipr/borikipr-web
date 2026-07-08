import type { AnalyticsRange } from "./types";

export function getAnalyticsRevalidateSeconds(range: AnalyticsRange) {
  switch (range) {
    case "today":
      return 120;
    case "7d":
    case "30d":
      return 600;
    case "90d":
    default:
      return 1800;
  }
}

export const ANALYTICS_REALTIME_REVALIDATE_SECONDS = 30;
