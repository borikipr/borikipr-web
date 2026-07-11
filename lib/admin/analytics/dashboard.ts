import { AnalyticsProviderError, logAnalyticsProviderError } from "./errors";
import { analyticsProviders } from "./registry";
import {
  combineDevices,
  combineEvents,
  combineTopPages,
  combineTrafficSources,
  mergeOverview,
  mergeRealtime,
} from "./normalize";
import type {
  AdminAnalyticsDashboard,
  AnalyticsDevice,
  AnalyticsEventSummary,
  AnalyticsFunnel,
  AnalyticsOverview,
  AnalyticsProvider,
  AnalyticsProviderDashboardData,
  AnalyticsProviderId,
  AnalyticsProviderStatus,
  AnalyticsRange,
  AnalyticsRealtime,
  AnalyticsTopPage,
  AnalyticsTrafficSource,
} from "./types";

export function parseAnalyticsRange(value: string | undefined): AnalyticsRange {
  if (value === "today" || value === "7d" || value === "30d" || value === "90d") {
    return value;
  }

  return "30d";
}

async function settleProviderValue<T>({
  providerId,
  promise,
  fallback,
}: {
  providerId: AnalyticsProviderId;
  promise: Promise<T> | T;
  fallback: T;
}) {
  const result = await Promise.resolve(promise).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ status: "rejected" as const, reason })
  );

    if (result.status === "fulfilled") {
      return result.value;
    }

  logAnalyticsProviderError(providerId, result.reason);

  return fallback;
}

async function settleProviderCall<T>({
  providerId,
  call,
  fallback,
}: {
  providerId: AnalyticsProviderId;
  call: () => Promise<T> | T;
  fallback: T;
}) {
  try {
    return await call();
  } catch (error) {
    logAnalyticsProviderError(providerId, error);

    return fallback;
  }
}

async function captureProviderCall<T>(call: () => Promise<T> | T) {
  try {
    const value = await call();
    return { status: "fulfilled" as const, value };
  } catch (reason) {
    return { status: "rejected" as const, reason };
  }
}

async function getProviderDashboardData(provider: AnalyticsProvider, range: AnalyticsRange) {
  const status = await settleProviderValue({
    providerId: provider.id,
    promise: provider.getStatus(),
    fallback: {
      id: provider.id,
      name: provider.name,
      status: "unavailable" as const,
      description: provider.description,
    },
  });

  const [overview, realtime, topPages, trafficSources, devices, events, funnel] =
    await Promise.all([
      captureProviderCall(() => provider.getOverview(range)),
      captureProviderCall(() => provider.getRealtime()),
      captureProviderCall(() => provider.getTopPages(range)),
      captureProviderCall(() => provider.getTrafficSources(range)),
      captureProviderCall(() => provider.getDevices(range)),
      captureProviderCall(() => provider.getEvents(range)),
      captureProviderCall(() => provider.getFunnel?.(range) ?? null),
    ]);

  const failures = [
    overview,
    realtime,
    topPages,
    trafficSources,
    devices,
    events,
    funnel,
  ].filter((result) => result.status === "rejected");

  failures.forEach((failure) => {
    if (failure.status === "rejected") {
      logAnalyticsProviderError(provider.id, failure.reason);
    }
  });

  const providerError = failures.find(
    (failure) =>
      failure.status === "rejected" &&
      failure.reason instanceof AnalyticsProviderError
  );
  const analyticsError =
    providerError?.status === "rejected" &&
    providerError.reason instanceof AnalyticsProviderError
      ? providerError.reason
      : null;

  const providerStatus: AnalyticsProviderStatus =
    failures.length > 0 && status.status === "connected"
      ? {
          ...status,
          status: analyticsError?.status ?? "api_error",
          description:
            analyticsError?.message ??
            "No se pudieron cargar las metricas de este proveedor.",
        }
      : status;

  return {
    id: provider.id,
    name: provider.name,
    status: providerStatus,
    overview: overview.status === "fulfilled" ? overview.value : null,
    realtime: realtime.status === "fulfilled" ? realtime.value : null,
    topPages: topPages.status === "fulfilled" ? topPages.value : [],
    trafficSources:
      trafficSources.status === "fulfilled" ? trafficSources.value : [],
    devices: devices.status === "fulfilled" ? devices.value : [],
    events: events.status === "fulfilled" ? events.value : [],
    funnel: funnel.status === "fulfilled" ? funnel.value : null,
  };
}

export async function getAdminAnalyticsDashboard(
  range: AnalyticsRange
): Promise<AdminAnalyticsDashboard> {
  const providerResults = await Promise.all(
    analyticsProviders.map((provider) =>
      settleProviderCall({
        providerId: provider.id,
        call: () => getProviderDashboardData(provider, range),
        fallback: {
          id: provider.id,
          name: provider.name,
          status: {
            id: provider.id,
            name: provider.name,
            status: "unavailable" as const,
            description: provider.description,
          },
          overview: null as AnalyticsOverview | null,
          realtime: null as AnalyticsRealtime | null,
          topPages: [] as AnalyticsTopPage[],
          trafficSources: [] as AnalyticsTrafficSource[],
          devices: [] as AnalyticsDevice[],
          events: [] as AnalyticsEventSummary[],
          funnel: null as AnalyticsFunnel | null,
        } satisfies AnalyticsProviderDashboardData,
      })
    )
  );

  const safeProviderResults = providerResults;

  const providerStatuses = safeProviderResults.map((result) => result.status);
  const overviewItems = safeProviderResults.map((result) => result.overview);
  const realtimeItems = safeProviderResults.map((result) => result.realtime);
  const topPageItems = safeProviderResults.map((result) => result.topPages);
  const trafficSourceItems = safeProviderResults.map(
    (result) => result.trafficSources
  );
  const deviceItems = safeProviderResults.map((result) => result.devices);
  const eventItems = safeProviderResults.map((result) => result.events);
  const funnel =
    safeProviderResults.find((result) => result.id === "ga4")?.funnel ?? null;

  return {
    range,
    overview: mergeOverview(overviewItems),
    realtime: mergeRealtime(realtimeItems),
    topPages: combineTopPages(topPageItems),
    trafficSources: combineTrafficSources(trafficSourceItems),
    devices: combineDevices(deviceItems),
    events: combineEvents(eventItems),
    funnel,
    providers: providerStatuses,
    providerData: safeProviderResults,
  };
}

export async function getAdminAnalyticsProviderDashboard(
  providerId: AnalyticsProviderId,
  range: AnalyticsRange
): Promise<AnalyticsProviderDashboardData> {
  const provider = analyticsProviders.find((item) => item.id === providerId);

  if (!provider) {
    return {
      id: providerId,
      name: providerId,
      status: {
        id: providerId,
        name: providerId,
        status: "unavailable",
        description: "Analytics provider is not registered.",
      },
      overview: null,
      realtime: null,
      topPages: [],
      trafficSources: [],
      devices: [],
      events: [],
      funnel: null,
    };
  }

  return settleProviderCall({
    providerId: provider.id,
    call: () => getProviderDashboardData(provider, range),
    fallback: {
      id: provider.id,
      name: provider.name,
      status: {
        id: provider.id,
        name: provider.name,
        status: "unavailable",
        description: provider.description,
      },
      overview: null,
      realtime: null,
      topPages: [],
      trafficSources: [],
      devices: [],
      events: [],
      funnel: null,
    } satisfies AnalyticsProviderDashboardData,
  });
}
