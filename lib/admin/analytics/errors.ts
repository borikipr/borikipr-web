import type { AnalyticsProviderId, ProviderConnectionStatus } from "./types";

export class AnalyticsProviderError extends Error {
  constructor(
    message: string,
    public readonly providerId: AnalyticsProviderId,
    public readonly status: ProviderConnectionStatus = "unknown_error",
    public readonly safeDetails?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AnalyticsProviderError";
  }
}

function sanitizeError(error: unknown) {
  if (error instanceof AnalyticsProviderError) {
    return {
      name: error.name,
      message: error.message,
      status: error.status,
      details: error.safeDetails,
    };
  }

  if (error instanceof Error) {
    const errorWithCode = error as Error & {
      code?: unknown;
      details?: unknown;
      status?: unknown;
    };

    return {
      name: error.name,
      message: error.message,
      code: errorWithCode.code,
      status: errorWithCode.status,
      details: errorWithCode.details,
    };
  }

  return {
    name: "UnknownError",
    message: "Unknown error",
  };
}

export function logAnalyticsProviderError(
  providerId: AnalyticsProviderId,
  error: unknown
) {
  console.error(`[admin analytics] ${providerId} unavailable`, sanitizeError(error));
}
