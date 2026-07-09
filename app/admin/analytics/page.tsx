import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
  getAdminAnalyticsDashboard,
  parseAnalyticsRange,
} from "@/lib/admin/analytics/dashboard";
import type {
  AnalyticsProviderDashboardData,
  AnalyticsProviderStatus,
  AnalyticsRange,
} from "@/lib/admin/analytics/types";

type AnalyticsPlaceholderMetric = {
  label: string;
  value: string;
  description: string;
};

type AnalyticsDisplayRow = {
  label: string;
  value?: string | number;
  description?: string;
};

function formatMetric(value: number | undefined) {
  return typeof value === "number" ? value.toLocaleString("es-PR") : "Pendiente";
}

function rangeLabel(range: AnalyticsRange) {
  switch (range) {
    case "today":
      return "Hoy";
    case "7d":
      return "Ultimos 7 dias";
    case "30d":
      return "Ultimos 30 dias";
    case "90d":
      return "Ultimos 90 dias";
    default:
      return "Ultimos 30 dias";
  }
}

function statusLabel(status: AnalyticsProviderStatus["status"]) {
  switch (status) {
    case "connected":
      return "Connected";
    case "missing_credentials":
      return "Missing credentials";
    case "permission_denied":
      return "Permission denied";
    case "invalid_property_id":
      return "Invalid GA4 property ID";
    case "invalid_private_key":
      return "Invalid private key";
    case "invalid_property":
      return "Invalid GA4 property";
    case "api_not_enabled":
      return "API not enabled";
    case "api_error":
      return "Google API unavailable";
    case "timeout":
      return "Timeout contacting Google";
    case "unknown_error":
      return "Unknown error";
    case "unavailable":
      return "Unavailable";
    case "rate_limited":
      return "Rate limited";
    case "planned":
      return "Planned";
    case "not_configured":
    default:
      return "Not connected yet";
  }
}

function PlaceholderMetricCard({
  label,
  value,
  description,
}: AnalyticsPlaceholderMetric) {
  return (
    <div className="surface-card p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-bold text-[#000000]">{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
        {description}
      </p>
    </div>
  );
}

function EmptyAnalyticsCard({
  eyebrow,
  title,
  description,
  rows,
  emptyMessage = "No data available for the selected date range.",
}: {
  eyebrow: string;
  title: string;
  description: string;
  rows?: AnalyticsDisplayRow[];
  emptyMessage?: string;
}) {
  return (
    <section className="surface-card p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-[#000000]">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
        {description}
      </p>

      <div className="mt-6 rounded-2xl border border-dashed border-[#d9d9d9] bg-[#fafafa] p-6">
        {rows && rows.length > 0 ? (
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div
                key={`${row.label}-${row.value ?? ""}-${index}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-[#e8e8e8] bg-white px-4 py-3"
              >
                <span className="min-w-0 text-sm font-medium text-[#000000]">
                  {row.label}
                  {row.description && (
                    <span className="mt-1 block truncate text-xs font-normal text-[#4d4d4d]">
                      {row.description}
                    </span>
                  )}
                </span>
                {row.value !== undefined && (
                  <span className="shrink-0 text-sm font-semibold text-[#11518b]">
                    {typeof row.value === "number"
                      ? row.value.toLocaleString("es-PR")
                      : row.value}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#4d4d4d]">
            {emptyMessage}
          </p>
        )}
      </div>
    </section>
  );
}

function ProviderStatusCard({
  providers,
}: {
  providers: AnalyticsProviderStatus[];
}) {
  return (
    <section className="surface-card p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
        Provider Status
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
        Estado de integraciones
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
        Este panel permanecera funcional sin credenciales. Las conexiones se
        activaran en fases futuras sin aumentar escrituras en Neon.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {providers.map((provider) => (
          <div
            key={provider.name}
            className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[#000000]">
                  {provider.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
                  {provider.description}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-[#d9d9d9] bg-white px-3 py-1 text-xs font-semibold text-[#4d4d4d]">
                {statusLabel(provider.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function toRealtimeRows(
  provider: AnalyticsProviderDashboardData | undefined,
  unavailableMessage: string
) {
  if (!provider?.realtime) {
    return [{ label: unavailableMessage }];
  }

  return [
    {
      label: "Active users",
      value:
        typeof provider.realtime.activeUsers === "number"
          ? provider.realtime.activeUsers
          : unavailableMessage,
    },
    ...provider.realtime.activePages.map((page) => ({
      label: page.path,
      value: page.users,
      description: "Top active page or screen",
    })),
    ...(provider.realtime.recentEvents ?? []).map((event) => ({
      label: event.name,
      value: event.count,
      description: "Recent realtime event",
    })),
  ] satisfies AnalyticsDisplayRow[];
}

function toTopPageRows(provider: AnalyticsProviderDashboardData | undefined) {
  return (
    provider?.topPages.map((page) => ({
      label: page.path,
      value: page.pageviews,
      description: page.title,
    })) ?? []
  ) satisfies AnalyticsDisplayRow[];
}

function toTrafficRows(provider: AnalyticsProviderDashboardData | undefined) {
  return (
    provider?.trafficSources.map((source) => ({
      label: source.medium ? `${source.source} / ${source.medium}` : source.source,
      value: source.visitors,
      description: "Visitors",
    })) ?? []
  ) satisfies AnalyticsDisplayRow[];
}

function toDeviceRows(provider: AnalyticsProviderDashboardData | undefined) {
  return (
    provider?.devices.map((device) => ({
      label: device.device,
      value: device.visitors,
      description: "Visitors",
    })) ?? []
  ) satisfies AnalyticsDisplayRow[];
}

function toEventRows(provider: AnalyticsProviderDashboardData | undefined) {
  return (
    provider?.events.map((event) => ({
      label: event.name,
      value: event.count,
      description:
        event.visitors !== undefined
          ? `${event.visitors.toLocaleString("es-PR")} visitors`
          : undefined,
    })) ?? []
  ) satisfies AnalyticsDisplayRow[];
}

function ProviderSection({
  eyebrow,
  title,
  description,
  cards,
}: {
  eyebrow: string;
  title: string;
  description: string;
  cards: Array<{
    eyebrow: string;
    title: string;
    description: string;
    rows?: AnalyticsDisplayRow[];
    emptyMessage?: string;
  }>;
}) {
  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
          {title}
        </h2>
        <p className="body-base mt-2 max-w-3xl">{description}</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {cards.map((card) => (
          <EmptyAnalyticsCard
            key={`${eyebrow}-${card.eyebrow}-${card.title}`}
            {...card}
          />
        ))}
      </div>
    </section>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await getAdminSessionUser();

  if (!user) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const currentRange = parseAnalyticsRange(params.range);
  const dashboard = await getAdminAnalyticsDashboard(currentRange);
  const ga4Data = dashboard.providerData.find((provider) => provider.id === "ga4");
  const vercelData = dashboard.providerData.find(
    (provider) => provider.id === "vercel"
  );
  const clarityData = dashboard.providerData.find(
    (provider) => provider.id === "clarity"
  );
  const visibleProviders = dashboard.providers.filter(
    (provider) => provider.id !== "cloudflare"
  );

  const overviewMetrics: AnalyticsPlaceholderMetric[] = [
    {
      label: "Visitantes",
      value: formatMetric(ga4Data?.overview?.visitors),
      description: "Fuente principal: Google Analytics 4.",
    },
    {
      label: "Paginas vistas",
      value: formatMetric(ga4Data?.overview?.pageviews),
      description: "Fuente principal: Google Analytics 4.",
    },
    {
      label: "Conversiones",
      value: (ga4Data?.overview?.conversions ?? 0).toLocaleString("es-PR"),
      description:
        ga4Data?.overview?.conversions && ga4Data.overview.conversions > 0
          ? "Fuente principal: Google Analytics 4."
          : "No hay eventos marcados como Key Events en Google Analytics 4.",
    },
    {
      label: "Sesiones activas",
      value: formatMetric(ga4Data?.realtime?.activeUsers),
      description: "Actividad en tiempo real desde Google Analytics 4.",
    },
  ];

  return (
    <main className="px-6 py-10">
      <div className="section-shell space-y-8">
        <div className="surface-card p-8 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Admin · Analytics</p>
              <h1 className="mt-3 text-3xl font-bold text-[#000000]">
                Analytics Dashboard
              </h1>
              <p className="body-base mt-3 max-w-3xl">
                Vista preparada para consultar metricas externas de trafico,
                comportamiento y eventos sin almacenar mas datos en Neon.
              </p>
              <p className="mt-3 text-sm font-semibold text-[#11518b]">
                Rango actual: {rangeLabel(currentRange)}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className="btn-secondary">
                Volver al dashboard
              </Link>
              <Link
                href="/admin/leads"
                className="btn-secondary"
              >
                Ver leads internos
              </Link>
            </div>
          </div>
        </div>

        <section>
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              Overview
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
              Resumen general
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {overviewMetrics.map((metric) => (
              <PlaceholderMetricCard key={metric.label} {...metric} />
            ))}
          </div>
        </section>

        <ProviderSection
          eyebrow="Google Analytics 4"
          title="Trafico principal del website"
          description="GA4 es la fuente principal para visitantes, paginas, adquisicion, dispositivos y eventos."
          cards={[
            {
              eyebrow: "Realtime",
              title: "Actividad en tiempo real",
              description:
                "Usuarios activos, paginas activas y eventos recientes reportados por GA4.",
              rows: toRealtimeRows(
                ga4Data,
                "Not available from GA4 Realtime API"
              ),
              emptyMessage: "Not available from GA4 Realtime API",
            },
            {
              eyebrow: "Top Pages",
              title: "Paginas principales",
              description: "Rutas publicas con mayor trafico en GA4.",
              rows: toTopPageRows(ga4Data),
            },
            {
              eyebrow: "Traffic Sources",
              title: "Fuentes de trafico",
              description: "Origen y medio de las sesiones reportadas por GA4.",
              rows: toTrafficRows(ga4Data),
            },
            {
              eyebrow: "Devices",
              title: "Dispositivos",
              description: "Distribucion por mobile, desktop y tablet en GA4.",
              rows: toDeviceRows(ga4Data),
            },
            {
              eyebrow: "Events",
              title: "Eventos principales",
              description: "Eventos principales capturados por GA4.",
              rows: toEventRows(ga4Data),
            },
          ]}
        />

        <ProviderSection
          eyebrow="Vercel Analytics"
          title="Web Analytics de infraestructura"
          description="Vercel muestra trafico agregado de rutas, referidos y dispositivos sin mezclarse con GA4."
          cards={[
            {
              eyebrow: "Overview",
              title: "Resumen de Vercel",
              description: "Pageviews y visitantes disponibles desde Vercel.",
              rows: [
                {
                  label: "Pageviews",
                  value:
                    vercelData?.overview?.pageviews !== undefined
                      ? vercelData.overview.pageviews
                      : "No data available for the selected date range.",
                },
                {
                  label: "Visitors",
                  value:
                    vercelData?.overview?.visitors !== undefined
                      ? vercelData.overview.visitors
                      : "No data available for the selected date range.",
                },
              ],
            },
            {
              eyebrow: "Top Routes",
              title: "Rutas principales",
              description: "Rutas con mas pageviews segun Vercel.",
              rows: toTopPageRows(vercelData),
            },
            {
              eyebrow: "Referrers",
              title: "Referidos",
              description: "Dominios de referencia reportados por Vercel.",
              rows: toTrafficRows(vercelData),
            },
            {
              eyebrow: "Devices",
              title: "Dispositivos",
              description: "Distribucion por dispositivo segun Vercel.",
              rows: toDeviceRows(vercelData),
            },
            {
              eyebrow: "Realtime",
              title: "Tiempo real",
              description:
                "Vercel Web Analytics API no ofrece datos realtime en este panel.",
              rows: toRealtimeRows(
                vercelData,
                "Not available from Vercel Web Analytics API."
              ),
            },
            {
              eyebrow: "Events",
              title: "Eventos",
              description:
                "Si los eventos personalizados no estan disponibles en el plan actual, se mostrara como no disponible.",
              rows: toEventRows(vercelData),
              emptyMessage:
                "Custom events are not available from the current Vercel Web Analytics API response.",
            },
          ]}
        />

        <ProviderSection
          eyebrow="Microsoft Clarity"
          title="Insights de comportamiento"
          description="Clarity se usa para senales de experiencia como clics de frustracion, scroll y errores."
          cards={[
            {
              eyebrow: "Popular Pages",
              title: "Paginas populares",
              description: "URLs con actividad capturada por Clarity.",
              rows: toTopPageRows(clarityData),
            },
            {
              eyebrow: "Devices",
              title: "Dispositivos",
              description: "Distribucion por dispositivo en Clarity.",
              rows: toDeviceRows(clarityData),
            },
            {
              eyebrow: "Sources",
              title: "Fuentes",
              description: "Fuentes y medios disponibles desde Clarity.",
              rows: toTrafficRows(clarityData),
            },
            {
              eyebrow: "Behavior",
              title: "Senales de comportamiento",
              description:
                "Rage clicks, dead clicks, quick backs, scroll y errores agregados.",
              rows: toEventRows(clarityData),
            },
          ]}
        />

        <ProviderStatusCard providers={visibleProviders} />
      </div>
    </main>
  );
}
