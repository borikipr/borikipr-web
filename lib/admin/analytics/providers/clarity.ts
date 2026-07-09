import { AnalyticsProviderError } from "../errors";
import type {
  AnalyticsDevice,
  AnalyticsEventSummary,
  AnalyticsProvider,
  AnalyticsRealtime,
  AnalyticsTopPage,
  AnalyticsTrafficSource,
  ProviderConnectionStatus,
} from "../types";

const apiToken = process.env.CLARITY_API_TOKEN?.trim();
const projectId = process.env.CLARITY_PROJECT_ID?.trim();
const CLARITY_EXPORT_API =
  "https://www.clarity.ms/export-data/api/v1/project-live-insights";
const CLARITY_DAYS = 3;
const CLARITY_REVALIDATE_SECONDS = 60 * 60 * 12;

type ClarityDimension = {
  name?: string;
  value?: string;
  dimension?: string;
};

type ClarityInformationRow = {
  dimensions?: ClarityDimension[];
  dimension?: ClarityDimension[];
  url?: string;
  URL?: string;
  pageUrl?: string;
  device?: string;
  Device?: string;
  source?: string;
  Source?: string;
  medium?: string;
  Medium?: string;
  channel?: string;
  Channel?: string;
  sessionsCount?: number | string;
  totalSessionCount?: number | string;
  distinctUserCount?: number | string;
  userCount?: number | string;
  count?: number | string;
  value?: number | string;
};

type ClarityMetric = {
  metricName?: string;
  information?: ClarityInformationRow[];
};

type ClarityReport = {
  url: ClarityMetric[];
  device: ClarityMetric[];
  source: ClarityMetric[];
};

let clarityReportPromise: Promise<ClarityReport> | null = null;

function isClarityConfigured() {
  return Boolean(apiToken);
}

function numericValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMetricName(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function getRows(metric: ClarityMetric) {
  return Array.isArray(metric.information) ? metric.information : [];
}

function getDimensionValue(
  row: ClarityInformationRow,
  index: number,
  fallbackKeys: Array<keyof ClarityInformationRow>
) {
  const directValue = fallbackKeys
    .map((key) => row[key])
    .find((value) => typeof value === "string" && value.trim());

  if (typeof directValue === "string") {
    return directValue.trim();
  }

  const dimensions = Array.isArray(row.dimensions)
    ? row.dimensions
    : Array.isArray(row.dimension)
      ? row.dimension
      : [];

  const dimension = dimensions[index];
  const value = dimension?.value ?? dimension?.name ?? dimension?.dimension;

  return typeof value === "string" ? value.trim() : "";
}

function getRowCount(row: ClarityInformationRow) {
  return (
    numericValue(row.sessionsCount) ||
    numericValue(row.totalSessionCount) ||
    numericValue(row.distinctUserCount) ||
    numericValue(row.userCount) ||
    numericValue(row.count) ||
    numericValue(row.value)
  );
}

function isAdminPath(path: string) {
  return path === "/admin" || path.startsWith("/admin/");
}

function normalizePath(value: string) {
  if (!value) return "/";

  try {
    const parsed = value.startsWith("http")
      ? new URL(value)
      : new URL(value, "https://borikipr.com");
    return parsed.pathname || "/";
  } catch {
    return value.startsWith("/") ? value : `/${value}`;
  }
}

function classifyClarityError(status: number): {
  status: ProviderConnectionStatus;
  message: string;
} {
  if (status === 401 || status === 403) {
    return {
      status: "permission_denied",
      message:
        "Verify that the Microsoft Clarity API token can access this project.",
    };
  }

  if (status === 429) {
    return {
      status: "rate_limited",
      message: "Microsoft Clarity Data Export API daily limit reached.",
    };
  }

  return {
    status: "unavailable",
    message: "Microsoft Clarity Data Export API is unavailable.",
  };
}

async function fetchClarityMetrics(dimensionParams: Record<string, string>) {
  const searchParams = new URLSearchParams({
    numOfDays: String(CLARITY_DAYS),
    ...dimensionParams,
  });

  const response = await fetch(`${CLARITY_EXPORT_API}?${searchParams}`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
    next: { revalidate: CLARITY_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    const classified = classifyClarityError(response.status);

    throw new AnalyticsProviderError(
      classified.message,
      "clarity",
      classified.status,
      {
        status: response.status,
      }
    );
  }

  const data = (await response.json()) as unknown;

  return Array.isArray(data) ? (data as ClarityMetric[]) : [];
}

async function fetchClarityReport() {
  if (!isClarityConfigured()) {
    return null;
  }

  if (!clarityReportPromise) {
    clarityReportPromise = Promise.all([
      fetchClarityMetrics({ dimension1: "URL" }),
      fetchClarityMetrics({ dimension1: "Device" }),
      fetchClarityMetrics({ dimension1: "Source", dimension2: "Medium" }),
    ]).then(([url, device, source]) => ({ url, device, source }));
  }

  return clarityReportPromise;
}

function findMetric(metrics: ClarityMetric[], names: string[]) {
  const normalizedNames = names.map(normalizeMetricName);

  return metrics.find((metric) =>
    normalizedNames.some((name) => normalizeMetricName(metric.metricName).includes(name))
  );
}

function getUrlMetric(metrics: ClarityMetric[]) {
  return (
    findMetric(metrics, ["popular pages"]) ??
    findMetric(metrics, ["traffic"]) ??
    metrics[0]
  );
}

function getDeviceMetric(metrics: ClarityMetric[]) {
  return findMetric(metrics, ["device"]) ?? findMetric(metrics, ["traffic"]) ?? metrics[0];
}

function mapDevice(value: string): AnalyticsDevice["device"] {
  const normalized = value.toLowerCase();

  if (normalized.includes("mobile")) return "mobile";
  if (normalized.includes("desktop")) return "desktop";
  if (normalized.includes("tablet")) return "tablet";

  return "unknown";
}

const behavioralMetrics = [
  { match: ["rage click"], label: "rage_clicks" },
  { match: ["dead click"], label: "dead_clicks" },
  { match: ["quickback", "quick back"], label: "quick_backs" },
  { match: ["excessive scroll"], label: "excessive_scrolling" },
  { match: ["script error"], label: "script_errors" },
  { match: ["error click"], label: "error_clicks" },
  { match: ["scroll depth"], label: "scroll_depth" },
  { match: ["engagement time"], label: "engagement_time" },
];

export const clarityProvider: AnalyticsProvider = {
  id: "clarity",
  name: "Microsoft Clarity",
  description: "Muestra senales agregadas de comportamiento desde Clarity.",
  isConfigured: isClarityConfigured,
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      status: this.isConfigured() ? "connected" : "not_configured",
      description: this.isConfigured()
        ? projectId
          ? `Conectado al proyecto de Clarity ${projectId}.`
          : "Conectado al Microsoft Clarity Data Export API."
        : "Microsoft Clarity API token is not configured.",
    };
  },
  getOverview: () => null,
  getRealtime() {
    return {
      activePages: [],
      recentEvents: [
        {
          name: "Not available from Microsoft Clarity Data Export API.",
          count: 0,
        },
      ],
    } satisfies AnalyticsRealtime;
  },
  async getTopPages() {
    const report = await fetchClarityReport();
    if (!report) return [];

    const metric = getUrlMetric(report.url);
    if (!metric) return [];

    return getRows(metric)
      .map((row) => {
        const path = normalizePath(
          getDimensionValue(row, 0, ["url", "URL", "pageUrl"])
        );

        return {
          path,
          pageviews: getRowCount(row),
        };
      })
      .filter((row) => row.pageviews > 0 && !isAdminPath(row.path))
      .sort((a, b) => b.pageviews - a.pageviews)
      .slice(0, 8) satisfies AnalyticsTopPage[];
  },
  async getTrafficSources() {
    const report = await fetchClarityReport();
    if (!report) return [];

    const metric = findMetric(report.source, ["traffic"]) ?? report.source[0];
    if (!metric) return [];

    return getRows(metric)
      .map((row) => {
        const source =
          getDimensionValue(row, 0, ["source", "Source", "channel", "Channel"]) ||
          "Direct / Unknown";
        const medium = getDimensionValue(row, 1, ["medium", "Medium"]);

        return {
          source,
          medium: medium || undefined,
          visitors: getRowCount(row),
        };
      })
      .filter((row) => row.visitors > 0)
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 8) satisfies AnalyticsTrafficSource[];
  },
  async getDevices() {
    const report = await fetchClarityReport();
    if (!report) return [];

    const metric = getDeviceMetric(report.device);
    if (!metric) return [];

    return getRows(metric)
      .map((row) => ({
        device: mapDevice(getDimensionValue(row, 0, ["device", "Device"])),
        visitors: getRowCount(row),
      }))
      .filter((row) => row.visitors > 0)
      .sort((a, b) => b.visitors - a.visitors) satisfies AnalyticsDevice[];
  },
  async getEvents() {
    const report = await fetchClarityReport();
    if (!report) return [];

    return behavioralMetrics
      .map((event) => {
        const metric = report.url.find((item) => {
          const metricName = normalizeMetricName(item.metricName);
          return event.match.some((value) => metricName.includes(value));
        });

        const count =
          metric
            ?.information?.filter((row) => {
              const path = normalizePath(
                getDimensionValue(row, 0, ["url", "URL", "pageUrl"])
              );
              return !isAdminPath(path);
            })
            .reduce((sum, row) => sum + getRowCount(row), 0) ?? 0;

        return {
          name: event.label,
          count,
        };
      })
      .filter((event) => event.count > 0) satisfies AnalyticsEventSummary[];
  },
};
