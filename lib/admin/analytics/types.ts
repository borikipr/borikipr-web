export type AnalyticsRange = "today" | "7d" | "30d" | "90d";

export type AnalyticsProviderId = "ga4" | "clarity" | "vercel" | "cloudflare";

export type ProviderConnectionStatus =
  | "not_configured"
  | "connected"
  | "unavailable"
  | "rate_limited"
  | "planned";

export type AnalyticsOverview = {
  visitors?: number;
  pageviews?: number;
  sessions?: number;
  events?: number;
  conversions?: number;
};

export type AnalyticsRealtime = {
  activeUsers?: number;
  activePages: Array<{
    path: string;
    users: number;
  }>;
};

export type AnalyticsTopPage = {
  path: string;
  title?: string;
  pageviews: number;
  visitors?: number;
};

export type AnalyticsTrafficSource = {
  source: string;
  medium?: string;
  visitors: number;
};

export type AnalyticsDevice = {
  device: "mobile" | "desktop" | "tablet" | "unknown";
  visitors: number;
};

export type AnalyticsEventSummary = {
  name: string;
  count: number;
  visitors?: number;
};

export type AnalyticsProviderStatus = {
  id: AnalyticsProviderId;
  name: string;
  status: ProviderConnectionStatus;
  description: string;
};

export type AdminAnalyticsDashboard = {
  range: AnalyticsRange;
  overview: AnalyticsOverview;
  realtime: AnalyticsRealtime;
  topPages: AnalyticsTopPage[];
  trafficSources: AnalyticsTrafficSource[];
  devices: AnalyticsDevice[];
  events: AnalyticsEventSummary[];
  providers: AnalyticsProviderStatus[];
};

export type AnalyticsProvider = {
  id: AnalyticsProviderId;
  name: string;
  description: string;
  isConfigured: () => boolean;
  getStatus: () => Promise<AnalyticsProviderStatus> | AnalyticsProviderStatus;
  getOverview: (
    range: AnalyticsRange
  ) => Promise<AnalyticsOverview | null> | AnalyticsOverview | null;
  getRealtime: () => Promise<AnalyticsRealtime | null> | AnalyticsRealtime | null;
  getTopPages: (
    range: AnalyticsRange
  ) => Promise<AnalyticsTopPage[]> | AnalyticsTopPage[];
  getTrafficSources: (
    range: AnalyticsRange
  ) => Promise<AnalyticsTrafficSource[]> | AnalyticsTrafficSource[];
  getDevices: (
    range: AnalyticsRange
  ) => Promise<AnalyticsDevice[]> | AnalyticsDevice[];
  getEvents: (
    range: AnalyticsRange
  ) => Promise<AnalyticsEventSummary[]> | AnalyticsEventSummary[];
};
