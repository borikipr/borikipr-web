import type { AnalyticsProvider } from "../types";

export const cloudflareProvider: AnalyticsProvider = {
  id: "cloudflare",
  name: "Cloudflare Analytics",
  description: "Reservado para una integracion futura si se requiere.",
  isConfigured: () => false,
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      status: "planned",
      description: this.description,
    };
  },
  getOverview: () => null,
  getRealtime: () => null,
  getTopPages: () => [],
  getTrafficSources: () => [],
  getDevices: () => [],
  getEvents: () => [],
};
