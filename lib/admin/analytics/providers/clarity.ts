import type { AnalyticsProvider } from "../types";

export const clarityProvider: AnalyticsProvider = {
  id: "clarity",
  name: "Microsoft Clarity",
  description: "Preparado para mostrar senales de experiencia y sesiones.",
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
