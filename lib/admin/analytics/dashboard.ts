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
  AnalyticsOverview,
  AnalyticsProvider,
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

  const [overview, realtime, topPages, trafficSources, devices, events] =
    await Promise.all([
      captureProviderCall(() => provider.getOverview(range)),
      captureProviderCall(() => provider.getRealtime()),
      captureProviderCall(() => provider.getTopPages(range)),
      captureProviderCall(() => provider.getTrafficSources(range)),
      captureProviderCall(() => provider.getDevices(range)),
      captureProviderCall(() => provider.getEvents(range)),
    ]);

  const failures = [
    overview,
    realtime,
    topPages,
    trafficSources,
    devices,
    events,
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

  const providerStatus: AnalyticsProviderStatus =
    failures.length > 0 && status.status === "connected"
      ? {
          ...status,
          status:
            providerError?.status === "rejected" &&
            providerError.reason instanceof AnalyticsProviderError
              ? providerError.reason.status
              : "api_error",
          description:
            providerError?.status === "rejected" &&
            providerError.reason instanceof AnalyticsProviderError
              ? providerError.reason.message
              : "No se pudieron cargar las metricas de este proveedor.",
        }
      : status;

  return {
    status: providerStatus,
    overview: overview.status === "fulfilled" ? overview.value : null,
    realtime: realtime.status === "fulfilled" ? realtime.value : null,
    topPages: topPages.status === "fulfilled" ? topPages.value : [],
    trafficSources:
      trafficSources.status === "fulfilled" ? trafficSources.value : [],
    devices: devices.status === "fulfilled" ? devices.value : [],
    events: events.status === "fulfilled" ? events.value : [],
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
        },
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

  return {
    range,
    overview: mergeOverview(overviewItems),
    realtime: mergeRealtime(realtimeItems),
    topPages: combineTopPages(topPageItems),
    trafficSources: combineTrafficSources(trafficSourceItems),
    devices: combineDevices(deviceItems),
    events: combineEvents(eventItems),
    providers: providerStatuses,
  };
}
