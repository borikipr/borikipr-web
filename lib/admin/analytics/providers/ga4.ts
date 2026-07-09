import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { AnalyticsProviderError } from "../errors";
import type {
  AnalyticsDevice,
  AnalyticsEventSummary,
  AnalyticsOverview,
  AnalyticsProvider,
  AnalyticsRealtime,
  AnalyticsTopPage,
  AnalyticsTrafficSource,
  ProviderConnectionStatus,
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

function configuredIdLooksLikeWebStreamId() {
  return Boolean(propertyId && /^\d{10,}$/.test(propertyId));
}

function classifyGa4Error(error: unknown): {
  status: ProviderConnectionStatus;
  message: string;
} {
  const errorWithCode = error as Error & { code?: number | string; details?: string };
  const code = String(errorWithCode.code ?? "");
  const message = `${errorWithCode.message ?? ""} ${errorWithCode.details ?? ""}`;
  const normalized = message.toLowerCase();

  if (configuredIdLooksLikeWebStreamId()) {
    return {
      status: "invalid_property_id",
      message:
        "Configured GA4_PROPERTY_ID appears to be a Web Data Stream ID. The Analytics Data API requires the numeric GA4 Property ID.",
    };
  }

  if (
    normalized.includes("api has not been used") ||
    normalized.includes("disabled") ||
    normalized.includes("service disabled") ||
    normalized.includes("access not configured")
  ) {
    return {
      status: "api_not_enabled",
      message: "Google Analytics Data API is not enabled for this Google Cloud project.",
    };
  }

  if (
    code === "7" ||
    normalized.includes("permission denied") ||
    normalized.includes("permission_denied")
  ) {
    return {
      status: "permission_denied",
      message: "Verify that the Service Account has Viewer access to the GA4 Property.",
    };
  }

  if (
    normalized.includes("private key") ||
    normalized.includes("pem") ||
    normalized.includes("decoder routines") ||
    normalized.includes("bad decrypt")
  ) {
    return {
      status: "invalid_private_key",
      message: "Invalid private key",
    };
  }

  if (
    code === "5" ||
    (code === "3" && normalized.includes("property")) ||
    normalized.includes("property not found") ||
    normalized.includes("invalid property")
  ) {
    return {
      status: "invalid_property_id",
      message: "Invalid GA4 property ID.",
    };
  }

  if (
    code === "4" ||
    normalized.includes("deadline") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out")
  ) {
    return {
      status: "timeout",
      message: "Timeout contacting Google",
    };
  }

  if (
    code === "14" ||
    normalized.includes("unavailable") ||
    normalized.includes("service unavailable") ||
    normalized.includes("google api")
  ) {
    return {
      status: "api_error",
      message: "Google API unavailable",
    };
  }

  return {
    status: "unknown_error",
    message: "Unknown error",
  };
}

function throwGa4Error(error: unknown): never {
  const classified = classifyGa4Error(error);
  const errorWithCode = error as Error & { code?: unknown; details?: unknown };

  throw new AnalyticsProviderError(classified.message, "ga4", classified.status, {
    code: errorWithCode.code,
    details: errorWithCode.details,
  });
}

async function runGa4Request<T>(request: () => Promise<T>) {
  try {
    return await request();
  } catch (error) {
    throwGa4Error(error);
  }
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
        : "GA4 server credentials are not configured.",
    };
  },
  async getOverview(range) {
    const client = getClient();
    if (!client) return null;

    const [response] = await runGa4Request(() =>
      client.runReport({
        property: getPropertyName(),
        dateRanges: [{ startDate: getStartDate(range), endDate: "today" }],
        metrics: [
          { name: "totalUsers" },
          { name: "screenPageViews" },
          { name: "sessions" },
          { name: "eventCount" },
        ],
      })
    );

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

    const [activeUsersResult, activePagesResult, recentEventsResult] =
      await Promise.all([
        runGa4Request(() =>
          client.runRealtimeReport({
            property: getPropertyName(),
            metrics: [{ name: "activeUsers" }],
          })
        ),
        runGa4Request(() =>
          client.runRealtimeReport({
            property: getPropertyName(),
            dimensions: [{ name: "unifiedScreenName" }],
            metrics: [{ name: "activeUsers" }],
            limit: 5,
            orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          })
        ),
        runGa4Request(() =>
          client.runRealtimeReport({
            property: getPropertyName(),
            dimensions: [{ name: "eventName" }],
            metrics: [{ name: "eventCount" }],
            limit: 5,
            orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
          })
        ),
      ]);
    const [activeUsersResponse] = activeUsersResult;
    const [activePagesResponse] = activePagesResult;
    const [recentEventsResponse] = recentEventsResult;

    return {
      activeUsers: metricValue(
        activeUsersResponse.rows?.[0]?.metricValues?.[0]?.value
      ),
      activePages:
        activePagesResponse.rows?.map((row) => ({
          path: row.dimensionValues?.[0]?.value || "Unknown page",
          users: metricValue(row.metricValues?.[0]?.value),
        })) ?? [],
      recentEvents:
        recentEventsResponse.rows?.map((row) => ({
          name: row.dimensionValues?.[0]?.value || "unknown",
          count: metricValue(row.metricValues?.[0]?.value),
        })) ?? [],
    } satisfies AnalyticsRealtime;
  },
  async getTopPages(range) {
    const client = getClient();
    if (!client) return [];

    const [response] = await runGa4Request(() =>
      client.runReport({
        property: getPropertyName(),
        dateRanges: [{ startDate: getStartDate(range), endDate: "today" }],
        dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
        metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
        limit: 8,
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      })
    );

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

    const [response] = await runGa4Request(() =>
      client.runReport({
        property: getPropertyName(),
        dateRanges: [{ startDate: getStartDate(range), endDate: "today" }],
        dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [{ name: "totalUsers" }],
        limit: 8,
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
      })
    );

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

    const [response] = await runGa4Request(() =>
      client.runReport({
        property: getPropertyName(),
        dateRanges: [{ startDate: getStartDate(range), endDate: "today" }],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
      })
    );

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

    const [response] = await runGa4Request(() =>
      client.runReport({
        property: getPropertyName(),
        dateRanges: [{ startDate: getStartDate(range), endDate: "today" }],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
        limit: 12,
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      })
    );

    return (
      response.rows?.map((row) => ({
        name: row.dimensionValues?.[0]?.value || "unknown",
        count: metricValue(row.metricValues?.[0]?.value),
        visitors: metricValue(row.metricValues?.[1]?.value),
      })) ?? []
    ) satisfies AnalyticsEventSummary[];
  },
};
