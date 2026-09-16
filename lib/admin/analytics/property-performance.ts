import type { AnalyticsRange, ProviderConnectionStatus } from "./types";

export const PROPERTY_PERFORMANCE_EVENTS = [
  "property_view",
  "property_whatsapp_click",
  "property_contact_click",
  "priority_registration_submit_success",
  "buyer_profile_form_submit_success",
  "property_showing_profile_submit_success",
  "property_share",
] as const;

export const PROPERTY_SHARE_CHANNELS = [
  "whatsapp",
  "facebook",
  "copy",
  "qr",
] as const;

export type PropertyShareChannel = (typeof PROPERTY_SHARE_CHANNELS)[number];

export type Ga4ReportRowLike = {
  dimensionValues?: Array<{ value?: string | null }> | null;
  metricValues?: Array<{ value?: string | null }> | null;
};

export type PropertyPerformanceMetric = {
  propertySlug: string;
  views: number;
  shares: number;
  whatsappClicks: number;
  contactClicks: number;
  priorityRegistrationsSubmitted: number;
  buyerProfilesSubmitted: number;
  showingProfilesSubmitted: number;
  shareChannels: Record<PropertyShareChannel, number>;
  sharedLinkArrivals: number;
};

export type PropertyPerformanceUnavailableSection =
  | "share_breakdown"
  | "shared_link_arrivals";

export type PropertyPerformanceResult =
  | {
      status: "available";
      range: AnalyticsRange;
      rows: PropertyPerformanceMetric[];
      requestCount: 3;
      unavailableSections: [];
    }
  | {
      status: "partial";
      range: AnalyticsRange;
      rows: PropertyPerformanceMetric[];
      requestCount: 3;
      unavailableSections: PropertyPerformanceUnavailableSection[];
      reason: string;
    }
  | {
      status: "unavailable";
      range: AnalyticsRange;
      rows: [];
      requestCount: 0 | 3;
      unavailableSections: ["core"];
      reason: string;
      providerStatus?: ProviderConnectionStatus;
    };

export type PropertyPerformanceMetadata = {
  slug: string;
  title: string;
  status: string;
  municipality: string;
};

export type PropertyPerformanceDisplayRow = PropertyPerformanceMetric & {
  title: string;
  status: string | null;
  municipality: string | null;
  historical: boolean;
  contactActionRate: number | null;
  formRate: number | null;
};

function numberValue(value: string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyShareChannels(): Record<PropertyShareChannel, number> {
  return { whatsapp: 0, facebook: 0, copy: 0, qr: 0 };
}

export function emptyPropertyPerformanceMetric(
  propertySlug: string
): PropertyPerformanceMetric {
  return {
    propertySlug,
    views: 0,
    shares: 0,
    whatsappClicks: 0,
    contactClicks: 0,
    priorityRegistrationsSubmitted: 0,
    buyerProfilesSubmitted: 0,
    showingProfilesSubmitted: 0,
    shareChannels: emptyShareChannels(),
    sharedLinkArrivals: 0,
  };
}

function validSlug(value: string | null | undefined) {
  const slug = value?.trim();
  return slug && slug !== "(not set)" ? slug : null;
}

export function aggregatePropertyCoreRows(rows: Ga4ReportRowLike[]) {
  const grouped = new Map<string, PropertyPerformanceMetric>();

  for (const row of rows) {
    const propertySlug = validSlug(row.dimensionValues?.[0]?.value);
    const eventName = row.dimensionValues?.[1]?.value?.trim();
    if (!propertySlug || !eventName) continue;

    const metric =
      grouped.get(propertySlug) ?? emptyPropertyPerformanceMetric(propertySlug);
    const count = numberValue(row.metricValues?.[0]?.value);

    switch (eventName) {
      case "property_view":
        metric.views += count;
        break;
      case "property_whatsapp_click":
        metric.whatsappClicks += count;
        break;
      case "property_contact_click":
        metric.contactClicks += count;
        break;
      case "priority_registration_submit_success":
        metric.priorityRegistrationsSubmitted += count;
        break;
      case "buyer_profile_form_submit_success":
        metric.buyerProfilesSubmitted += count;
        break;
      case "property_showing_profile_submit_success":
        metric.showingProfilesSubmitted += count;
        break;
      case "property_share":
        metric.shares += count;
        break;
    }

    grouped.set(propertySlug, metric);
  }

  return grouped;
}

export function mergePropertyShareRows(
  grouped: Map<string, PropertyPerformanceMetric>,
  rows: Ga4ReportRowLike[]
) {
  for (const row of rows) {
    const propertySlug = validSlug(row.dimensionValues?.[0]?.value);
    const channel = row.dimensionValues?.[1]?.value?.trim();
    if (
      !propertySlug ||
      !PROPERTY_SHARE_CHANNELS.includes(channel as PropertyShareChannel)
    ) {
      continue;
    }

    const metric =
      grouped.get(propertySlug) ?? emptyPropertyPerformanceMetric(propertySlug);
    metric.shareChannels[channel as PropertyShareChannel] += numberValue(
      row.metricValues?.[0]?.value
    );
    grouped.set(propertySlug, metric);
  }
}

export function mergePropertyArrivalRows(
  grouped: Map<string, PropertyPerformanceMetric>,
  rows: Ga4ReportRowLike[]
) {
  for (const row of rows) {
    const propertySlug = validSlug(row.dimensionValues?.[3]?.value);
    if (!propertySlug) continue;

    const metric =
      grouped.get(propertySlug) ?? emptyPropertyPerformanceMetric(propertySlug);
    metric.sharedLinkArrivals += numberValue(row.metricValues?.[0]?.value);
    grouped.set(propertySlug, metric);
  }
}

export function totalSuccessfulForms(metric: PropertyPerformanceMetric) {
  return (
    metric.priorityRegistrationsSubmitted +
    metric.buyerProfilesSubmitted +
    metric.showingProfilesSubmitted
  );
}

export function actionRate(numerator: number, views: number) {
  if (views <= 0) return null;
  return numerator / views;
}

export function buildPropertyPerformanceDisplayRows(
  metrics: PropertyPerformanceMetric[],
  metadata: PropertyPerformanceMetadata[]
): PropertyPerformanceDisplayRow[] {
  const metricBySlug = new Map(metrics.map((metric) => [metric.propertySlug, metric]));
  const currentSlugs = new Set(metadata.map((property) => property.slug));

  const currentRows = metadata.map((property) => {
    const metric =
      metricBySlug.get(property.slug) ?? emptyPropertyPerformanceMetric(property.slug);
    return {
      ...metric,
      title: property.title,
      status: property.status,
      municipality: property.municipality,
      historical: false,
      contactActionRate: actionRate(
        metric.whatsappClicks + metric.contactClicks,
        metric.views
      ),
      formRate: actionRate(totalSuccessfulForms(metric), metric.views),
    } satisfies PropertyPerformanceDisplayRow;
  });

  const historicalRows = metrics
    .filter((metric) => !currentSlugs.has(metric.propertySlug))
    .map(
      (metric) =>
        ({
          ...metric,
          title: metric.propertySlug,
          status: null,
          municipality: null,
          historical: true,
          contactActionRate: actionRate(
            metric.whatsappClicks + metric.contactClicks,
            metric.views
          ),
          formRate: actionRate(totalSuccessfulForms(metric), metric.views),
        }) satisfies PropertyPerformanceDisplayRow
    );

  return [...currentRows, ...historicalRows].sort(
    (a, b) => b.views - a.views || a.title.localeCompare(b.title, "es")
  );
}
