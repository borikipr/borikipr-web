import type { AnalyticsProvider } from "../types";

export const vercelProvider: AnalyticsProvider = {
  id: "vercel",
  name: "Vercel Analytics",
  description: "Preparado para consultar trafico y eventos agregados.",
  isConfigured: () => false,
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      status: "not_configured",
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
