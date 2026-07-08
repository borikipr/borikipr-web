export type AnalyticsProviderStatus = {
  name: string;
  status: string;
  description: string;
};

export type AnalyticsPlaceholderMetric = {
  label: string;
  value: string;
  description: string;
};

export const analyticsOverviewPlaceholders: AnalyticsPlaceholderMetric[] = [
  {
    label: "Visitantes",
    value: "Pendiente",
    description: "Se conectara con datos agregados de trafico.",
  },
  {
    label: "Paginas vistas",
    value: "Pendiente",
    description: "Mostrara volumen de navegacion del website.",
  },
  {
    label: "Conversiones",
    value: "Pendiente",
    description: "Resumira eventos clave cuando las APIs esten conectadas.",
  },
  {
    label: "Sesiones activas",
    value: "Pendiente",
    description: "Espacio reservado para actividad en tiempo real.",
  },
];

export const analyticsProviderStatuses: AnalyticsProviderStatus[] = [
  {
    name: "Google Analytics 4",
    status: "Not connected yet",
    description: "Preparado para conectarse al GA4 Data API en una fase futura.",
  },
  {
    name: "Microsoft Clarity",
    status: "Not connected yet",
    description: "Preparado para mostrar senales de experiencia y sesiones.",
  },
  {
    name: "Vercel Analytics",
    status: "Not connected yet",
    description: "Preparado para consultar trafico y eventos agregados.",
  },
  {
    name: "Cloudflare Analytics",
    status: "Planned",
    description: "Reservado para una integracion futura si se requiere.",
  },
];
