import Link from "next/link";
import { redirect } from "next/navigation";
import { AnalyticsRefreshControls } from "@/components/admin/analytics/AnalyticsRefreshControls";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
 getAdminAnalyticsDashboard,
 parseAnalyticsRange,
} from "@/lib/admin/analytics/dashboard";
import type {
 AnalyticsProviderStatus,
 AnalyticsRange,
} from "@/lib/admin/analytics/types";

type OverviewMetric = {
 label: string;
 value: string;
 description: string;
};

type ProviderLink = {
 eyebrow: string;
 title: string;
 description: string;
 href: string;
 buttonLabel: string;
};

function formatMetric(value: number | undefined) {
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

function statusLabel(status: AnalyticsProviderStatus["status"]) {
 switch (status) {
  case "connected":
   return "Conectado";
  case "missing_credentials":
   return "Credenciales faltantes";
  case "permission_denied":
   return "Permiso denegado";
  case "invalid_property_id":
   return "ID de propiedad GA4 inválido";
  case "invalid_private_key":
   return "Private key inválida";
  case "invalid_property":
   return "Propiedad GA4 inválida";
  case "api_not_enabled":
   return "API no habilitada";
  case "api_error":
   return "API de Google no disponible";
  case "timeout":
   return "Timeout contactando Google";
  case "unknown_error":
   return "Error desconocido";
  case "unavailable":
   return "No disponible";
  case "rate_limited":
   return "Límite alcanzado";
  case "planned":
   return "Planificado";
  case "not_configured":
  default:
   return "No conectado todavía";
 }
}

function statusStyles(status: AnalyticsProviderStatus["status"]) {
 switch (status) {
  case "connected":
   return "border-emerald-200 bg-emerald-50 text-emerald-700";
  case "rate_limited":
  case "timeout":
   return "border-amber-200 bg-amber-50 text-amber-700";
  case "not_configured":
  case "planned":
   return "border-[#d9d9d9] bg-white text-[#4d4d4d]";
  default:
   return "border-red-200 bg-red-50 text-red-700";
 }
}

function formatUpdatedAt(date: Date) {
 return new Intl.DateTimeFormat("es-PR", {
  dateStyle: "medium",
  timeStyle: "short",
 }).format(date);
}

function OverviewMetricCard({ label, value, description }: OverviewMetric) {
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

function ProviderStatusCard({
 providers,
}: {
 providers: AnalyticsProviderStatus[];
}) {
 return (
  <section className="surface-card p-5">
   <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
    <div>
     <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
      Estado de integraciones
     </p>
     <h2 className="mt-2 text-xl font-semibold text-[#000000]">
      Estado de integraciones
     </h2>
    </div>
    <p className="max-w-xl text-sm leading-relaxed text-[#4d4d4d]">
     Estado actual de las fuentes conectadas al dashboard ejecutivo.
    </p>
   </div>

   <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {providers.map((provider) => (
     <div
      key={provider.id}
      className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-4"
     >
      <div className="flex h-full flex-col justify-between gap-4">
       <div className="flex items-start justify-between gap-4">
        <div>
         <h3 className="text-base font-semibold text-[#000000]">
          {provider.name}
         </h3>
         <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
          {provider.description}
         </p>
        </div>
        <span
         className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles(
          provider.status
         )}`}
        >
         {statusLabel(provider.status)}
        </span>
       </div>
       <div className="h-2 overflow-hidden rounded-full bg-[#e8e8e8]">
        <div
         className={`h-full rounded-full ${
          provider.status === "connected"
           ? "w-full bg-[#11518b]"
           : "w-1/3 bg-[#d4af37]"
         }`}
        />
       </div>
      </div>
     </div>
    ))}
   </div>
  </section>
 );
}

function ProviderLinkCard({
 eyebrow,
 title,
 description,
 href,
 buttonLabel,
}: ProviderLink) {
 return (
  <div className="surface-card flex h-full flex-col p-5">
   <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
    {eyebrow}
   </p>
   <h2 className="mt-3 text-xl font-semibold text-[#000000]">{title}</h2>
   <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
    {description}
   </p>
   <div className="mt-auto pt-4">
    <Link href={href} className="btn-primary">
     {buttonLabel}
    </Link>
   </div>
  </div>
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
 const lastUpdated = formatUpdatedAt(new Date());
 const dashboard = await getAdminAnalyticsDashboard(currentRange);
 const ga4Data = dashboard.providerData.find((provider) => provider.id === "ga4");
 const visibleProviders = dashboard.providers.filter(
  (provider) => provider.id !== "cloudflare"
 );

 const overviewMetrics: OverviewMetric[] = [
  {
   label: "Visitantes",
   value: formatMetric(ga4Data?.overview?.visitors),
   description: "Fuente principal: Google Analytics 4.",
  },
  {
   label: "Páginas vistas",
   value: formatMetric(ga4Data?.overview?.pageviews),
   description: "Fuente principal: Google Analytics 4.",
  },
  {
   label: "Conversiones",
   value: (ga4Data?.overview?.conversions ?? 0).toLocaleString("es-PR"),
   description:
    ga4Data?.overview?.conversions && ga4Data.overview.conversions > 0
     ? "Fuente principal: Google Analytics 4."
     : "No hay eventos marcados como Key Eventos en Google Analytics 4.",
  },
  {
   label: "Sesiones activas",
   value: formatMetric(ga4Data?.realtime?.activeUsers),
   description: "Actividad en tiempo real desde Google Analytics 4.",
  },
 ];

 const providerLinks: ProviderLink[] = [
  {
   eyebrow: "Google Analytics 4",
   title: "Tráfico y conversiones",
   description:
    "Consulta visitantes, páginas vistas, fuentes, dispositivos, eventos y actividad en tiempo real.",
   href: "/admin/analytics/ga4",
   buttonLabel: "Ver GA4",
  },
  {
   eyebrow: "Microsoft Clarity",
   title: "Comportamiento del usuario",
   description:
    "Revisa señales de experiencia como rage clicks, dead clicks, scroll, errores y páginas populares.",
   href: "/admin/analytics/clarity",
   buttonLabel: "Ver Clarity",
  },
  {
   eyebrow: "Vercel Analytics",
   title: "Web analytics técnico",
   description:
    "Consulta páginas vistas, visitantes, rutas, referidos y dispositivos desde Vercel Analytics.",
   href: "/admin/analytics/vercel",
   buttonLabel: "Ver Vercel",
  },
 ];

 return (
  <main className="px-4 py-8 md:px-6">
   <div className="mx-auto w-full max-w-[1600px] space-y-6">
    <div className="surface-card p-6 md:p-8">
     <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
       <p className="eyebrow">Admin · Analytics</p>
       <h1 className="mt-3 text-3xl font-bold text-[#000000]">
        Dashboard de analytics
       </h1>
       <p className="body-base mt-3 max-w-3xl">
        Hub ejecutivo para revisar el rendimiento del website sin
        mezclar datos entre proveedores.
       </p>
       <p className="mt-3 text-sm font-semibold text-[#11518b]">
        Rango actual: {rangeLabel(currentRange)}
       </p>
      </div>

      <div className="flex flex-wrap gap-3">
       <Link href="/admin" className="btn-secondary">
        Volver al dashboard
       </Link>
       <Link href="/admin/leads" className="btn-secondary">
        Ver leads internos
       </Link>
      </div>
     </div>
    </div>

    <AnalyticsRefreshControls lastUpdated={lastUpdated} mode="manual" />

    <section>
     <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
       Resumen ejecutivo
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
       Resumen ejecutivo
      </h2>
      </div>
      <p className="text-sm font-semibold text-[#11518b]">
       Fuente principal: Google Analytics 4
      </p>
     </div>
     <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {overviewMetrics.map((metric) => (
       <OverviewMetricCard key={metric.label} {...metric} />
      ))}
     </div>
    </section>

    <ProviderStatusCard providers={visibleProviders} />

    <section>
     <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
       Dashboards por proveedor
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
       Análisis por proveedor
      </h2>
      <p className="body-base mt-2 max-w-3xl">
       Cada proveedor tendra su propia vista para evitar duplicados y
       mantener lecturas claras.
      </p>
     </div>
     <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {providerLinks.map((provider) => (
       <ProviderLinkCard key={provider.href} {...provider} />
      ))}
     </div>
    </section>
   </div>
  </main>
 );
}
