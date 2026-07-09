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

const apiToken = process.env.VERCEL_API_TOKEN?.trim();
const projectId = process.env.VERCEL_ANALYTICS_PROJECT_ID?.trim();
const teamId = process.env.VERCEL_ANALYTICS_TEAM_ID?.trim();
const teamSlug = process.env.VERCEL_ANALYTICS_TEAM_SLUG?.trim();

const VERCEL_ANALYTICS_API_BASE =
  "https://api.vercel.com/v1/query/web-analytics";
const PUBLIC_ROUTE_FILTER = "not startswith(requestPath, '/admin')";

type VercelCountResponse = {
  data?: {
    pageviews?: number | string;
    visitors?: number | string;
  };
};

type VercelAggregateRow = {
  requestPath?: string;
  referrerHostname?: string;
  deviceType?: string;
  eventName?: string;
  pageviews?: number | string;
  visitors?: number | string;
  count?: number | string;
};

type VercelAggregateResponse = {
  data?: VercelAggregateRow[] | VercelAggregateRow;
};

function isVercelConfigured() {
  return Boolean(apiToken && projectId);
}

function getDateRange(range: "today" | "7d" | "30d" | "90d") {
  const until = new Date();
  const since = new Date(until);

  switch (range) {
    case "today":
      since.setHours(0, 0, 0, 0);
      break;
    case "7d":
      since.setDate(since.getDate() - 7);
      break;
    case "90d":
      since.setDate(since.getDate() - 90);
      break;
    case "30d":
    default:
      since.setDate(since.getDate() - 30);
      break;
  }

  return {
    since: since.toISOString(),
    until: until.toISOString(),
  };
}

function numericValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildSearchParams(
  params: Record<string, string | number | undefined>
) {
  const searchParams = new URLSearchParams();

  searchParams.set("projectId", projectId ?? "");

  if (teamId) {
    searchParams.set("teamId", teamId);
  } else if (teamSlug) {
    searchParams.set("slug", teamSlug);
  }

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }

  return searchParams;
}

function classifyVercelError(status: number): {
  status: ProviderConnectionStatus;
  message: string;
} {
  if (status === 401 || status === 403) {
    return {
      status: "permission_denied",
      message:
        "Verify that the Vercel API token can access this project and workspace.",
    };
  }

  if (status === 429) {
    return {
      status: "rate_limited",
      message: "Vercel Analytics API rate limit reached.",
    };
  }

  if (status === 400 || status === 404) {
    return {
      status: "invalid_property_id",
      message:
        "Verify VERCEL_ANALYTICS_PROJECT_ID and optional team configuration.",
    };
  }

  return {
    status: "unavailable",
    message: "Vercel Analytics API is unavailable.",
  };
}

async function fetchVercelAnalytics<T>(
  endpoint: "visits/count" | "visits/aggregate" | "events/aggregate",
  params: Record<string, string | number | undefined>
) {
  if (!isVercelConfigured()) {
    return null;
  }

  const searchParams = buildSearchParams(params);
  const response = await fetch(
    `${VERCEL_ANALYTICS_API_BASE}/${endpoint}?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 300 },
    }
  );

  if (!response.ok) {
    const classified = classifyVercelError(response.status);

    throw new AnalyticsProviderError(
      classified.message,
      "vercel",
      classified.status,
      {
        endpoint,
        status: response.status,
      }
    );
  }

  return (await response.json()) as T;
}

async function fetchOptionalVercelAnalytics<T>(
  endpoint: "events/aggregate",
  params: Record<string, string | number | undefined>
) {
  try {
    return await fetchVercelAnalytics<T>(endpoint, params);
  } catch (error) {
    if (
      error instanceof AnalyticsProviderError &&
      error.safeDetails?.status === 402
    ) {
      return null;
    }

    throw error;
  }
}

function aggregateRows(response: VercelAggregateResponse | null) {
  if (!response?.data) return [];
  return Array.isArray(response.data) ? response.data : [response.data];
}

export const vercelProvider: AnalyticsProvider = {
  id: "vercel",
  name: "Vercel Analytics",
  description: "Consulta Web Analytics agregados desde la API de Vercel.",
  isConfigured: isVercelConfigured,
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      status: this.isConfigured() ? "connected" : "not_configured",
      description: this.isConfigured()
        ? "Conectado al Vercel Web Analytics API."
        : "Vercel Analytics server credentials are not configured.",
    };
  },
  async getOverview(range) {
    const { since, until } = getDateRange(range);
    const response = await fetchVercelAnalytics<VercelCountResponse>(
      "visits/count",
      {
        since,
        until,
        filter: PUBLIC_ROUTE_FILTER,
      }
    );

    if (!response) return null;

    return {
      pageviews: numericValue(response.data?.pageviews),
      visitors: numericValue(response.data?.visitors),
    } satisfies AnalyticsOverview;
  },
  getRealtime() {
    return {
      activePages: [],
      recentEvents: [
        {
          name: "Not available from Vercel Web Analytics API.",
          count: 0,
        },
      ],
    } satisfies AnalyticsRealtime;
  },
  async getTopPages(range) {
    const { since, until } = getDateRange(range);
    const response = await fetchVercelAnalytics<VercelAggregateResponse>(
      "visits/aggregate",
      {
        since,
        until,
        by: "requestPath",
        limit: 8,
        filter: PUBLIC_ROUTE_FILTER,
      }
    );

    return aggregateRows(response).map((row) => ({
      path: row.requestPath || "/",
      pageviews: numericValue(row.pageviews),
      visitors: numericValue(row.visitors),
    })) satisfies AnalyticsTopPage[];
  },
  async getTrafficSources(range) {
    const { since, until } = getDateRange(range);
    const response = await fetchVercelAnalytics<VercelAggregateResponse>(
      "visits/aggregate",
      {
        since,
        until,
        by: "referrerHostname",
        limit: 8,
        filter: PUBLIC_ROUTE_FILTER,
      }
    );

    return aggregateRows(response).map((row) => ({
      source: row.referrerHostname || "Direct / Unknown",
      visitors: numericValue(row.visitors),
    })) satisfies AnalyticsTrafficSource[];
  },
  async getDevices(range) {
    const { since, until } = getDateRange(range);
    const response = await fetchVercelAnalytics<VercelAggregateResponse>(
      "visits/aggregate",
      {
        since,
        until,
        by: "deviceType",
        filter: PUBLIC_ROUTE_FILTER,
      }
    );

    return aggregateRows(response).map((row) => {
      const device = row.deviceType?.toLowerCase();

      return {
        device:
          device === "mobile" || device === "desktop" || device === "tablet"
            ? device
            : "unknown",
        visitors: numericValue(row.visitors),
      };
    }) satisfies AnalyticsDevice[];
  },
  async getEvents(range) {
    const { since, until } = getDateRange(range);
    const response = await fetchOptionalVercelAnalytics<VercelAggregateResponse>(
      "events/aggregate",
      {
        since,
        until,
        by: "eventName",
        limit: 12,
      }
    );

    return aggregateRows(response).map((row) => ({
      name: row.eventName || "unknown",
      count: numericValue(row.count),
      visitors: numericValue(row.visitors),
    })) satisfies AnalyticsEventSummary[];
  },
};
