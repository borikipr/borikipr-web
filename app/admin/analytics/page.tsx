import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
  getAdminAnalyticsDashboard,
  parseAnalyticsRange,
} from "@/lib/admin/analytics/dashboard";
import type {
  AnalyticsProviderStatus,
  AnalyticsRange,
} from "@/lib/admin/analytics/types";

type AnalyticsPlaceholderMetric = {
  label: string;
  value: string;
  description: string;
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
}: {
  eyebrow: string;
  title: string;
  description: string;
  rows?: string[];
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
            {rows.map((row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-4 rounded-xl border border-[#e8e8e8] bg-white px-4 py-3"
              >
                <span className="text-sm font-medium text-[#000000]">{row}</span>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#11518b]">
                  Pendiente
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#4d4d4d]">
            Esta seccion esta lista para recibir datos externos cuando se conecte
            el proveedor correspondiente.
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

  const overviewMetrics: AnalyticsPlaceholderMetric[] = [
    {
      label: "Visitantes",
      value: formatMetric(dashboard.overview.visitors),
      description: "Se conectara con datos agregados de trafico.",
    },
    {
      label: "Paginas vistas",
      value: formatMetric(dashboard.overview.pageviews),
      description: "Mostrara volumen de navegacion del website.",
    },
    {
      label: "Conversiones",
      value: formatMetric(dashboard.overview.conversions),
      description: "Resumira eventos clave cuando las APIs esten conectadas.",
    },
    {
      label: "Sesiones activas",
      value: formatMetric(dashboard.realtime.activeUsers),
      description: "Espacio reservado para actividad en tiempo real.",
    },
  ];

  const topPageRows =
    dashboard.topPages.length > 0
      ? dashboard.topPages.map((page) => page.path)
      : ["/", "/listados", "/contact", "/testimonios"];

  const trafficRows =
    dashboard.trafficSources.length > 0
      ? dashboard.trafficSources.map((source) =>
          source.medium ? `${source.source} / ${source.medium}` : source.source
        )
      : ["Organic search", "Direct", "Social", "Referral"];

  const deviceRows =
    dashboard.devices.length > 0
      ? dashboard.devices.map((device) => device.device)
      : ["Mobile", "Desktop", "Tablet"];

  const eventRows =
    dashboard.events.length > 0
      ? dashboard.events.map((event) => event.name)
      : [
          "property_view",
          "whatsapp_click",
          "priority_registration_submit_success",
          "buyer_tenant_form_submit_success",
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

        <div className="grid gap-6 xl:grid-cols-2">
          <EmptyAnalyticsCard
            eyebrow="Realtime"
            title="Actividad en tiempo real"
            description="Espacio reservado para sesiones activas, usuarios actuales y paginas vistas recientes."
            rows={["Usuarios activos", "Paginas vistas recientes", "Eventos recientes"]}
          />

          <EmptyAnalyticsCard
            eyebrow="Top Pages"
            title="Paginas principales"
            description="Mostrara las rutas publicas con mayor trafico cuando la fuente externa este conectada."
            rows={topPageRows}
          />

          <EmptyAnalyticsCard
            eyebrow="Traffic Sources"
            title="Fuentes de trafico"
            description="Preparado para agrupar visitas por origen, medio, campana o referido."
            rows={trafficRows}
          />

          <EmptyAnalyticsCard
            eyebrow="Devices"
            title="Dispositivos"
            description="Mostrara la distribucion de visitas por mobile, desktop y tablet."
            rows={deviceRows}
          />

          <EmptyAnalyticsCard
            eyebrow="Events"
            title="Eventos principales"
            description="Preparado para resumir eventos de contacto, formularios y actividad de propiedades."
            rows={eventRows}
          />

          <ProviderStatusCard providers={dashboard.providers} />
        </div>
      </div>
    </main>
  );
}
