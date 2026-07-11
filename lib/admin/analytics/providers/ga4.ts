import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { AnalyticsProviderError } from "../errors";
import type {
  AnalyticsDevice,
  AnalyticsEventSummary,
  AnalyticsFunnel,
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
const propertyDigitalInterestEvents = [
  "property_view",
  "priority_registration_view",
  "priority_registration_cta_click",
  "property_contact_click",
  "property_whatsapp_click",
  "showing_profile_cta_click",
  "priority_registration_submit_success",
  "property_showing_profile_submit_success",
];
const funnelEvents = [
  ...awarenessEvents,
  ...propertyViewEvents,
  ...intentEvents,
  ...leadSubmissionEvents,
  ...duplicateEvents,
  ...errorEvents,
];

export type Ga4PropertyDigitalInterestRange = "today" | "7d" | "30d" | "all";

export type Ga4PropertyDigitalInterest = {
  propertySlug: string;
  views: number;
  priorityPageViews: number;
  registrationCtaClicks: number;
  whatsappClicks: number;
  contactClicks: number;
  showingCtaClicks: number;
  priorityRegistrationsSubmitted: number;
  showingProfilesSubmitted: number;
  total: number;
};

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

function getPropertyDigitalInterestStartDate(
  range: Ga4PropertyDigitalInterestRange
) {
  switch (range) {
    case "today":
      return "today";
    case "7d":
      return "7daysAgo";
    case "30d":
      return "30daysAgo";
    case "all":
    default:
      return "2020-01-01";
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

export async function getGa4PropertyDigitalInterest(
  range: Ga4PropertyDigitalInterestRange
): Promise<Ga4PropertyDigitalInterest[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const [response] = await runGa4Request(() =>
      client.runReport({
        property: getPropertyName(),
        dateRanges: [
          {
            startDate: getPropertyDigitalInterestStartDate(range),
            endDate: "today",
          },
        ],
        dimensions: [
          { name: "customEvent:property_slug" },
          { name: "eventName" },
        ],
        dimensionFilter: {
          andGroup: {
            expressions: [
              excludeAdminPagePathFilter,
              {
                filter: {
                  fieldName: "eventName",
                  inListFilter: {
                    values: propertyDigitalInterestEvents,
                    caseSensitive: true,
                  },
                },
              },
            ],
          },
        },
        metrics: [{ name: "eventCount" }],
        limit: 1000,
      })
    );

    const grouped = new Map<string, Ga4PropertyDigitalInterest>();

    for (const row of response.rows ?? []) {
      const propertySlug = row.dimensionValues?.[0]?.value?.trim();
      const eventName = row.dimensionValues?.[1]?.value?.trim();
      const count = metricValue(row.metricValues?.[0]?.value);

      if (!propertySlug || propertySlug === "(not set)" || !eventName) {
        continue;
      }

      const current =
        grouped.get(propertySlug) ??
        ({
          propertySlug,
          views: 0,
          priorityPageViews: 0,
          registrationCtaClicks: 0,
          whatsappClicks: 0,
          contactClicks: 0,
          showingCtaClicks: 0,
          priorityRegistrationsSubmitted: 0,
          showingProfilesSubmitted: 0,
          total: 0,
        } satisfies Ga4PropertyDigitalInterest);

      switch (eventName) {
        case "property_view":
          current.views += count;
          break;
        case "priority_registration_view":
          current.priorityPageViews += count;
          break;
        case "priority_registration_cta_click":
          current.registrationCtaClicks += count;
          break;
        case "property_whatsapp_click":
          current.whatsappClicks += count;
          break;
        case "property_contact_click":
          current.contactClicks += count;
          break;
        case "showing_profile_cta_click":
          current.showingCtaClicks += count;
          break;
        case "priority_registration_submit_success":
          current.priorityRegistrationsSubmitted += count;
          break;
        case "property_showing_profile_submit_success":
          current.showingProfilesSubmitted += count;
          break;
      }

      current.total += count;
      grouped.set(propertySlug, current);
    }

    return [...grouped.values()].sort((a, b) => b.total - a.total);
  } catch (error) {
    console.error("[admin leads] GA4 property digital interest unavailable", {
      message: error instanceof Error ? error.message : "Unknown error",
      status:
        error instanceof AnalyticsProviderError ? error.status : "unknown_error",
    });

    return [];
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
