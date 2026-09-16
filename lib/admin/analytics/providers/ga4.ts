import "server-only";

import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { unstable_cache } from "next/cache";
import { getAnalyticsRevalidateSeconds } from "../cache";
import { AnalyticsProviderError } from "../errors";
import {
  aggregatePropertyCoreRows,
  mergePropertyArrivalRows,
  mergePropertyShareRows,
  PROPERTY_PERFORMANCE_EVENTS,
  type PropertyPerformanceResult,
} from "../property-performance";
import { createGa4WifAuthClient, getGa4WifConfig } from "./ga4-auth";
import type {
  AnalyticsDevice,
  AnalyticsEventSummary,
  AnalyticsFunnel,
  AnalyticsOverview,
  AnalyticsProvider,
  AnalyticsRealtime,
  AnalyticsTopPage,
  AnalyticsTrafficSource,
  AnalyticsRange,
  ProviderConnectionStatus,
} from "../types";

const propertyId = process.env.GA4_PROPERTY_ID?.trim();
let ga4Client: BetaAnalyticsDataClient | null | undefined;
const excludeAdminPagePathFilter = {
  notExpression: {
    filter: {
      fieldName: "pagePath",
      stringFilter: {
        matchType: "BEGINS_WITH",
        value: "/admin",
        caseSensitive: false,
      },
    },
  },
} as const;

const awarenessEvents = ["page_view"];
const propertyViewEvents = ["property_view"];
const intentEvents = [
  "priority_registration_view",
  "priority_registration_cta_click",
  "showing_profile_cta_click",
  "contact_option_click",
  "whatsapp_click",
  "property_whatsapp_click",
  "property_contact_click",
];
const leadSubmissionEvents = [
  "priority_registration_submit_success",
  "buyer_tenant_form_submit_success",
  "seller_landlord_form_submit_success",
  "buyer_profile_form_submit_success",
  "property_showing_profile_submit_success",
];
const duplicateEvents = ["priority_registration_duplicate"];
const errorEvents = ["priority_registration_submit_error"];
const funnelEvents = [
  ...awarenessEvents,
  ...propertyViewEvents,
  ...intentEvents,
  ...leadSubmissionEvents,
  ...duplicateEvents,
  ...errorEvents,
];

function isGa4Configured() {
  return Boolean(propertyId && getGa4WifConfig());
}

function getPropertyName() {
  return `properties/${propertyId}`;
}

function getClient() {
  if (ga4Client !== undefined) return ga4Client;

  if (!propertyId || !isGa4Configured()) {
    ga4Client = null;
    return ga4Client;
  }

  const wifConfig = getGa4WifConfig();
  if (!wifConfig) {
    ga4Client = null;
    return ga4Client;
  }

  ga4Client = new BetaAnalyticsDataClient({
    authClient: createGa4WifAuthClient(wifConfig),
    projectId: wifConfig.projectId,
  });

  return ga4Client;
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

function sumEventCounts(
  eventCounts: Map<string, number>,
  eventNames: string[]
) {
  return eventNames.reduce(
    (total, eventName) => total + (eventCounts.get(eventName) ?? 0),
    0
  );
}

function isAdminLikeRealtimeLabel(value: string | undefined) {
  if (!value) return false;

  const normalized = value.trim().toLowerCase();
  return normalized === "/admin" || normalized.startsWith("/admin/");
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
    normalized.includes("custom dimension") ||
    normalized.includes("custom dimensions") ||
    (normalized.includes("dimension") &&
      (normalized.includes("not a valid") ||
        normalized.includes("did you mean") ||
        normalized.includes("not registered")))
  ) {
    return {
      status: "missing_custom_dimension",
      message: "A required GA4 custom dimension is not available yet.",
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
    normalized.includes("oidc") ||
    normalized.includes("subject token") ||
    normalized.includes("workload identity") ||
    normalized.includes("invalid_grant")
  ) {
    return {
      status: "not_configured",
      message: "GA4 Workload Identity Federation authentication failed.",
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

async function fetchGa4PropertyDigitalInterest(
  range: AnalyticsRange
): Promise<PropertyPerformanceResult> {
  const client = getClient();
  if (!client) {
    return {
      status: "unavailable",
      range,
      rows: [],
      requestCount: 0,
      unavailableSections: ["core"],
      reason: "GA4 server authentication is not configured in this environment.",
      providerStatus: "not_configured",
    };
  }

  const dateRanges = [{ startDate: getStartDate(range), endDate: "today" }];
  const [coreResult, shareResult, arrivalResult] = await Promise.allSettled([
    runGa4Request(() =>
      client.runReport({
        property: getPropertyName(),
        dateRanges,
        dimensions: [
          { name: "customEvent:property_slug" },
          { name: "eventName" },
        ],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: {
              values: [...PROPERTY_PERFORMANCE_EVENTS],
              caseSensitive: true,
            },
          },
        },
        metrics: [{ name: "eventCount" }],
        limit: 1000,
      })
    ),
    runGa4Request(() =>
      client.runReport({
        property: getPropertyName(),
        dateRanges,
        dimensions: [
          { name: "customEvent:property_slug" },
          { name: "customEvent:share_channel" },
        ],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            stringFilter: {
              matchType: "EXACT",
              value: "property_share",
              caseSensitive: true,
            },
          },
        },
        metrics: [{ name: "eventCount" }],
        limit: 1000,
      })
    ),
    runGa4Request(() =>
      client.runReport({
        property: getPropertyName(),
        dateRanges,
        dimensions: [
          { name: "sessionManualSource" },
          { name: "sessionManualMedium" },
          { name: "sessionManualCampaignName" },
          { name: "sessionManualAdContent" },
        ],
        dimensionFilter: {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: "sessionManualMedium",
                  stringFilter: {
                    matchType: "EXACT",
                    value: "share",
                    caseSensitive: true,
                  },
                },
              },
              {
                filter: {
                  fieldName: "sessionManualCampaignName",
                  stringFilter: {
                    matchType: "EXACT",
                    value: "property_share",
                    caseSensitive: true,
                  },
                },
              },
            ],
          },
        },
        metrics: [{ name: "sessions" }],
        limit: 1000,
      })
    ),
  ]);

  if (coreResult.status === "rejected") {
    const error = coreResult.reason;
    console.error("[admin analytics] GA4 property core report unavailable", {
      status:
        error instanceof AnalyticsProviderError ? error.status : "unknown_error",
    });
    return {
      status: "unavailable",
      range,
      rows: [],
      requestCount: 3,
      unavailableSections: ["core"],
      reason:
        error instanceof AnalyticsProviderError
          ? error.message
          : "Property performance is temporarily unavailable.",
      providerStatus:
        error instanceof AnalyticsProviderError
          ? error.status
          : "unknown_error",
    };
  }

  const [coreResponse] = coreResult.value;
  const grouped = aggregatePropertyCoreRows(coreResponse.rows ?? []);
  const unavailableSections: Array<"share_breakdown" | "shared_link_arrivals"> = [];

  if (shareResult.status === "fulfilled") {
    const [shareResponse] = shareResult.value;
    mergePropertyShareRows(grouped, shareResponse.rows ?? []);
  } else {
    unavailableSections.push("share_breakdown");
    console.error("[admin analytics] GA4 share breakdown unavailable", {
      status:
        shareResult.reason instanceof AnalyticsProviderError
          ? shareResult.reason.status
          : "unknown_error",
    });
  }

  if (arrivalResult.status === "fulfilled") {
    const [arrivalResponse] = arrivalResult.value;
    mergePropertyArrivalRows(grouped, arrivalResponse.rows ?? []);
  } else {
    unavailableSections.push("shared_link_arrivals");
    console.error("[admin analytics] GA4 shared-link arrivals unavailable", {
      status:
        arrivalResult.reason instanceof AnalyticsProviderError
          ? arrivalResult.reason.status
          : "unknown_error",
    });
  }

  const rows = [...grouped.values()].sort(
    (a, b) => b.views - a.views || a.propertySlug.localeCompare(b.propertySlug)
  );

  if (unavailableSections.length > 0) {
    return {
      status: "partial",
      range,
      rows,
      requestCount: 3,
      unavailableSections,
      reason:
        "Some property-performance breakdowns are still unavailable while GA4 configuration propagates.",
    };
  }

  return {
    status: "available",
    range,
    rows,
    requestCount: 3,
    unavailableSections: [],
  };
}

export async function getGa4PropertyDigitalInterest(
  range: AnalyticsRange
): Promise<PropertyPerformanceResult> {
  const getCachedReport = unstable_cache(
    () => fetchGa4PropertyDigitalInterest(range),
    ["ga4-property-performance", range],
    { revalidate: getAnalyticsRevalidateSeconds(range) }
  );

  return getCachedReport();
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
        dimensionFilter: excludeAdminPagePathFilter,
        metrics: [
          { name: "totalUsers" },
          { name: "screenPageViews" },
          { name: "sessions" },
          { name: "eventCount" },
          { name: "keyEvents" },
        ],
      })
    );

    const values = response.rows?.[0]?.metricValues ?? [];

    return {
      visitors: metricValue(values[0]?.value),
      pageviews: metricValue(values[1]?.value),
      sessions: metricValue(values[2]?.value),
      events: metricValue(values[3]?.value),
      conversions: metricValue(values[4]?.value),
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
        activePagesResponse.rows
          ?.map((row) => ({
            path: row.dimensionValues?.[0]?.value || "Unknown page",
            users: metricValue(row.metricValues?.[0]?.value),
          }))
          .filter((page) => !isAdminLikeRealtimeLabel(page.path)) ?? [],
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
        dimensionFilter: excludeAdminPagePathFilter,
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
        dimensionFilter: excludeAdminPagePathFilter,
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
        dimensionFilter: excludeAdminPagePathFilter,
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
        dimensionFilter: excludeAdminPagePathFilter,
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
  async getFunnel(range) {
    const client = getClient();
    if (!client) return null;

    const [response] = await runGa4Request(() =>
      client.runReport({
        property: getPropertyName(),
        dateRanges: [{ startDate: getStartDate(range), endDate: "today" }],
        dimensions: [{ name: "eventName" }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              excludeAdminPagePathFilter,
              {
                filter: {
                  fieldName: "eventName",
                  inListFilter: {
                    values: funnelEvents,
                    caseSensitive: true,
                  },
                },
              },
            ],
          },
        },
        metrics: [{ name: "eventCount" }],
        limit: funnelEvents.length,
      })
    );

    const eventCounts = new Map(
      response.rows?.map((row) => [
        row.dimensionValues?.[0]?.value || "unknown",
        metricValue(row.metricValues?.[0]?.value),
      ]) ?? []
    );

    return {
      stages: [
        {
          id: "website_visits",
          label: "Website visits",
          count: sumEventCounts(eventCounts, awarenessEvents),
          eventNames: awarenessEvents,
        },
        {
          id: "property_views",
          label: "Property views",
          count: sumEventCounts(eventCounts, propertyViewEvents),
          eventNames: propertyViewEvents,
        },
        {
          id: "intent_actions",
          label: "Contact / intent actions",
          count: sumEventCounts(eventCounts, intentEvents),
          eventNames: intentEvents,
        },
        {
          id: "lead_submissions",
          label: "Successful form submissions",
          count: sumEventCounts(eventCounts, leadSubmissionEvents),
          eventNames: leadSubmissionEvents,
        },
      ],
      duplicateCount: sumEventCounts(eventCounts, duplicateEvents),
      errorCount: sumEventCounts(eventCounts, errorEvents),
    } satisfies AnalyticsFunnel;
  },
};
