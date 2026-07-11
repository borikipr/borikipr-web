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
  AnalyticsRange,
  AnalyticsTopPage,
  AnalyticsTrafficSource,
} from "@/lib/admin/analytics/types";

type MetricCard = {
  label: string;
  value: string;
  description: string;
};

const behaviorLabels: Record<string, string> = {
  rage_clicks: "Rage clicks",
  dead_clicks: "Dead clicks",
  quick_backs: "Quick backs",
  excessive_scrolling: "Excessive scrolling",
  script_errors: "Script errors",
  error_clicks: "Error clicks",
};

function formatNumber(value: number | undefined) {
  return typeof value === "number" ? value.toLocaleString("es-PR") : "0";
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

function behaviorValue(events: AnalyticsEventSummary[], name: string) {
  return events.find((event) => event.name === name)?.count;
}

function behaviorRows(events: AnalyticsEventSummary[]): AnalyticsChartDatum[] {
  return Object.entries(behaviorLabels).map(([key, label]) => ({
    name: label,
    value: behaviorValue(events, key) ?? 0,
  }));
}

export default async function AdminClarityAnalyticsPage({
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
  const clarityData = await getAdminAnalyticsProviderDashboard(
    "clarity",
    currentRange
  );
  const behaviorEvents = clarityData?.events ?? [];

  const overviewMetrics: MetricCard[] = [
    {
      label: "Paginas populares",
      value: formatNumber(clarityData?.topPages.length),
      description: "URLs publicas con actividad agregada en Clarity.",
    },
    {
      label: "Dispositivos",
      value: formatNumber(clarityData?.devices.length),
      description: "Categorias de dispositivo disponibles.",
    },
    {
      label: "Fuentes",
      value: formatNumber(clarityData?.trafficSources.length),
      description: "Fuentes y medios disponibles desde Clarity.",
    },
    {
      label: "Rage clicks",
      value: formatNumber(behaviorValue(behaviorEvents, "rage_clicks")),
      description: "Clics repetidos que pueden indicar frustracion.",
    },
    {
      label: "Dead clicks",
      value: formatNumber(behaviorValue(behaviorEvents, "dead_clicks")),
      description: "Clics en elementos que no responden.",
    },
    {
      label: "Script errors",
      value: formatNumber(behaviorValue(behaviorEvents, "script_errors")),
      description: "Errores de JavaScript detectados por Clarity.",
    },
    {
      label: "Scroll depth",
      value: formatNumber(behaviorValue(behaviorEvents, "scroll_depth")),
      description: "Metrica agregada disponible desde Clarity.",
    },
    {
      label: "Engagement time",
      value: formatNumber(behaviorValue(behaviorEvents, "engagement_time")),
      description: "Tiempo de interaccion agregado desde Clarity.",
    },
  ];

  return (
    <main className="px-4 py-8 md:px-6">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <div className="surface-card p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Microsoft Clarity</p>
              <h1 className="mt-3 text-3xl font-bold text-[#000000]">
                Comportamiento del usuario
              </h1>
              <p className="body-base mt-3 max-w-3xl">
                Detalle de paginas populares, dispositivos, fuentes y senales
                de comportamiento agregadas desde Microsoft Clarity.
              </p>
              <p className="mt-3 text-sm font-semibold text-[#11518b]">
                Rango actual: {rangeLabel(currentRange)} · Clarity API consulta
                los ultimos 3 dias disponibles
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
          mode="disabled"
          note="Clarity insights update approximately every 12 hours to protect the API limit."
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {overviewMetrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </section>

        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          <AnalyticsChartCard
            eyebrow="Popular Pages"
            title="Paginas y URLs"
            description="Paginas publicas con actividad agregada por Clarity."
          >
            <AnalyticsHorizontalBarChart data={pageRows(clarityData?.topPages ?? [])} />
          </AnalyticsChartCard>

          <AnalyticsChartCard
            eyebrow="Behavior Signals"
            title="Senales de comportamiento"
            description="Rage clicks, dead clicks, quick backs, scroll y errores agregados."
          >
            <AnalyticsHorizontalBarChart
              data={behaviorRows(behaviorEvents)}
              emptyMessage="No behavioral signals available for the selected date range."
            />
          </AnalyticsChartCard>

          <AnalyticsChartCard
            eyebrow="Devices"
            title="Dispositivos"
            description="Categorias de dispositivo reportadas por Clarity."
          >
            <AnalyticsDonutChart data={deviceRows(clarityData?.devices ?? [])} />
          </AnalyticsChartCard>

          <AnalyticsChartCard
            eyebrow="Traffic Sources"
            title="Fuentes de trafico"
            description="Fuentes y medios agregados disponibles desde Clarity."
          >
            <AnalyticsBarChart data={sourceRows(clarityData?.trafficSources ?? [])} />
          </AnalyticsChartCard>
        </div>
      </div>
    </main>
  );
}
