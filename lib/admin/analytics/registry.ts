import { clarityProvider } from "./providers/clarity";
import { cloudflareProvider } from "./providers/cloudflare";
import { ga4Provider } from "./providers/ga4";
import { vercelProvider } from "./providers/vercel";
import type { AnalyticsProvider } from "./types";

export const analyticsProviders: AnalyticsProvider[] = [
  ga4Provider,
  clarityProvider,
  vercelProvider,
  cloudflareProvider,
];
