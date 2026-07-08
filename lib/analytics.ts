"use client";

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsValue>;

declare global {
  interface Window {
    gtag?: (
      command: "event",
      eventName: string,
      params?: Record<string, string | number | boolean>
    ) => void;
    clarity?: (command: "event", eventName: string) => void;
  }
}

const isProduction = process.env.NODE_ENV === "production";

function isSafeEventName(eventName: string) {
  return /^[a-z][a-z0-9_]*$/.test(eventName);
}

function sanitizeParams(params: AnalyticsParams = {}) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, value as string | number | boolean])
  );
}

export function trackAnalyticsEvent(
  eventName: string,
  params: AnalyticsParams = {}
) {
  if (!isProduction || typeof window === "undefined" || !isSafeEventName(eventName)) {
    return;
  }

  const safeParams = sanitizeParams(params);

  try {
    window.gtag?.("event", eventName, safeParams);
  } catch {
    // Analytics must never block or break user-facing behavior.
  }

  try {
    window.clarity?.("event", eventName);
  } catch {
    // Clarity custom events are best-effort only.
  }
}
