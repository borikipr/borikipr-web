import { BetaAnalyticsDataClient } from "@google-analytics/data";
import type {
  AnalyticsDevice,
  AnalyticsEventSummary,
  AnalyticsOverview,
  AnalyticsProvider,
  AnalyticsRealtime,
  AnalyticsTopPage,
  AnalyticsTrafficSource,
} from "../types";

const propertyId = process.env.GA4_PROPERTY_ID?.trim();
const clientEmail = process.env.GA4_CLIENT_EMAIL?.trim();
const privateKey = process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, "\n");

function isGa4Configured() {
  return Boolean(propertyId && clientEmail && privateKey);
}

function getPropertyName() {
  return `properties/${propertyId}`;
}

function getClient() {
  if (!isGa4Configured()) return null;

  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });
}

function getStartDate(range: "today" | "7d" | "30d" | "90d") {
  switch (range) {
    case "today":
      return "today";
    case "7d":
      return "7daysAgo";
    case "90d":
      return "90daysAgo";
    case "30d":
    default:
      return "30daysAgo";
  }
}

function metricValue(value: string | null | undefined) {
  return Number(value ?? 0);
}

export const ga4Provider: AnalyticsProvider = {
  id: "ga4",
  name: "Google Analytics 4",
  description: "Preparado para conectarse al GA4 Data API en una fase futura.",
  isConfigured: isGa4Configured,
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      status: this.isConfigured() ? "connected" : "not_configured",
      description: this.isConfigured()
        ? "Conectado al GA4 Data API para metricas agregadas."
        : this.description,
    };
  },
  async getOverview(range) {
    const client = getClient();
    if (!client) return null;

    const [response] = await client.runReport({
      property: getPropertyName(),
      dateRanges: [{ startDate: getStartDate(range), endDate: "today" }],
      metrics: [
        { name: "totalUsers" },
        { name: "screenPageViews" },
        { name: "sessions" },
        { name: "eventCount" },
      ],
    });

    const values = response.rows?.[0]?.metricValues ?? [];

    return {
      visitors: metricValue(values[0]?.value),
      pageviews: metricValue(values[1]?.value),
      sessions: metricValue(values[2]?.value),
      events: metricValue(values[3]?.value),
    } satisfies AnalyticsOverview;
  },
  async getRealtime() {
    const client = getClient();
    if (!client) return null;

    const [response] = await client.runRealtimeReport({
      property: getPropertyName(),
      metrics: [{ name: "activeUsers" }],
    });

    return {
      activeUsers: metricValue(response.rows?.[0]?.metricValues?.[0]?.value),
      activePages: [],
    } satisfies AnalyticsRealtime;
  },
  async getTopPages(range) {
    const client = getClient();
    if (!client) return [];

    const [response] = await client.runReport({
      property: getPropertyName(),
      dateRanges: [{ startDate: getStartDate(range), endDate: "today" }],
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
      limit: 8,
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    });

    return (
      response.rows?.map((row) => ({
        path: row.dimensionValues?.[0]?.value || "/",
        title: row.dimensionValues?.[1]?.value || undefined,
        pageviews: metricValue(row.metricValues?.[0]?.value),
        visitors: metricValue(row.metricValues?.[1]?.value),
      })) ?? []
    ) satisfies AnalyticsTopPage[];
  },
  async getTrafficSources(range) {
    const client = getClient();
    if (!client) return [];

    const [response] = await client.runReport({
      property: getPropertyName(),
      dateRanges: [{ startDate: getStartDate(range), endDate: "today" }],
      dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
      metrics: [{ name: "totalUsers" }],
      limit: 8,
      orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
    });

    return (
      response.rows?.map((row) => ({
        source: row.dimensionValues?.[0]?.value || "unknown",
        medium: row.dimensionValues?.[1]?.value || undefined,
        visitors: metricValue(row.metricValues?.[0]?.value),
      })) ?? []
    ) satisfies AnalyticsTrafficSource[];
  },
  async getDevices(range) {
    const client = getClient();
    if (!client) return [];

    const [response] = await client.runReport({
      property: getPropertyName(),
      dateRanges: [{ startDate: getStartDate(range), endDate: "today" }],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
    });

    return (
      response.rows?.map((row) => {
        const device = row.dimensionValues?.[0]?.value;

        return {
          device:
            device === "mobile" || device === "desktop" || device === "tablet"
              ? device
              : "unknown",
          visitors: metricValue(row.metricValues?.[0]?.value),
        };
      }) ?? []
    ) satisfies AnalyticsDevice[];
  },
  async getEvents(range) {
    const client = getClient();
    if (!client) return [];

    const [response] = await client.runReport({
      property: getPropertyName(),
      dateRanges: [{ startDate: getStartDate(range), endDate: "today" }],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
      limit: 12,
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    });

    return (
      response.rows?.map((row) => ({
        name: row.dimensionValues?.[0]?.value || "unknown",
        count: metricValue(row.metricValues?.[0]?.value),
        visitors: metricValue(row.metricValues?.[1]?.value),
      })) ?? []
    ) satisfies AnalyticsEventSummary[];
  },
};
