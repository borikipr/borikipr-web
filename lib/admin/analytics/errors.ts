import type { AnalyticsProviderId } from "./types";

export class AnalyticsProviderError extends Error {
  constructor(
    message: string,
    public readonly providerId: AnalyticsProviderId
  ) {
    super(message);
    this.name = "AnalyticsProviderError";
  }
}

export function logAnalyticsProviderError(
  providerId: AnalyticsProviderId,
  error: unknown
) {
  const message = error instanceof Error ? error.message : "Unknown error";

  console.warn(`[admin analytics] ${providerId} unavailable: ${message}`);
}
