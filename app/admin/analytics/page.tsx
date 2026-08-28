import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Activity, BarChart3, ChartNoAxesCombined, MousePointer2, Users } from "lucide-react";
import { AnalyticsRefreshControls } from "@/components/admin/analytics/AnalyticsRefreshControls";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { formatPuertoRicoDateTimeShort } from "@/lib/puerto-rico-time";
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
 id: "ga4" | "clarity" | "vercel";
 eyebrow: string;
 title: string;
 description: string;
 href: string;
 buttonLabel: string;
};

const PROVIDER_BRANDING = {
 ga4: { alt: "Google Analytics", src: "/providers/google-analytics.svg" },
 clarity: { alt: "Microsoft Clarity", src: "/providers/microsoft-clarity.svg" },
 vercel: { alt: "Vercel", src: "/providers/vercel-analytics.svg" },
} as const;

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
 return formatPuertoRicoDateTimeShort(date);
}

function OverviewMetricCard({ label, value, description }: OverviewMetric) {
 const Icon = label === "Visitantes" ? Users : label === "Páginas vistas" ? BarChart3 : label === "Conversiones" ? MousePointer2 : Activity;
 return (
  <div className="analytics-kpi">
   <div className="analytics-kpi-icon"><Icon aria-hidden="true" size={18} /></div>
   <div><p>{label}</p><strong>{value}</strong><small>{description}</small></div>
  </div>
 );
}

function ProviderStatusCard({
 providers,
}: {
 providers: AnalyticsProviderStatus[];
}) {
 return (
  <section className="analytics-provider-health">
   <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
    <div>
     <h2 className="mt-2 text-xl font-semibold text-[#000000]">
      Salud de las fuentes
     </h2>
    </div>
    <p className="max-w-xl text-sm leading-relaxed text-[#4d4d4d]">
     Estado actual de las fuentes conectadas al dashboard ejecutivo.
    </p>
   </div>

   <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
    {providers.map((provider) => (
     <div
      key={provider.id}
      className="analytics-provider-status"
     >
      <div className="flex h-full flex-col justify-between gap-4">
       <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2.5">
         {PROVIDER_BRANDING[provider.id as keyof typeof PROVIDER_BRANDING] && <Image alt="" aria-hidden="true" className="analytics-provider-logo is-status" height={24} src={PROVIDER_BRANDING[provider.id as keyof typeof PROVIDER_BRANDING].src} width={24} />}
         <div>
         <h3 className="text-base font-semibold text-[#000000]">
          {provider.name}
         </h3>
         <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
          {provider.description}
         </p>
         </div>
        </div>
        <span
         className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles(
          provider.status
         )}`}
        >
         {statusLabel(provider.status)}
        </span>
       </div>
      </div>
     </div>
    ))}
   </div>
  </section>
 );
}

function ProviderLinkCard({
 id,
 eyebrow,
 title,
 description,
 href,
 buttonLabel,
}: ProviderLink) {
 const brand = PROVIDER_BRANDING[id];
 return (
  <div className="analytics-provider-link">
   <div className="analytics-provider-brand"><Image alt="" aria-hidden="true" className="analytics-provider-logo" height={28} src={brand.src} width={28} /><p>{eyebrow}</p></div><h2>{title}</h2><p>
    {description}
   </p>
   <div className="mt-auto pt-4">
    <Link href={href} className="btn-secondary">
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
   id: "ga4",
   eyebrow: "Google Analytics 4",
   title: "Tráfico y conversiones",
   description:
    "Consulta visitantes, páginas vistas, fuentes, dispositivos, eventos y actividad en tiempo real.",
   href: "/admin/analytics/ga4",
   buttonLabel: "Ver GA4",
  },
  {
   id: "clarity",
   eyebrow: "Microsoft Clarity",
   title: "Comportamiento del usuario",
   description:
    "Revisa señales de experiencia como rage clicks, dead clicks, scroll, errores y páginas populares.",
   href: "/admin/analytics/clarity",
   buttonLabel: "Ver Clarity",
  },
  {
   id: "vercel",
   eyebrow: "Vercel Analytics",
   title: "Web analytics técnico",
   description:
    "Consulta páginas vistas, visitantes, rutas, referidos y dispositivos desde Vercel Analytics.",
   href: "/admin/analytics/vercel",
   buttonLabel: "Ver Vercel",
  },
 ];

 return (
  <main className="px-4 py-5 sm:py-6 md:px-6 lg:px-8">
   <div className="mx-auto w-full max-w-[1480px] space-y-5">
    <div className="analytics-overview-header">
     <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
       <p className="eyebrow">Admin · Analytics</p>
       <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-[#111827] md:text-[1.75rem]">
        Rendimiento del website
       </h1>
       <p className="body-base mt-3 max-w-3xl">
        Una lectura ejecutiva de tráfico, interés y salud de medición.
       </p>
       <p className="mt-3 text-sm font-semibold text-[#11518b]">
        Rango actual: {rangeLabel(currentRange)}
       </p>
      </div>

      <div className="flex flex-wrap gap-2">
       <Link href="/admin" className="btn-secondary">
        Volver al dashboard
       </Link>
       <Link href="/admin/leads" className="btn-secondary">
        Ver leads internos
       </Link>
      </div>
     </div>
    </div>

    <nav className="analytics-subnav" aria-label="Secciones de analytics"><Link href="/admin/analytics" aria-current="page"><ChartNoAxesCombined aria-hidden="true" size={16} />Resumen</Link><Link href="/admin/analytics/ga4">Tráfico y conversión</Link><Link href="/admin/analytics/clarity">Experiencia</Link><Link href="/admin/analytics/vercel">Salud técnica</Link></nav>

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
     <div className="analytics-kpi-grid">
      {overviewMetrics.map((metric) => (
       <OverviewMetricCard key={metric.label} {...metric} />
      ))}
     </div>
    </section>

    <ProviderStatusCard providers={visibleProviders} />

    <section>
     <div className="mb-4">
      <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
       Explorar por contexto
      </h2>
      <p className="body-base mt-2 max-w-3xl">
      Profundiza sin perder de vista la pregunta de negocio que cada fuente responde.
      </p>
     </div>
     <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {providerLinks.map((provider) => (
       <ProviderLinkCard key={provider.href} {...provider} />
      ))}
     </div>
    </section>
   </div>
  </main>
 );
}
