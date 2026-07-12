import Link from "next/link";
import { redirect } from "next/navigation";
import { AnalyticsBarChart } from "@/components/admin/analytics/AnalyticsBarChart";
import { AnalyticsChartCard } from "@/components/admin/analytics/AnalyticsChartCard";
import { AnalyticsDonutChart } from "@/components/admin/analytics/AnalyticsDonutChart";
import { AnalyticsEmptyState } from "@/components/admin/analytics/AnalyticsEmptyState";
import { AnalyticsHorizontalBarChart } from "@/components/admin/analytics/AnalyticsHorizontalBarChart";
import { AnalyticsRefreshControls } from "@/components/admin/analytics/AnalyticsRefreshControls";
import type { AnalyticsChartDatum } from "@/components/admin/analytics/chart-utils";
import { AdminBreadcrumbs } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
 getAdminAnalyticsProviderDashboard,
 parseAnalyticsRange,
} from "@/lib/admin/analytics/dashboard";
import type {
 AnalyticsDevice,
 AnalyticsEventSummary,
 AnalyticsRange,
 AnalyticsRealtime,
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
   return "Últimos 7 días";
  case "30d":
   return "Últimos 30 días";
  case "90d":
   return "Últimos 90 días";
  default:
   return "Últimos 30 días";
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

function ProviderNotice({ message }: { message: string }) {
 return (
  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
   <p className="text-sm font-semibold text-amber-800">{message}</p>
  </div>
 );
}

function pageRows(pages: AnalyticsTopPage[]): AnalyticsChartDatum[] {
 return pages.map((page) => ({
  name: page.path,
  value: page.pageviews,
 }));
}

function referrerRows(sources: AnalyticsTrafficSource[]): AnalyticsChartDatum[] {
 return sources.map((source) => ({
  name: source.source,
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

function realtimeMessage(realtime: AnalyticsRealtime | null | undefined) {
 return (
  realtime?.recentEvents?.[0]?.name ||
  "No disponible desde Vercel Web Analytics API."
 );
}

export default async function AdminVercelAnalyticsPage({
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
 const vercelData = await getAdminAnalyticsProviderDashboard(
  "vercel",
  currentRange
 );

 const overviewMetrics: MetricCard[] = [
  {
   label: "Visitantes",
   value: formatNumber(vercelData?.overview?.visitors),
   description: "Visitantes desde Vercel Web Analytics.",
  },
  {
   label: "Páginas vistas",
   value: formatNumber(vercelData?.overview?.pageviews),
   description: "Páginas vistas desde Vercel Web Analytics.",
  },
 ];

  return (
   <main className="px-4 py-8 md:px-6">
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
     <div className="surface-card p-6 md:p-8">
      <AdminBreadcrumbs
       items={[
        { href: "/admin", label: "Admin" },
        { href: "/admin/analytics", label: "Analytics" },
        { label: "Vercel Analytics" },
       ]}
      />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
       <div>
       <p className="eyebrow">Vercel Analytics</p>
       <h1 className="mt-3 text-3xl font-bold text-[#000000]">
        Web analytics técnico
       </h1>
       <p className="body-base mt-3 max-w-3xl">
        Detalle de visitantes, páginas vistas, rutas, referidos y
        dispositivos desde Vercel Web Analytics.
       </p>
       <p className="mt-3 text-sm font-semibold text-[#11518b]">
        Rango actual: {rangeLabel(currentRange)}
       </p>
      </div>
      <div className="flex flex-wrap gap-3">
       <Link href="/admin/analytics" className="btn-secondary">
        Volver a Analytics
       </Link>
      </div>
     </div>
    </div>

    <AnalyticsRefreshControls
     lastUpdated={lastUpdated}
     mode="manual"
     note="Vercel Analytics se actualiza manualmente para evitar límites de API."
    />

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
     {overviewMetrics.map((metric) => (
      <MetricCard key={metric.label} {...metric} />
     ))}
     <MetricCard
      label="Tiempo real"
      value="N/A"
      description="No disponible desde Vercel Web Analytics API."
     />
     <MetricCard
      label="Eventos"
      value={formatNumber(vercelData?.events.length)}
      description="Eventos personalizados si están disponibles para el plan."
     />
    </section>

    {vercelData.status.status !== "connected" && (
     <ProviderNotice message={vercelData.status.description} />
    )}

    <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
     <AnalyticsChartCard
      eyebrow="Rutas principales"
      title="Rutas principales"
      description="Rutas públicas con más páginas vistas según Vercel."
     >
      <AnalyticsHorizontalBarChart data={pageRows(vercelData?.topPages ?? [])} />
     </AnalyticsChartCard>

     <AnalyticsChartCard
      eyebrow="Referidos"
      title="Referidos"
      description="Dominios de referencia reportados por Vercel."
     >
      <AnalyticsBarChart data={referrerRows(vercelData?.trafficSources ?? [])} />
     </AnalyticsChartCard>

     <AnalyticsChartCard
      eyebrow="Dispositivos"
      title="Dispositivos"
      description="Distribución por dispositivo según Vercel."
     >
      <AnalyticsDonutChart data={deviceRows(vercelData?.devices ?? [])} />
     </AnalyticsChartCard>

     <AnalyticsChartCard
      eyebrow="Eventos"
      title="Eventos"
      description="Eventos personalizados si están disponibles para este proyecto o plan."
     >
      <AnalyticsHorizontalBarChart
       data={eventRows(vercelData?.events ?? [])}
       emptyMessage="Los eventos personalizados no están disponibles en la respuesta actual de Vercel Web Analytics API."
      />
     </AnalyticsChartCard>

     <AnalyticsChartCard
      eyebrow="Tiempo real"
      title="Tiempo real"
      description="Disponibilidad de datos en tiempo real en Vercel Web Analytics API."
     >
      <AnalyticsEmptyState message={realtimeMessage(vercelData?.realtime)} />
     </AnalyticsChartCard>
    </div>
   </div>
  </main>
 );
}
