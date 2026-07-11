import Link from "next/link";
import { redirect } from "next/navigation";
import { AnalyticsBarChart } from "@/components/admin/analytics/AnalyticsBarChart";
import { AnalyticsChartCard } from "@/components/admin/analytics/AnalyticsChartCard";
import { AnalyticsDonutChart } from "@/components/admin/analytics/AnalyticsDonutChart";
import { AnalyticsHorizontalBarChart } from "@/components/admin/analytics/AnalyticsHorizontalBarChart";
import { AnalyticsRefreshControls } from "@/components/admin/analytics/AnalyticsRefreshControls";
import type { AnalyticsChartDatum } from "@/components/admin/analytics/chart-utils";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
  getAdminAnalyticsProviderDashboard,
  parseAnalyticsRange,
} from "@/lib/admin/analytics/dashboard";
import type {
  AnalyticsDevice,
  AnalyticsEventSummary,
  AnalyticsFunnel,
  AnalyticsProviderDashboardData,
  AnalyticsRange,
  AnalyticsTopPage,
  AnalyticsTrafficSource,
} from "@/lib/admin/analytics/types";

type MetricCard = {
  label: string;
  value: string;
  description: string;
};

function formatNumber(value: number | undefined) {
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

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat("es-PR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function MetricCard({ label, value, description }: MetricCard) {
  return (
    <div className="surface-card overflow-hidden p-0">
      <div className="h-1 bg-[#11518b]" />
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
          {label}
        </p>
        <p className="mt-2 text-2xl font-bold text-[#000000]">{value}</p>
        <p className="mt-2 text-xs leading-relaxed text-[#4d4d4d]">
          {description}
        </p>
      </div>
    </div>
  );
}

function pageRows(pages: AnalyticsTopPage[]): AnalyticsChartDatum[] {
  return pages.map((page) => ({
    name: page.path,
    value: page.pageviews,
    detail: page.title,
  }));
}

function sourceRows(sources: AnalyticsTrafficSource[]): AnalyticsChartDatum[] {
  return sources.map((source) => ({
    name: source.medium ? `${source.source} / ${source.medium}` : source.source,
    value: source.visitors,
  }));
}

function deviceRows(devices: AnalyticsDevice[]): AnalyticsChartDatum[] {
  return devices.map((device) => ({
    name: device.device,
    value: device.visitors,
  }));
}

function eventRows(events: AnalyticsEventSummary[]): AnalyticsChartDatum[] {
  return events.map((event) => ({
    name: event.name,
    value: event.count,
  }));
}

function formatRate(value: number) {
  return `${value.toFixed(1)}%`;
}

function conversionRate(from: number, to: number) {
  if (from <= 0) return 0;
  return (to / from) * 100;
}

function FunnelSection({ funnel }: { funnel: AnalyticsFunnel | null | undefined }) {
  const stages = funnel?.stages ?? [];
  const maxCount = Math.max(...stages.map((stage) => stage.count), 1);
  const firstStage = stages[0]?.count ?? 0;
  const lastStage = stages[stages.length - 1]?.count ?? 0;
  const overallRate = conversionRate(firstStage, lastStage);

  if (stages.length === 0) {
    return (
      <AnalyticsChartCard
        eyebrow="Embudo inmobiliario"
        title="No hay datos del embudo"
        description="GA4 no devolvio eventos de embudo para el rango seleccionado."
      >
        <p className="rounded-2xl border border-dashed border-[#d9d9d9] bg-[#fafafa] p-5 text-sm text-[#4d4d4d]">
          Cuando GA4 registre eventos como property_view o formularios enviados,
          apareceran aqui.
        </p>
      </AnalyticsChartCard>
    );
  }

  return (
    <section className="surface-card p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
            Embudo inmobiliario
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#000000]">
            Visitas a leads
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#4d4d4d]">
            Embudo basado exclusivamente en eventos de Google Analytics 4. Los
            duplicados y errores se muestran como contexto, no como conversiones.
          </p>
        </div>
        <div className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4af37]">
            Conversion total
          </p>
          <p className="mt-1 text-2xl font-bold text-[#11518b]">
            {formatRate(overallRate)}
          </p>
          <p className="mt-1 text-xs text-[#4d4d4d]">
            Website visits a successful form submissions
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {stages.map((stage, index) => {
          const previous = stages[index - 1]?.count;
          const stageRate =
            previous === undefined ? null : conversionRate(previous, stage.count);
          const width = Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 8 : 0);

          return (
            <div
              key={stage.id}
              className="rounded-2xl border border-[#e8e8e8] bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d4af37]">
                Stage {index + 1}
              </p>
              <h3 className="mt-2 text-base font-semibold text-[#000000]">
                {stage.label}
              </h3>
              <p className="mt-3 text-3xl font-bold text-[#11518b]">
                {stage.count.toLocaleString("es-PR")}
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e8e8e8]">
                <div
                  className="h-full rounded-full bg-[#11518b]"
                  style={{ width: `${width}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#4d4d4d]">
                {stageRate === null
                  ? "Punto de entrada del embudo."
                  : `${formatRate(stageRate)} desde la etapa anterior.`}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-[#6b7280]">
                {stage.eventNames.join(", ")}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d4af37]">
            Duplicate / non-conversion
          </p>
          <p className="mt-2 text-2xl font-bold text-[#000000]">
            {(funnel?.duplicateCount ?? 0).toLocaleString("es-PR")}
          </p>
          <p className="mt-1 text-sm text-[#4d4d4d]">
            priority_registration_duplicate, not counted as new conversions.
          </p>
        </div>
        <div className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d4af37]">
            Submit errors
          </p>
          <p className="mt-2 text-2xl font-bold text-[#000000]">
            {(funnel?.errorCount ?? 0).toLocaleString("es-PR")}
          </p>
          <p className="mt-1 text-sm text-[#4d4d4d]">
            priority_registration_submit_error, not counted as conversions.
          </p>
        </div>
      </div>
    </section>
  );
}

function realtimeRows(
  ga4Data: AnalyticsProviderDashboardData | undefined
): AnalyticsChartDatum[] {
  return (
    ga4Data?.realtime?.activePages.map((page) => ({
      name: page.path,
      value: page.users,
    })) ?? []
  );
}

function realtimeEventRows(
  ga4Data: AnalyticsProviderDashboardData | undefined
): AnalyticsChartDatum[] {
  return (
    ga4Data?.realtime?.recentEvents?.map((event) => ({
      name: event.name,
      value: event.count,
    })) ?? []
  );
}

export default async function AdminGa4AnalyticsPage({
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
  const lastUpdated = formatUpdatedAt(new Date());
  const ga4Data = await getAdminAnalyticsProviderDashboard("ga4", currentRange);
  const conversions = ga4Data?.overview?.conversions ?? 0;

  const overviewMetrics: MetricCard[] = [
    {
      label: "Visitantes",
      value: formatNumber(ga4Data?.overview?.visitors),
      description: "Usuarios totales reportados por GA4.",
    },
    {
      label: "Paginas vistas",
      value: formatNumber(ga4Data?.overview?.pageviews),
      description: "Pageviews publicos reportados por GA4.",
    },
    {
      label: "Sesiones",
      value: formatNumber(ga4Data?.overview?.sessions),
      description: "Sesiones publicas reportadas por GA4.",
    },
    {
      label: "Eventos",
      value: formatNumber(ga4Data?.overview?.events),
      description: "Eventos totales reportados por GA4.",
    },
    {
      label: "Key Events",
      value: conversions.toLocaleString("es-PR"),
      description:
        conversions > 0
          ? "Conversiones marcadas como Key Events en GA4."
          : "No hay eventos marcados como Key Events en Google Analytics 4.",
    },
    {
      label: "Usuarios activos",
      value: formatNumber(ga4Data?.realtime?.activeUsers),
      description: "Actividad realtime desde GA4.",
    },
  ];

  return (
    <main className="px-4 py-8 md:px-6">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <div className="surface-card p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Google Analytics 4</p>
              <h1 className="mt-3 text-3xl font-bold text-[#000000]">
                Trafico y conversiones
              </h1>
              <p className="body-base mt-3 max-w-3xl">
                Detalle de visitantes, paginas, fuentes, dispositivos, eventos,
                Key Events y actividad en tiempo real desde GA4.
              </p>
              <p className="mt-3 text-sm font-semibold text-[#11518b]">
                Rango actual: {rangeLabel(currentRange)}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/analytics" className="btn-secondary">
                Volver a analytics
              </Link>
              <Link href="/admin" className="btn-secondary">
                Volver al dashboard
              </Link>
            </div>
          </div>
        </div>

        <AnalyticsRefreshControls
          lastUpdated={lastUpdated}
          mode="live"
          note="GA4 live mode refreshes only this provider page and never faster than every 30 seconds."
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {overviewMetrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </section>

        <FunnelSection funnel={ga4Data?.funnel} />

        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          <AnalyticsChartCard
            eyebrow="Realtime"
            title="Usuarios activos"
            description="Paginas o pantallas activas reportadas por GA4 Realtime."
          >
            <AnalyticsHorizontalBarChart
              data={realtimeRows(ga4Data)}
              emptyMessage="Not available from GA4 Realtime API"
              height={220}
            />
          </AnalyticsChartCard>

          <AnalyticsChartCard
            eyebrow="Top Pages"
            title="Paginas principales"
            description="Rutas publicas con mas paginas vistas segun GA4."
          >
            <AnalyticsHorizontalBarChart data={pageRows(ga4Data?.topPages ?? [])} />
          </AnalyticsChartCard>

          <AnalyticsChartCard
            eyebrow="Traffic Sources"
            title="Fuentes de trafico"
            description="Origen y medio de las visitas reportadas por GA4."
          >
            <AnalyticsBarChart data={sourceRows(ga4Data?.trafficSources ?? [])} />
          </AnalyticsChartCard>

          <AnalyticsChartCard
            eyebrow="Devices"
            title="Dispositivos"
            description="Distribucion por mobile, desktop y tablet."
          >
            <AnalyticsDonutChart data={deviceRows(ga4Data?.devices ?? [])} />
          </AnalyticsChartCard>

          <AnalyticsChartCard
            eyebrow="Top Events"
            title="Eventos principales"
            description="Eventos con mayor volumen en GA4."
          >
            <AnalyticsHorizontalBarChart data={eventRows(ga4Data?.events ?? [])} />
          </AnalyticsChartCard>

          <AnalyticsChartCard
            eyebrow="Realtime Events"
            title="Eventos en tiempo real"
            description="Eventos recientes disponibles desde GA4 Realtime."
          >
            <AnalyticsHorizontalBarChart
              data={realtimeEventRows(ga4Data)}
              emptyMessage="Not available from GA4 Realtime API"
              height={220}
            />
          </AnalyticsChartCard>

          <AnalyticsChartCard
            eyebrow="Conversions"
            title="Key Events"
            description="Conversiones configuradas como Key Events en Google Analytics 4."
          >
            <AnalyticsBarChart
              data={
                conversions > 0
                  ? [{ name: "Total Key Events", value: conversions }]
                  : []
              }
              emptyMessage="No hay eventos marcados como Key Events en Google Analytics 4."
              height={220}
            />
          </AnalyticsChartCard>
        </div>
      </div>
    </main>
  );
}
