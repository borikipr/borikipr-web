import type {
  AnalyticsDevice,
  AnalyticsEventSummary,
  AnalyticsOverview,
  AnalyticsRealtime,
  AnalyticsTopPage,
  AnalyticsTrafficSource,
} from "./types";

export function mergeOverview(items: Array<AnalyticsOverview | null>) {
  return items.reduce<AnalyticsOverview>((acc, item) => {
    if (!item) return acc;

    return {
      visitors: (acc.visitors ?? 0) + (item.visitors ?? 0),
      pageviews: (acc.pageviews ?? 0) + (item.pageviews ?? 0),
      sessions: (acc.sessions ?? 0) + (item.sessions ?? 0),
      events: (acc.events ?? 0) + (item.events ?? 0),
      conversions: (acc.conversions ?? 0) + (item.conversions ?? 0),
    };
  }, {});
}

export function mergeRealtime(items: Array<AnalyticsRealtime | null>) {
  return items.reduce<AnalyticsRealtime>(
    (acc, item) => {
      if (!item) return acc;

      return {
        activeUsers: (acc.activeUsers ?? 0) + (item.activeUsers ?? 0),
        activePages: [...acc.activePages, ...item.activePages],
      };
    },
    { activePages: [] }
  );
}

export function combineTopPages(items: AnalyticsTopPage[][]) {
  return items.flat();
}

export function combineTrafficSources(items: AnalyticsTrafficSource[][]) {
  return items.flat();
}

export function combineDevices(items: AnalyticsDevice[][]) {
  return items.flat();
}

export function combineEvents(items: AnalyticsEventSummary[][]) {
  return items.flat();
}
