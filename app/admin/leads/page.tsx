import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import CollapsibleAdminSection from "@/components/admin/CollapsibleAdminSection";
import CopyLeadValueButton from "@/components/admin/CopyLeadValueButton";
import { AnalyticsHorizontalBarChart } from "@/components/admin/analytics/AnalyticsHorizontalBarChart";
import StatusBadge from "@/components/admin/StatusBadge";
import {
 getGa4PropertyDigitalInterest,
 type Ga4PropertyDigitalInterest,
} from "@/lib/admin/analytics/providers/ga4";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
 getActionRequiredSummary,
 getComingSoonPropertiesWithRegistrations,
 getHighRecentDirectInterest,
 getLeadDirectInteractionCountsByPropertyRange,
 getLeadSubmissionSummary,
 getLeadsActividadReciente,
 getLeadDailyTotals,
 getLeadPersistedSubmissionCountsByPropertyRange,
 getLeadPropertyFilterInfo,
 getLeadPropertyMetadataBySlugs,
 getPriorityRegistrationLeads,
 getLeadRouteOrigins,
 getLeadsResumen,
 getShowingProfileLeads,
 type LeadDailyTotal,
 type LeadEventFilter,
 type LeadRange,
 type LeadRouteOrigin,
 type ComingSoonRegistrationItem,
 type HighRecentDirectInterestItem,
 type PriorityRegistrationLead,
 type ShowingProfileLead,
} from "@/lib/admin/queries/leads";

function StatCard({
 label,
 value,
 description,
}: {
 label: string;
 value: string | number;
 description: string;
}) {
 return (
  <div className="surface-card p-6">
   <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
    {label}
   </p>
   <p className="mt-3 text-3xl font-bold text-[#000000]">{value}</p>
   <p className="mt-2 text-sm text-[#4d4d4d]">{description}</p>
  </div>
 );
}

function ActionCard({
 label,
 value,
 description,
 meta,
 href,
 linkLabel,
}: {
 label: string;
 value: string | number;
 description: string;
 meta?: string;
 href?: string;
 linkLabel?: string;
}) {
 return (
  <div className="surface-card p-6">
   <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
    {label}
   </p>
   <p className="mt-3 text-3xl font-bold text-[#000000]">{value}</p>
   <p className="mt-2 text-sm text-[#4d4d4d]">{description}</p>
   {meta && <p className="mt-3 text-xs text-[#6b7280]">{meta}</p>}
   {href && linkLabel && (
    <Link
     href={href}
     className="mt-4 inline-flex text-sm font-semibold text-[#11518b] transition hover:text-[#0d406d]"
    >
     {linkLabel}
    </Link>
   )}
  </div>
 );
}

function ActionRequiredCard({
 title,
 value,
 description,
 meta,
 href,
 linkLabel,
}: {
 title: string;
 value: string | number;
 description: string;
 meta: string;
 href?: string;
 linkLabel?: string;
}) {
 return (
  <div className="surface-card border-l-4 border-[#d4af37] p-6">
   <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
    {title}
   </p>
   <p className="mt-3 text-3xl font-bold text-[#000000]">{value}</p>
   <p className="mt-2 text-sm text-[#4d4d4d]">{description}</p>
   <p className="mt-3 text-xs text-[#6b7280]">{meta}</p>
   {href && linkLabel && (
    <Link
     href={href}
     className="mt-4 inline-flex text-sm font-semibold text-[#11518b] transition hover:text-[#0d406d]"
    >
     {linkLabel}
    </Link>
   )}
  </div>
 );
}

type LeadItem = {
 propiedadId: string | null;
 propiedadSlug: string;
 titulo: string;
 municipio: string | null;
 total: number;
 ultimaInteraccion: string | null;
 primeraInteraccion: string | null;
 totalWhatsapp: number;
 totalContact: number;
};

type ActividadItem = {
 id: string;
 propiedadId: string | null;
 propiedadSlug: string | null;
 titulo: string;
 tipoEvento: string;
 rutaOrigen: string | null;
 createdAt: string;
};

type DailyItem = LeadDailyTotal;

type PropertyFunnelStage = {
 label: string;
 count: number;
 stageRate: number;
 overallRate: number;
};

type PropertyIntelligenceFunnel = {
 propertySlug: string;
 propertyTitle: string;
 municipio: string;
 estado: string | null;
 totalDigitalActivity: number;
 completedSubmissions: number;
 rawCounts: {
  propertyViews: number;
  priorityPageViews: number;
  registrationCtaClicks: number;
  contactWhatsappClicks: number;
  showingCtaClicks: number;
  priorityRegistrationsSubmitted: number;
  showingProfilesSubmitted: number;
 };
 stages: PropertyFunnelStage[];
};

type HotListingRanking = {
 propertySlug: string;
 propertyTitle: string;
 municipio: string;
 estado: string | null;
 digitalActivity: number;
 directInteractions: number;
 priorityRegistrations: number;
 showingProfiles: number;
 persistedSubmissions: number;
 totalRankingActivity: number;
 categoryLabel: string;
};

type MunicipalityActivityProperty = {
 propertySlug: string;
 propertyTitle: string;
 totalActivity: number;
 persistedSubmissions: number;
 directInteractions: number;
 digitalActivity: number;
};

type MunicipalityActivityRow = {
 municipio: string;
 propertyCount: number;
 digitalActivity: number;
 directInteractions: number;
 priorityRegistrations: number;
 showingProfiles: number;
 persistedSubmissions: number;
 totalActivity: number;
 topProperty: MunicipalityActivityProperty;
};

type OperationalRecommendationRule =
 | "coming_soon_with_registrations"
 | "priority_interest_without_showing_profile"
 | "strong_direct_contact_activity"
 | "high_views_low_direct_intent"
 | "high_digital_activity"
 | "views_without_priority_registration_page_interest";

type OperationalRecommendation = {
 propertySlug: string;
 propertyTitle: string;
 municipio: string;
 estado: string | null;
 rule: OperationalRecommendationRule;
 ruleLabel: string;
 message: string;
 suggestedAction: string;
 evidence: string;
 relevantCount: number;
 priority: number;
 group: OperationalRecommendationRule;
};

type PropertyOperationalActivity = {
 propertySlug: string;
 propertyTitle: string;
 municipio: string;
 estado: string | null;
 views: number;
 priorityPageViews: number;
 digitalActivity: number;
 directInteractions: number;
 priorityRegistrations: number;
 showingProfiles: number;
 persistedSubmissions: number;
};
type RouteOriginItem = LeadRouteOrigin;

function formatDate(value: string | null) {
 if (!value) return "—";

 return new Intl.DateTimeFormat("es-PR", {
  dateStyle: "medium",
  timeStyle: "short",
 }).format(new Date(value));
}

function formatRelative(value: string) {
 const now = Date.now();
 const date = new Date(value).getTime();
 const diffMs = now - date;

 const minutes = Math.floor(diffMs / 60000);
 const hours = Math.floor(diffMs / 3600000);
 const days = Math.floor(diffMs / 86400000);

 if (minutes < 1) return "Hace unos segundos";
 if (minutes < 60) return `Hace ${minutes} min`;
 if (hours < 24) return `Hace ${hours} h`;
 return `Hace ${days} día${days === 1 ? "" : "s"}`;
}

function eventLabel(tipo: string) {
 switch (tipo) {
  case "whatsapp_click":
   return "WhatsApp";
  case "contact_click":
   return "Contacto";
  default:
   return tipo;
 }
}

function eventBadgeClasses(tipo: string) {
 switch (tipo) {
  case "whatsapp_click":
   return "border border-[#d9d9d9] bg-[#f8f8f8] text-[#4d4d4d]";
  case "contact_click":
   return "border border-[#d9d9d9] bg-[#f8f8f8] text-[#4d4d4d]";
  default:
   return "border border-[#d9d9d9] bg-[#f8f8f8] text-[#4d4d4d]";
 }
}

function CrmEstadoBadge({
 children,
}: {
 children: React.ReactNode;
}) {
 return (
  <span className="inline-flex rounded-full border border-[#d9d9d9] bg-[#f8f8f8] px-3 py-1 text-xs font-semibold text-[#4d4d4d]">
   {children}
  </span>
 );
}

function rangeLabel(range: LeadRange) {
 switch (range) {
  case "today":
   return "Hoy";
  case "7d":
   return "últimos 7 días";
  case "30d":
   return "últimos 30 días";
  case "all":
  default:
   return "Todo";
 }
}

function eventFilterLabel(eventType: LeadEventFilter) {
 switch (eventType) {
  case "whatsapp_click":
   return "WhatsApp";
  case "contact_click":
   return "Contacto";
  case "all":
  default:
   return "Todos";
 }
}

function isValidRange(value: string | undefined): value is LeadRange {
 return value === "today" || value === "7d" || value === "30d" || value === "all";
}

function isValidEventFilter(value: string | undefined): value is LeadEventFilter {
 return value === "all" || value === "whatsapp_click" || value === "contact_click";
}

function leadsHref({
 range,
 eventType,
 propertySlug,
}: {
 range: LeadRange;
 eventType: LeadEventFilter;
 propertySlug?: string | null;
}) {
 const params = new URLSearchParams();
 params.set("range", range);
 params.set("event", eventType);
 if (propertySlug) {
  params.set("property", propertySlug);
 }
 return `/admin/leads?${params.toString()}`;
}

function clearPropiedadHref({
 range,
 eventType,
}: {
 range: LeadRange;
 eventType: LeadEventFilter;
}) {
 return leadsHref({ range, eventType });
}

function RangeLink({
 range,
 currentRange,
 currentEventType,
 currentPropertySlug,
 label,
}: {
 range: LeadRange;
 currentRange: LeadRange;
 currentEventType: LeadEventFilter;
 currentPropertySlug?: string | null;
 label: string;
}) {
 const active = range === currentRange;

 return (
  <Link
   href={leadsHref({
    range,
    eventType: currentEventType,
    propertySlug: currentPropertySlug,
   })}
   className={
    active
     ? "inline-flex items-center rounded-full bg-[#11518b] px-4 py-2 text-sm font-semibold text-white"
     : "inline-flex items-center rounded-full border border-[#d9d9d9] bg-white px-4 py-2 text-sm font-semibold text-[#4d4d4d] transition hover:border-[#11518b] hover:text-[#11518b]"
   }
  >
   {label}
  </Link>
 );
}

function EventFilterLink({
 eventType,
 currentEventType,
 currentRange,
 currentPropertySlug,
 label,
}: {
 eventType: LeadEventFilter;
 currentEventType: LeadEventFilter;
 currentRange: LeadRange;
 currentPropertySlug?: string | null;
 label: string;
}) {
 const active = eventType === currentEventType;

 return (
  <Link
   href={leadsHref({
    range: currentRange,
    eventType,
    propertySlug: currentPropertySlug,
   })}
   className={
    active
     ? "inline-flex items-center rounded-full bg-[#11518b] px-4 py-2 text-sm font-semibold text-white"
     : "inline-flex items-center rounded-full border border-[#d9d9d9] bg-white px-4 py-2 text-sm font-semibold text-[#4d4d4d] transition hover:border-[#11518b] hover:text-[#11518b]"
   }
  >
   {label}
  </Link>
 );
}

function ChannelBar({
 whatsapp,
 contact,
}: {
 whatsapp: number;
 contact: number;
}) {
 const total = whatsapp + contact;
 const whatsappPct = total > 0 ? (whatsapp / total) * 100 : 0;
 const contactPct = total > 0 ? (contact / total) * 100 : 0;

 return (
  <div className="surface-card p-6">
   <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
    Canales de contacto directo
   </p>
   <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
    WhatsApp y solicitudes de contacto
   </h2>

   <div className="mt-6 overflow-hidden rounded-full bg-[#e9edf2]">
    <div className="flex h-5 w-full">
     <div
      className="h-full bg-[#25D366]"
      style={{ width: `${whatsappPct}%` }}
      title={`WhatsApp: ${whatsapp}`}
     />
     <div
      className="h-full bg-[#11518b]"
      style={{ width: `${contactPct}%` }}
      title={`Contacto: ${contact}`}
     />
    </div>
   </div>

   <div className="mt-5 grid gap-4 sm:grid-cols-2">
    <div className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-4">
     <div className="flex items-center gap-2">
      <span className="inline-block h-3 w-3 rounded-full bg-[#25D366]" />
      <p className="text-sm font-semibold text-[#000000]">WhatsApp</p>
     </div>
     <p className="mt-3 text-2xl font-bold text-[#000000]">{whatsapp}</p>
     <p className="mt-1 text-sm text-[#4d4d4d]">
      {total > 0 ? `${whatsappPct.toFixed(1)}% del total` : "Sin datos"}
     </p>
    </div>

    <div className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-4">
     <div className="flex items-center gap-2">
      <span className="inline-block h-3 w-3 rounded-full bg-[#11518b]" />
      <p className="text-sm font-semibold text-[#000000]">Contacto</p>
     </div>
     <p className="mt-3 text-2xl font-bold text-[#000000]">{contact}</p>
     <p className="mt-1 text-sm text-[#4d4d4d]">
      {total > 0 ? `${contactPct.toFixed(1)}% del total` : "Sin datos"}
     </p>
    </div>
   </div>
  </div>
 );
}

function TopPropertiesChart({ items }: { items: LeadItem[] }) {
 const max = items.length > 0 ? Math.max(...items.map((item) => item.total)) : 0;

 return (
  <div className="surface-card p-6">
   <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
    Seguimiento por propiedad
   </p>
   <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
    Propiedades más contactadas
   </h2>

   {items.length === 0 ? (
    <p className="mt-4 text-sm text-[#4d4d4d]">
     No se registraron interacciones directas durante el periodo seleccionado.
    </p>
   ) : (
    <div className="mt-6 space-y-4">
     {items.map((item, index) => {
      const width = max > 0 ? (item.total / max) * 100 : 0;

      return (
       <div key={item.propiedadSlug}>
        <div className="mb-2 flex items-center justify-between gap-4">
         <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#000000]">
           #{index + 1} {item.titulo}
          </p>
          <p className="truncate text-xs text-[#4d4d4d]">
           {item.propiedadSlug}
          </p>
         </div>
         <p className="text-sm font-semibold text-[#11518b]">
          {item.total}
         </p>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-[#e9edf2]">
         <div
          className="h-full rounded-full bg-[#11518b]"
          style={{ width: `${width}%` }}
         />
        </div>
       </div>
      );
     })}
    </div>
   )}
  </div>
 );
}

function DailyInteractionsChart({ items }: { items: DailyItem[] }) {
 const max = items.length > 0 ? Math.max(...items.map((item) => item.total)) : 0;

 return (
  <div className="surface-card p-6">
   <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
    Actividad diaria de leads
   </p>
   <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
    Contactos directos por día
   </h2>

   {items.length === 0 ? (
    <div className="mt-6 rounded-2xl border border-dashed border-[#d9d9d9] bg-[#fafafa] p-6 text-sm text-[#4d4d4d]">
     No se registraron interacciones directas durante el periodo seleccionado.
    </div>
   ) : (
    <div className="mt-6 space-y-4">
     {items.map((item) => {
      const width = max > 0 ? (item.total / max) * 100 : 0;

      return (
       <div key={item.day}>
        <div className="mb-2 flex items-center justify-between gap-4">
         <p className="text-sm font-medium text-[#000000]">
          {new Intl.DateTimeFormat("es-PR", {
           month: "short",
           day: "numeric",
          }).format(new Date(item.day))}
         </p>
         <p className="text-sm font-semibold text-[#11518b]">
          {item.total}
         </p>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-[#e9edf2]">
         <div
          className="h-full rounded-full bg-[#11518b]"
          style={{ width: `${width}%` }}
         />
        </div>

        <p className="mt-1 text-xs text-[#4d4d4d]">
         WhatsApp: {item.totalWhatsapp} · Contacto: {item.totalContact}
        </p>
       </div>
      );
     })}
    </div>
   )}
  </div>
 );
}

function RouteOriginBreakdown({ items }: { items: RouteOriginItem[] }) {
 const max = items.length > 0 ? Math.max(...items.map((item) => item.total)) : 0;

 return (
  <div className="surface-card p-6">
   <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
    Fuentes de leads
   </p>
   <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
    Rutas que generan contacto directo
   </h2>

   {items.length === 0 ? (
    <div className="mt-6 rounded-2xl border border-dashed border-[#d9d9d9] bg-[#fafafa] p-6 text-sm text-[#4d4d4d]">
     No lead source activity was recorded during the selected period.
    </div>
   ) : (
    <div className="mt-6 space-y-4">
     {items.map((item) => {
      const width = max > 0 ? (item.total / max) * 100 : 0;

      return (
       <div key={item.rutaOrigen}>
        <div className="mb-2 flex items-start justify-between gap-4">
         <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#000000]">
           {item.rutaOrigen}
          </p>
          <p className="mt-1 text-xs text-[#4d4d4d]">
           Última: {formatDate(item.ultimaInteraccion)}
          </p>
         </div>
         <p className="text-sm font-semibold text-[#11518b]">
          {item.total}
         </p>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-[#e9edf2]">
         <div
          className="h-full rounded-full bg-[#d4af37]"
          style={{ width: `${width}%` }}
         />
        </div>

        <p className="mt-1 text-xs text-[#4d4d4d]">
         WhatsApp: {item.totalWhatsapp} · Contacto: {item.totalContact}
        </p>
       </div>
      );
     })}
    </div>
   )}
  </div>
 );
}

function PriorityRegistrationsTable({
 items,
}: {
 items: PriorityRegistrationLead[];
}) {
 return (
  <section id="priority-registrations" className="surface-card overflow-hidden">
   <div className="border-b border-[#eeeeee] px-6 py-5">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
     Registros prioritarios
    </p>
    <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
     Interés de compradores Coming Soon
    </h2>
   </div>

   {items.length === 0 ? (
    <div className="px-6 py-12 text-center">
     <p className="text-lg font-medium text-[#000000]">
      No hay registros prioritarios todavía.
     </p>
     <p className="mt-2 text-sm text-[#4d4d4d]">
      Los registros de propiedades próximamente aparecerán aquí.
     </p>
    </div>
   ) : (
    <div className="overflow-x-auto">
     <table className="min-w-full">
      <thead className="bg-[#fafafa]">
       <tr className="text-left">
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Fecha</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Propiedad</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Nombre del comprador</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Tipo de compra</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Teléfono</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Correo electrónico</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Estado</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Acciones</th>
       </tr>
      </thead>
      <tbody>
       {items.map((item) => (
        <tr key={item.id} className="border-t border-[#f0f0f0]">
         <td className="px-6 py-4 text-sm text-[#4d4d4d]">
          {formatDate(item.createdAt)}
         </td>
         <td className="px-6 py-4">
          <p className="text-sm font-medium text-[#000000]">
           {item.propertyTitle}
          </p>
          <p className="mt-1 text-xs text-[#4d4d4d]">
           {item.propertySlug}
          </p>
         </td>
         <td className="px-6 py-4 text-sm font-medium text-[#000000]">
          {item.buyerName || "No disponible"}
         </td>
         <td className="px-6 py-4 text-sm text-[#4d4d4d]">
          {item.purchaseType || "No disponible"}
         </td>
         <td className="px-6 py-4 text-sm text-[#4d4d4d]">
          {item.phone || "No disponible"}
         </td>
         <td className="px-6 py-4 text-sm text-[#4d4d4d]">
          {item.email || "No disponible"}
         </td>
         <td className="px-6 py-4">
          <CrmEstadoBadge>Registro prioritario</CrmEstadoBadge>
         </td>
         <td className="px-6 py-4">
          <div className="flex flex-wrap gap-3">
           <Link
            href={`/listados/${item.propertySlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
           >
            Ver propiedad
           </Link>
           <CopyLeadValueButton value={item.email} label="Copiar correo" />
           <CopyLeadValueButton value={item.phone} label="Copiar teléfono" />
          </div>
         </td>
        </tr>
       ))}
      </tbody>
     </table>
    </div>
   )}
  </section>
 );
}

function ShowingProfilesTable({ items }: { items: ShowingProfileLead[] }) {
 return (
  <section id="showing-profiles" className="surface-card overflow-hidden">
   <div className="border-b border-[#eeeeee] px-6 py-5">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
     Perfiles para visita
    </p>
    <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
     Propiedad buyer profiles recibidos
    </h2>
   </div>

   {items.length === 0 ? (
    <div className="px-6 py-12 text-center">
     <p className="text-lg font-medium text-[#000000]">
      No se han recibido perfiles para visitas.
     </p>
     <p className="mt-2 text-sm text-[#4d4d4d]">
      Propiedad-specific buyer profiles will appear here after submission.
     </p>
    </div>
   ) : (
    <div className="overflow-x-auto">
     <table className="min-w-full">
      <thead className="bg-[#fafafa]">
       <tr className="text-left">
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Fecha</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Propiedad</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Nombre del comprador</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Método de compra</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Precalificado(a)</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Estado</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Acciones</th>
       </tr>
      </thead>
      <tbody>
       {items.map((item) => (
        <tr key={item.id} className="border-t border-[#f0f0f0]">
         <td className="px-6 py-4 text-sm text-[#4d4d4d]">
          {formatDate(item.createdAt)}
         </td>
         <td className="px-6 py-4">
          <p className="text-sm font-medium text-[#000000]">
           {item.propertyTitle ?? "Propiedad no vinculada"}
          </p>
          {item.propertySlug && (
           <p className="mt-1 text-xs text-[#4d4d4d]">
            {item.propertySlug}
           </p>
          )}
         </td>
         <td className="px-6 py-4 text-sm font-medium text-[#000000]">
          {item.buyerName || "No disponible"}
         </td>
         <td className="px-6 py-4 text-sm text-[#4d4d4d]">
          {item.purchaseMethod || "No disponible"}
         </td>
         <td className="px-6 py-4 text-sm text-[#4d4d4d]">
          {item.prequalified}
         </td>
         <td className="px-6 py-4">
          <CrmEstadoBadge>Perfil para visita</CrmEstadoBadge>
         </td>
         <td className="px-6 py-4">
          <div className="flex flex-wrap gap-3">
           {item.propertySlug ? (
            <Link
             href={`/listados/${item.propertySlug}`}
             target="_blank"
             rel="noopener noreferrer"
             className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
            >
             Ver propiedad
            </Link>
           ) : (
            <span className="text-xs text-[#8a8a8a]">
             Propiedad no disponible
            </span>
           )}
           <CopyLeadValueButton value={item.email} label="Copiar correo" />
           <CopyLeadValueButton value={item.phone} label="Copiar teléfono" />
          </div>
         </td>
        </tr>
       ))}
      </tbody>
     </table>
    </div>
   )}
  </section>
 );
}

function digitalCtaTotal(item: Ga4PropertyDigitalInterest) {
 return (
  item.registrationCtaClicks +
  item.whatsappClicks +
  item.contactClicks +
  item.showingCtaClicks
 );
}

function digitalSubmissionTotal(item: Ga4PropertyDigitalInterest) {
 return item.priorityRegistrationsSubmitted + item.showingProfilesSubmitted;
}

function conversionRate(count: number, base: number) {
 if (base <= 0) return 0;
 return (count / base) * 100;
}

function formatPercent(value: number) {
 return `${value.toFixed(1)}%`;
}

function hasRatioAboveOneHundred(item: PropertyIntelligenceFunnel) {
 return item.stages.some((stage) => stage.stageRate > 100 || stage.overallRate > 100);
}

function activityCategory(total: number) {
 // Descriptive thresholds for the current activity scale; adjust later as more history accumulates.
 if (total >= 100) return "Alta actividad";
 if (total >= 25) return "Actividad media";
 return "Actividad inicial";
}

function buildOperationalRecommendations(
 properties: PropertyOperationalActivity[]
): OperationalRecommendation[] {
 const recommendations = properties.flatMap((property) => {
  const items: OperationalRecommendation[] = [];

  if (
   property.estado === "coming_soon" &&
   property.priorityRegistrations >= 3
  ) {
   items.push({
    propertySlug: property.propertySlug,
    propertyTitle: property.propertyTitle,
    municipio: property.municipio,
    estado: property.estado,
    rule: "coming_soon_with_registrations",
    ruleLabel: "Próximamente con registros",
    message: "Esta propiedad próxima al mercado ya tiene interesados registrados.",
    suggestedAction: "Preparar el seguimiento antes de cambiarla a Disponible.",
    evidence: `${property.priorityRegistrations} registros prioritarios · estado ${estadoLabel(
     property.estado
    )}`,
    relevantCount: property.priorityRegistrations,
    priority: 1,
    group: "coming_soon_with_registrations",
   });
  }

  if (property.priorityRegistrations >= 3 && property.showingProfiles === 0) {
   items.push({
    propertySlug: property.propertySlug,
    propertyTitle: property.propertyTitle,
    municipio: property.municipio,
    estado: property.estado,
    rule: "priority_interest_without_showing_profile",
    ruleLabel: "Registros sin perfiles",
    message: "Hay registros prioritarios, pero todavía no se han recibido perfiles para visita.",
    suggestedAction: "Dar seguimiento a los interesados y evaluar la coordinación de visitas.",
    evidence: `${property.priorityRegistrations} registros prioritarios · ${property.showingProfiles} perfiles para visita`,
    relevantCount: property.priorityRegistrations,
    priority: 2,
    group: "priority_interest_without_showing_profile",
   });
  }

  if (property.directInteractions >= 5) {
   items.push({
    propertySlug: property.propertySlug,
    propertyTitle: property.propertyTitle,
    municipio: property.municipio,
    estado: property.estado,
    rule: "strong_direct_contact_activity",
    ruleLabel: "Contacto directo fuerte",
    message: "Esta propiedad está generando varias acciones directas de contacto.",
    suggestedAction: "Priorizar respuesta y seguimiento.",
    evidence: `${property.directInteractions} interacciones directas`,
    relevantCount: property.directInteractions,
    priority: 3,
    group: "strong_direct_contact_activity",
   });
  }

  if (
   property.views >= 20 &&
   property.directInteractions === 0 &&
   property.persistedSubmissions === 0
  ) {
   items.push({
    propertySlug: property.propertySlug,
    propertyTitle: property.propertyTitle,
    municipio: property.municipio,
    estado: property.estado,
    rule: "high_views_low_direct_intent",
    ruleLabel: "Vistas sin intención directa",
    message: "Esta propiedad recibe visualizaciones, pero todavía no genera contactos directos ni formularios.",
    suggestedAction: "Revisar fotos, descripción, precio o llamado a la acción.",
    evidence: `${property.views} visualizaciones · ${property.directInteractions} contactos · ${property.persistedSubmissions} envíos`,
    relevantCount: property.views,
    priority: 4,
    group: "high_views_low_direct_intent",
   });
  }

  if (property.digitalActivity >= 50) {
   items.push({
    propertySlug: property.propertySlug,
    propertyTitle: property.propertyTitle,
    municipio: property.municipio,
    estado: property.estado,
    rule: "high_digital_activity",
    ruleLabel: "Alta actividad digital",
    message: "Esta propiedad presenta alta actividad digital en el periodo seleccionado.",
    suggestedAction: "Considerar reforzar la promoción y revisar la conversión a contactos.",
    evidence: `${property.digitalActivity} acciones digitales`,
    relevantCount: property.digitalActivity,
    priority: 5,
    group: "high_digital_activity",
   });
  }

  if (
   property.views >= 20 &&
   property.priorityPageViews === 0 &&
   property.estado === "coming_soon"
  ) {
   items.push({
    propertySlug: property.propertySlug,
    propertyTitle: property.propertyTitle,
    municipio: property.municipio,
    estado: property.estado,
    rule: "views_without_priority_registration_page_interest",
    ruleLabel: "Registro prioritario sin visitas",
    message: "La propiedad recibe visualizaciones, pero el registro prioritario no está recibiendo visitas.",
    suggestedAction: "Revisar la visibilidad del llamado al Registro Prioritario.",
    evidence: `${property.views} visualizaciones · ${property.priorityPageViews} visitas al registro prioritario`,
    relevantCount: property.views,
    priority: 6,
    group: "views_without_priority_registration_page_interest",
   });
  }

  return items;
 });

 const shownByProperty = new Map<string, OperationalRecommendation[]>();

 return recommendations
  .sort(
   (a, b) =>
    a.priority - b.priority ||
    b.relevantCount - a.relevantCount ||
    a.propertyTitle.localeCompare(b.propertyTitle, "es")
  )
  .filter((item) => {
   const existing = shownByProperty.get(item.propertySlug) ?? [];
   if (existing.length >= 2) return false;
   if (existing.some((current) => current.group === item.group)) return false;
   shownByProperty.set(item.propertySlug, [...existing, item]);
   return true;
  })
  .slice(0, 8);
}

function estadoVariant(estado: string | null) {
 switch (estado) {
  case "disponible":
   return "blue";
  case "coming_soon":
  case "bajo_contrato":
   return "gold";
  case "vendida":
  case "rentada":
   return "gray";
  default:
   return "outline";
 }
}

function estadoLabel(estado: string | null) {
 switch (estado) {
  case "disponible":
   return "Disponible";
  case "coming_soon":
   return "Próximamente";
  case "bajo_contrato":
   return "Bajo contrato";
  case "vendida":
   return "Vendida";
  case "rentada":
   return "Alquilada";
  default:
   return "Sin estado";
 }
}

function buildPropertyFunnel(
 item: Ga4PropertyDigitalInterest,
 meta: { title: string; municipio: string | null; estado: string | null } | undefined
): PropertyIntelligenceFunnel {
 const propertyViews = item.views;
 const priorityPageViews = item.priorityPageViews;
 const registrationCtaClicks = item.registrationCtaClicks;
 const contactWhatsappClicks = item.contactClicks + item.whatsappClicks;
 const priorityRegistrationsSubmitted = item.priorityRegistrationsSubmitted;
 const showingProfilesSubmitted = item.showingProfilesSubmitted;
 const completedSubmissions = digitalSubmissionTotal(item);
 const stageInputs = [
  { label: "👀 Property Views", count: propertyViews },
  { label: "📝 Priority Registration Page Views", count: priorityPageViews },
  { label: "👉 Registration CTA Clicks", count: registrationCtaClicks },
  { label: "💬 Contact + WhatsApp Clicks", count: contactWhatsappClicks },
  { label: "✅ Priority Registrations Submitted", count: priorityRegistrationsSubmitted },
  { label: "🏡 Showing Profiles Submitted", count: showingProfilesSubmitted },
 ];

 return {
  propertySlug: item.propertySlug,
  propertyTitle: meta?.title ?? item.propertySlug,
  municipio: meta?.municipio ?? "Sin municipio",
  estado: meta?.estado ?? null,
  totalDigitalActivity: item.total,
  completedSubmissions,
  rawCounts: {
   propertyViews,
   priorityPageViews,
   registrationCtaClicks,
   contactWhatsappClicks,
   showingCtaClicks: item.showingCtaClicks,
   priorityRegistrationsSubmitted,
   showingProfilesSubmitted,
  },
  stages: stageInputs.map((stage, index) => {
   const previousCount = index === 0 ? propertyViews : stageInputs[index - 1].count;
   return {
    ...stage,
    stageRate: index === 0 ? 100 : conversionRate(stage.count, previousCount),
    overallRate: conversionRate(stage.count, propertyViews),
   };
  }),
 };
}

function DigitalActivityCard({
 label,
 item,
 value,
 description,
}: {
 label: string;
 item?: Ga4PropertyDigitalInterest;
 value: number;
 description: string;
}) {
 return (
  <div className="surface-card border-l-4 border-[#11518b] p-6">
   <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#11518b]">
    {label}
   </p>
   <p className="mt-3 text-3xl font-bold text-[#000000]">{value}</p>
   <p className="mt-2 text-sm text-[#4d4d4d]">{description}</p>
   <p className="mt-3 truncate text-xs font-medium text-[#11518b]">
    {item?.propertySlug ?? "Sin datos GA4 todavía"}
   </p>
  </div>
 );
}

function DigitalInterestDetails({
 item,
}: {
 item?: Ga4PropertyDigitalInterest;
}) {
 if (!item) {
  return (
   <p className="mt-3 text-xs text-[#4d4d4d]">
    Los informes digitales por propiedad todavía se están procesando en Google Analytics.
   </p>
  );
 }

 const rows = [
  ["Vistas del website", item.views],
  ["Vistas de registro prioritario", item.priorityPageViews],
  ["Clics CTA de registro", item.registrationCtaClicks],
  ["Clics de WhatsApp", item.whatsappClicks],
  ["Clics de contacto", item.contactClicks],
  ["Clics CTA para visita", item.showingCtaClicks],
  ["Registros prioritarios enviados", item.priorityRegistrationsSubmitted],
  ["Perfiles para visita enviados", item.showingProfilesSubmitted],
 ];

 return (
  <details className="mt-3 rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-3">
   <summary className="cursor-pointer text-xs font-semibold text-[#11518b]">
    Ver detalles GA4
   </summary>
   <div className="mt-3 grid gap-2 sm:grid-cols-2">
    {rows.map(([label, value]) => (
     <div
      key={label}
      className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs"
     >
      <span className="text-[#4d4d4d]">{label}</span>
      <span className="font-semibold text-[#000000]">{value}</span>
     </div>
    ))}
   </div>
  </details>
 );
}

function HotListingsTable({
 items,
}: {
 items: HotListingRanking[];
}) {
 return (
  <div className="surface-card overflow-hidden">
   <div className="border-b border-[#eeeeee] px-6 py-5">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#11518b]">
     Top 5
    </p>
    <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
     Propiedades con mayor actividad
    </h2>
    <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
     Ranking basado en actividad digital agregada y señales directas de contacto.
    </p>
    <p className="mt-3 rounded-2xl border border-[#dbe7f3] bg-[#f6f9fc] px-4 py-3 text-xs leading-relaxed text-[#4d4d4d]">
     Este ranking suma eventos y envíos registrados. Una misma acción o persona puede reflejarse en más de una fuente; el total representa actividad agregada, no personas únicas.
    </p>
   </div>

   {items.length === 0 ? (
    <div className="px-6 py-10 text-sm text-[#4d4d4d]">
     No hay suficiente actividad por propiedad para generar el ranking.
    </div>
   ) : (
    <div className="overflow-x-auto">
     <table className="min-w-full">
      <thead className="bg-[#fafafa]">
       <tr className="text-left">
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Rank</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Propiedad</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Estado</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Actividad digital</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Interacciones directas</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Registros</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Perfiles</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Total</th>
        <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Acciones</th>
       </tr>
      </thead>
      <tbody>
       {items.map((item, index) => (
        <tr key={item.propertySlug} className="border-t border-[#f0f0f0]">
         <td className="px-6 py-4 text-sm font-semibold text-[#11518b]">
          #{index + 1}
         </td>
         <td className="px-6 py-4">
          <p className="text-sm font-medium text-[#000000]">
           {item.propertyTitle}
          </p>
          <p className="mt-1 text-xs text-[#4d4d4d]">{item.municipio}</p>
          <p className="mt-1 text-xs text-[#8a8a8a]">{item.propertySlug}</p>
         </td>
         <td className="px-6 py-4">
          <div className="flex flex-col items-start gap-2">
           <StatusBadge variant={estadoVariant(item.estado)}>
            {estadoLabel(item.estado)}
           </StatusBadge>
           <span className="rounded-full border border-[#d9d9d9] bg-[#f8f8f8] px-3 py-1 text-xs font-semibold text-[#4d4d4d]">
            {item.categoryLabel}
           </span>
          </div>
         </td>
         <td className="px-6 py-4 text-sm text-[#4d4d4d]">
          {item.digitalActivity}
         </td>
         <td className="px-6 py-4 text-sm text-[#4d4d4d]">
          {item.directInteractions}
         </td>
         <td className="px-6 py-4 text-sm text-[#4d4d4d]">
          {item.priorityRegistrations}
         </td>
         <td className="px-6 py-4 text-sm text-[#4d4d4d]">
          {item.showingProfiles}
         </td>
         <td className="px-6 py-4 text-sm font-semibold text-[#11518b]">
          {item.totalRankingActivity}
         </td>
         <td className="px-6 py-4">
          <Link
           href={`/admin/leads?range=all&event=all&property=${encodeURIComponent(
            item.propertySlug
           )}`}
           className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
          >
           Ver propiedad filtrada
          </Link>
         </td>
        </tr>
       ))}
      </tbody>
     </table>
    </div>
   )}
  </div>
 );
}
function MunicipalityActivitySection({
 items,
}: {
 items: MunicipalityActivityRow[];
}) {
 const chartData = items.map((item) => ({
  name: item.municipio,
  value: item.totalActivity,
 }));

 return (
  <div className="surface-card overflow-hidden">
   <div className="border-b border-[#eeeeee] px-6 py-5">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#11518b]">
     Municipios
    </p>
    <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
     Actividad por municipio
    </h2>
    <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
     Comparación de actividad digital, contactos directos y envíos registrados por municipio.
    </p>
    <div className="mt-3 space-y-2 rounded-2xl border border-[#dbe7f3] bg-[#f6f9fc] px-4 py-3 text-xs leading-relaxed text-[#4d4d4d]">
     <p>
      Total de actividad = actividad digital + interacciones directas + envíos registrados.
     </p>
     <p>
      Los municipios corresponden a la ubicación de las propiedades, no a la ubicación de los visitantes.
     </p>
     <p>
      Los totales representan actividad agregada y pueden incluir varias acciones de una misma persona.
     </p>
    </div>
   </div>

   {items.length === 0 ? (
    <div className="px-6 py-10 text-sm text-[#4d4d4d]">
     No hay suficiente actividad por municipio para mostrar este resumen.
    </div>
   ) : (
    <div>
     <div className="border-b border-[#eeeeee] px-6 py-5">
      <AnalyticsHorizontalBarChart
       data={chartData}
       emptyMessage="No hay suficiente actividad por municipio para mostrar este resumen."
       height={260}
      />
     </div>
     <div className="overflow-x-auto">
      <table className="min-w-full">
       <thead className="bg-[#fafafa]">
        <tr className="text-left">
         <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
          Municipio
         </th>
         <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
          Propiedades con actividad
         </th>
         <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
          Actividad digital
         </th>
         <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
          Interacciones directas
         </th>
         <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
          Registros prioritarios
         </th>
         <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
          Perfiles para visita
         </th>
         <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
          Total de actividad
         </th>
         <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
          Propiedad principal
         </th>
        </tr>
       </thead>
       <tbody>
        {items.map((item) => (
         <tr key={item.municipio} className="border-t border-[#f0f0f0]">
          <td className="px-6 py-4 text-sm font-medium text-[#000000]">
           {item.municipio}
          </td>
          <td className="px-6 py-4 text-sm text-[#4d4d4d]">
           {item.propertyCount}
          </td>
          <td className="px-6 py-4 text-sm text-[#4d4d4d]">
           {item.digitalActivity}
          </td>
          <td className="px-6 py-4 text-sm text-[#4d4d4d]">
           {item.directInteractions}
          </td>
          <td className="px-6 py-4 text-sm text-[#4d4d4d]">
           {item.priorityRegistrations}
          </td>
          <td className="px-6 py-4 text-sm text-[#4d4d4d]">
           {item.showingProfiles}
          </td>
          <td className="px-6 py-4 text-sm font-semibold text-[#11518b]">
           {item.totalActivity}
          </td>
          <td className="px-6 py-4">
           <div className="min-w-[220px]">
            <p className="text-sm font-medium text-[#000000]">
             {item.topProperty.propertyTitle}
            </p>
            <p className="mt-1 text-xs text-[#4d4d4d]">
             {item.topProperty.totalActivity} acciones
            </p>
            <Link
             href={`/admin/leads?range=all&event=all&property=${encodeURIComponent(
              item.topProperty.propertySlug
             )}`}
             className="mt-2 inline-flex text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
            >
             Ver propiedad filtrada
            </Link>
           </div>
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    </div>
   )}
  </div>
 );
}

function OperationalRecommendationsSection({
 items,
}: {
 items: OperationalRecommendation[];
}) {
 return (
  <section className="surface-card p-6">
   <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
    <div>
     <p className="eyebrow">Recomendaciones operativas</p>
     <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
      Señales para priorizar seguimiento
     </h2>
     <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#4d4d4d]">
      Señales basadas en la actividad reciente que pueden ayudar a priorizar el seguimiento.
     </p>
    </div>
    <span className="inline-flex w-fit rounded-full border border-[#d9d9d9] bg-[#f8f8f8] px-3 py-1 text-xs font-semibold text-[#4d4d4d]">
     {items.length} señales
    </span>
   </div>

   <p className="mt-5 rounded-2xl border border-[#dbe7f3] bg-[#f6f9fc] px-4 py-3 text-xs leading-relaxed text-[#4d4d4d]">
    Estas recomendaciones se generan mediante reglas visibles basadas en actividad agregada. No representan predicciones ni personas únicas.
   </p>

   {items.length === 0 ? (
    <div className="mt-6 rounded-2xl border border-[#eeeeee] bg-[#fafafa] px-5 py-6 text-sm text-[#4d4d4d]">
     No hay recomendaciones operativas para el periodo seleccionado.
    </div>
   ) : (
    <div className="mt-6 grid gap-5 xl:grid-cols-2">
     {items.map((item) => (
      <article
       key={`${item.propertySlug}-${item.rule}`}
       className="rounded-2xl border border-[#e8e8e8] bg-white p-5"
      >
       <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
         <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4af37]">
          {item.ruleLabel}
         </p>
         <h3 className="mt-2 text-lg font-semibold text-[#000000]">
          {item.propertyTitle}
         </h3>
         <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-[#4d4d4d]">{item.municipio}</span>
          <StatusBadge variant={estadoVariant(item.estado)}>
           {estadoLabel(item.estado)}
          </StatusBadge>
         </div>
        </div>
        <Link
         href={`/admin/leads?range=all&event=all&property=${encodeURIComponent(
          item.propertySlug
         )}`}
         className="shrink-0 text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
        >
         Ver propiedad filtrada
        </Link>
       </div>

       <div className="mt-4 space-y-3 text-sm leading-relaxed">
        <p className="font-medium text-[#000000]">{item.message}</p>
        <p className="text-[#4d4d4d]">{item.suggestedAction}</p>
        <p className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] px-4 py-3 text-xs font-semibold text-[#4d4d4d]">
         Evidencia: {item.evidence}
        </p>
       </div>
      </article>
     ))}
    </div>
   )}
  </section>
 );
}

function PropertyIntelligenceFunnelSection({
 items,
}: {
 items: PropertyIntelligenceFunnel[];
}) {
 if (items.length === 0) {
  return (
   <div className="surface-card border-l-4 border-[#11518b] p-6 text-sm text-[#4d4d4d]">
    Los informes digitales por propiedad todavía se están procesando en Google Analytics.
   </div>
  );
 }

 return (
  <div className="grid gap-5 xl:grid-cols-2">
   {items.map((item) => (
    <details
     key={item.propertySlug}
     className="surface-card group overflow-hidden p-0"
    >
     <summary className="cursor-pointer list-none p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
       <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
         Property Intelligence Funnel
        </p>
        <h3 className="mt-2 truncate text-xl font-semibold text-[#000000]">
         {item.propertyTitle}
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
         <span className="text-sm text-[#4d4d4d]">{item.municipio}</span>
         <StatusBadge variant={estadoVariant(item.estado)}>
          {estadoLabel(item.estado)}
         </StatusBadge>
        </div>
       </div>
       <div className="shrink-0 rounded-2xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-3 text-left lg:text-right">
        <p className="text-2xl font-bold text-[#11518b]">
         {item.totalDigitalActivity}
        </p>
        <p className="text-xs text-[#4d4d4d]">acciones digitales</p>
        <p className="mt-2 text-xs font-semibold text-[#11518b]">
         ▼ Ver embudo
        </p>
       </div>
      </div>
     </summary>

     <div className="border-t border-[#eeeeee] p-6">
      <div className="mb-5 rounded-2xl border border-[#dbe7f3] bg-[#f6f9fc] p-4 text-sm leading-relaxed text-[#4d4d4d]">
       Estos datos son conteos agregados de eventos de Google Analytics 4. Sirven para comparar actividad entre propiedades, pero no representan personas únicas ni un recorrido estrictamente secuencial.
      </div>

      <div className="space-y-3">
       {item.stages.map((stage, index) => (
        <div key={stage.label}>
         <div className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
           <div>
            <p className="text-sm font-semibold text-[#000000]">
             {stage.label}
            </p>
            <p className="mt-1 text-xs text-[#4d4d4d]">
             Relación con la etapa anterior: {formatPercent(stage.stageRate)} · Relación con visualizaciones:{" "}
             {formatPercent(stage.overallRate)}
            </p>
           </div>
           <p className="text-2xl font-bold text-[#11518b]">{stage.count}</p>
          </div>
         </div>
         {index < item.stages.length - 1 && (
          <div className="flex justify-center py-1 text-[#d4af37]">↓</div>
         )}
        </div>
       ))}
      </div>

      {hasRatioAboveOneHundred(item) && (
       <p className="mt-4 rounded-2xl border border-[#f0dfb6] bg-[#fff9e6] p-4 text-xs leading-relaxed text-[#6b5a1f]">
        Los eventos agregados pueden superar el 100% porque una persona puede generar varias acciones o entrar por rutas distintas.
       </p>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
       <div className="rounded-2xl border border-[#e8e8e8] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4af37]">
         Conteos crudos
        </p>
        <div className="mt-3 grid gap-2 text-sm text-[#4d4d4d]">
         <p>CTA para visita: {item.rawCounts.showingCtaClicks}</p>
         <p>Registros prioritarios: {item.rawCounts.priorityRegistrationsSubmitted}</p>
         <p>Perfiles para visita: {item.rawCounts.showingProfilesSubmitted}</p>
        </div>
       </div>
       <div className="rounded-2xl border border-[#e8e8e8] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4af37]">
         Resumen
        </p>
        <div className="mt-3 grid gap-2 text-sm text-[#4d4d4d]">
         <p>Envíos completados registrados: {item.completedSubmissions}</p>
         <p>
          Relación de envíos completados sobre visualizaciones:{" "}
          {formatPercent(conversionRate(item.completedSubmissions, item.rawCounts.propertyViews))}
         </p>
         <p>Este total suma eventos y puede incluir a una misma persona más de una vez.</p>
         <p>Última actividad: no disponible en el reporte actual de GA4.</p>
        </div>
       </div>
      </div>
     </div>
    </details>
   ))}
  </div>
 );
}

function ComingSoonRegistrationsList({
 items,
}: {
 items: ComingSoonRegistrationItem[];
}) {
 return (
  <div className="surface-card p-6">
   <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
    Próximamente con registros
   </p>
   <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
    Oportunidades de seguimiento
   </h2>

   {items.length === 0 ? (
    <p className="mt-4 text-sm text-[#4d4d4d]">
     No hay propiedades próximamente con registros.
    </p>
   ) : (
    <div className="mt-6 space-y-4">
     {items.map((item) => (
      <div
       key={item.propertySlug}
       className="rounded-2xl border border-[#ececec] bg-[#fafafa] px-4 py-4"
      >
       <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
         <p className="truncate font-medium text-[#000000]">
          {item.propertyTitle}
         </p>
         <p className="mt-1 truncate text-xs text-[#4d4d4d]">
          {item.propertySlug}
         </p>
         <p className="mt-2 text-xs text-[#4d4d4d]">
          Último registro: {formatDate(item.latestAt)}
         </p>
        </div>
        <div className="shrink-0 text-left md:text-right">
         <p className="text-2xl font-bold text-[#11518b]">
          {item.total}
         </p>
         <p className="text-xs text-[#4d4d4d]">registrations</p>
        </div>
       </div>
       <div className="mt-4">
        <Link
         href={`/admin/leads?range=all&event=all&property=${encodeURIComponent(
          item.propertySlug
         )}`}
         className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
        >
         Abrir vista filtrada de leads
        </Link>
       </div>
      </div>
     ))}
    </div>
   )}
  </div>
 );
}

function HighRecentDirectInterestList({
 items,
}: {
 items: HighRecentDirectInterestItem[];
}) {
 return (
  <div className="surface-card p-6">
   <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
    Alto interés directo reciente
   </p>
   <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
    últimos 7 días
   </h2>

   {items.length === 0 ? (
    <p className="mt-4 text-sm text-[#4d4d4d]">
     No propiedades have high recientes direct interest in the last 7 days.
    </p>
   ) : (
    <div className="mt-6 space-y-4">
     {items.map((item) => (
      <div
       key={item.propertySlug}
       className="rounded-2xl border border-[#ececec] bg-[#fafafa] px-4 py-4"
      >
       <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
         <p className="truncate font-medium text-[#000000]">
          {item.propertyTitle}
         </p>
         <p className="mt-1 truncate text-xs text-[#4d4d4d]">
          {item.propertySlug}
         </p>
         <p className="mt-2 text-xs text-[#4d4d4d]">
          WhatsApp: {item.totalWhatsapp} · Contacto:{" "}
          {item.totalContact} · Última: {formatDate(item.latestAt)}
         </p>
        </div>
        <div className="shrink-0 text-left md:text-right">
         <p className="text-2xl font-bold text-[#11518b]">
          {item.total}
         </p>
         <p className="text-xs text-[#4d4d4d]">interacciones directas</p>
        </div>
       </div>
       <div className="mt-4">
        <Link
         href={`/admin/leads?range=7d&event=all&property=${encodeURIComponent(
          item.propertySlug
         )}`}
         className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
        >
         Abrir vista filtrada de leads
        </Link>
       </div>
      </div>
     ))}
    </div>
   )}
  </div>
 );
}

export default async function AdminLeadsPage({
 searchParams,
}: {
 searchParams: Promise<{ range?: string; event?: string; property?: string }>;
}) {
 const user = await getAdminSessionUser();

 if (!user) {
  redirect("/admin/login");
 }

 const params = await searchParams;
 const currentRange: LeadRange = isValidRange(params.range) ? params.range : "all";
 const currentEventType: LeadEventFilter = isValidEventFilter(params.event)
  ? params.event
  : "all";
 const currentPropertySlug =
  typeof params.property === "string" && params.property.trim()
   ? params.property.trim()
   : null;

 const [
  leads,
  actividad,
  rutasOrigen,
  interaccionesPorDia,
  propertyFilterInfo,
  submissionSummary,
  priorityRegistrations,
  showingProfiles,
  digitalInterest,
  rankingDirectInteractions,
  persistedSubmissionCounts,
  actionRequired,
  comingSoonWithRegistrations,
  highRecentDirectInterest,
 ] = await Promise.all([
  getLeadsResumen(currentRange, currentEventType, currentPropertySlug),
  getLeadsActividadReciente(20, currentRange, currentEventType, currentPropertySlug),
  getLeadRouteOrigins(currentRange, currentEventType, currentPropertySlug),
  getLeadDailyTotals(currentRange, currentEventType, currentPropertySlug),
  getLeadPropertyFilterInfo(currentPropertySlug),
  getLeadSubmissionSummary(),
  getPriorityRegistrationLeads(25),
  getShowingProfileLeads(25),
  getGa4PropertyDigitalInterest(currentRange),
  getLeadDirectInteractionCountsByPropertyRange(currentRange),
  getLeadPersistedSubmissionCountsByPropertyRange(currentRange),
  getActionRequiredSummary(),
  getComingSoonPropertiesWithRegistrations(5),
 getHighRecentDirectInterest(5),
 ]);

 const resumen = leads as LeadItem[];
 const actividadReciente = actividad as ActividadItem[];
 const origenes = rutasOrigen as RouteOriginItem[];
 const diarios = interaccionesPorDia as DailyItem[];
 const propertyFilterLabel =
  propertyFilterInfo?.titulo ?? currentPropertySlug ?? null;
 const propertySlugsForMetadata = [
  ...new Set(
   [
    ...digitalInterest.map((item) => item.propertySlug),
    ...resumen.map((item) => item.propiedadSlug),
    ...rankingDirectInteractions.map((item) => item.propertySlug),
    ...persistedSubmissionCounts.map((item) => item.propertySlug),
   ]
    .map((slug) => slug.trim())
    .filter((slug) => slug.length > 0 && slug !== "(not set)")
  ),
 ];
 const propertyMetadata = await getLeadPropertyMetadataBySlugs(
  propertySlugsForMetadata
 );
 const digitalInterestBySlug = new Map(
  digitalInterest.map((item) => [item.propertySlug, item])
 );
 const propertyMetaBySlug = new Map(
  propertyMetadata.map((item) => [
   item.slug,
   { title: item.titulo, municipio: item.municipio, estado: item.estado },
  ])
 );
  const rankingDirectInteractionsBySlug = new Map(
   rankingDirectInteractions.map((item) => [item.propertySlug, item])
  );
 const persistedSubmissionsBySlug = new Map(
  persistedSubmissionCounts.map((item) => [item.propertySlug, item])
 );
 const mostViewed = [...digitalInterest].sort((a, b) => b.views - a.views)[0];
 const mostCta = [...digitalInterest].sort(
  (a, b) => digitalCtaTotal(b) - digitalCtaTotal(a)
 )[0];
 const mostRegistrations = [...digitalInterest].sort(
  (a, b) =>
   b.priorityRegistrationsSubmitted - a.priorityRegistrationsSubmitted
 )[0];
 const mostShowingProfiles = [...digitalInterest].sort(
  (a, b) => b.showingProfilesSubmitted - a.showingProfilesSubmitted
 )[0];
 const highestDigitalActivity = digitalInterest[0];
 const hotListingSlugs = [
  ...new Set([
   ...digitalInterest.map((item) => item.propertySlug),
   ...rankingDirectInteractions.map((item) => item.propertySlug),
   ...persistedSubmissionCounts.map((item) => item.propertySlug),
  ]),
 ].filter((slug) => slug.trim().length > 0 && slug !== "(not set)");
 const propertyOperationalActivities = hotListingSlugs
  .map((slug) => {
   const meta = propertyMetaBySlug.get(slug);
   if (!meta) return null;

   const digital = digitalInterestBySlug.get(slug);
   const direct = rankingDirectInteractionsBySlug.get(slug);
   const persisted = persistedSubmissionsBySlug.get(slug);
   const priorityRegistrations = persisted?.priorityRegistrations ?? 0;
   const showingProfiles = persisted?.showingProfiles ?? 0;

   return {
    propertySlug: slug,
    propertyTitle: meta.title,
    municipio: meta.municipio ?? "Sin municipio",
    estado: meta.estado,
    views: digital?.views ?? 0,
    priorityPageViews: digital?.priorityPageViews ?? 0,
    digitalActivity: digital?.total ?? 0,
    directInteractions: direct?.directInteractions ?? 0,
    priorityRegistrations,
    showingProfiles,
    persistedSubmissions: priorityRegistrations + showingProfiles,
   } satisfies PropertyOperationalActivity;
  })
  .filter((item): item is PropertyOperationalActivity => Boolean(item));
 const operationalRecommendations = buildOperationalRecommendations(
  propertyOperationalActivities
 );
 const hotListings = hotListingSlugs
  .map((slug) => {
   const digital = digitalInterestBySlug.get(slug);
   const direct = rankingDirectInteractionsBySlug.get(slug);
   const persisted = persistedSubmissionsBySlug.get(slug);
   const meta = propertyMetaBySlug.get(slug);
   const digitalActivity = digital?.total ?? 0;
   const directInteractions = direct?.directInteractions ?? 0;
   const priorityRegistrations = persisted?.priorityRegistrations ?? 0;
   const showingProfiles = persisted?.showingProfiles ?? 0;
   const persistedSubmissions = priorityRegistrations + showingProfiles;
   const totalRankingActivity =
    digitalActivity + directInteractions + persistedSubmissions;

   return {
    propertySlug: slug,
    propertyTitle: meta?.title ?? slug,
    municipio: meta?.municipio ?? "Sin municipio",
    estado: meta?.estado ?? null,
    digitalActivity,
    directInteractions,
    priorityRegistrations,
    showingProfiles,
    persistedSubmissions,
    totalRankingActivity,
    categoryLabel: activityCategory(totalRankingActivity),
   } satisfies HotListingRanking;
  })
  .filter((item) => item.totalRankingActivity > 0)
  .sort(
   (a, b) =>
    b.totalRankingActivity - a.totalRankingActivity ||
    b.persistedSubmissions - a.persistedSubmissions ||
    b.directInteractions - a.directInteractions ||
    b.digitalActivity - a.digitalActivity ||
    a.propertyTitle.localeCompare(b.propertyTitle, "es")
 )
  .slice(0, 5);
 const municipalityMap = new Map<
  string,
  Omit<MunicipalityActivityRow, "topProperty"> & {
   properties: Map<string, MunicipalityActivityProperty>;
  }
 >();

 for (const slug of hotListingSlugs) {
  const meta = propertyMetaBySlug.get(slug);
  if (!meta) continue;

  const digital = digitalInterestBySlug.get(slug);
  const direct = rankingDirectInteractionsBySlug.get(slug);
  const persisted = persistedSubmissionsBySlug.get(slug);
  const digitalActivity = digital?.total ?? 0;
  const directInteractions = direct?.directInteractions ?? 0;
  const priorityRegistrations = persisted?.priorityRegistrations ?? 0;
  const showingProfiles = persisted?.showingProfiles ?? 0;
  const persistedSubmissions = priorityRegistrations + showingProfiles;
  const totalActivity =
   digitalActivity + directInteractions + persistedSubmissions;

  if (totalActivity <= 0) continue;

  const municipio = meta.municipio ?? "Sin municipio";
  const current =
   municipalityMap.get(municipio) ?? {
    municipio,
    propertyCount: 0,
    digitalActivity: 0,
    directInteractions: 0,
    priorityRegistrations: 0,
    showingProfiles: 0,
    persistedSubmissions: 0,
    totalActivity: 0,
    properties: new Map<string, MunicipalityActivityProperty>(),
   };

  current.digitalActivity += digitalActivity;
  current.directInteractions += directInteractions;
  current.priorityRegistrations += priorityRegistrations;
  current.showingProfiles += showingProfiles;
  current.persistedSubmissions += persistedSubmissions;
  current.totalActivity += totalActivity;
  current.properties.set(slug, {
   propertySlug: slug,
   propertyTitle: meta.title,
   totalActivity,
   persistedSubmissions,
   directInteractions,
   digitalActivity,
  });
  current.propertyCount = current.properties.size;
  municipalityMap.set(municipio, current);
 }

 const municipalityRows = [...municipalityMap.values()]
  .map((item) => {
   const topProperty = [...item.properties.values()].sort(
    (a, b) =>
     b.totalActivity - a.totalActivity ||
     b.persistedSubmissions - a.persistedSubmissions ||
     b.directInteractions - a.directInteractions ||
     b.digitalActivity - a.digitalActivity ||
     a.propertyTitle.localeCompare(b.propertyTitle, "es")
   )[0];
   return {
    municipio: item.municipio,
    propertyCount: item.propertyCount,
    digitalActivity: item.digitalActivity,
    directInteractions: item.directInteractions,
    priorityRegistrations: item.priorityRegistrations,
    showingProfiles: item.showingProfiles,
    persistedSubmissions: item.persistedSubmissions,
    totalActivity: item.totalActivity,
    topProperty,
   } satisfies MunicipalityActivityRow;
  })
  .sort(
   (a, b) =>
    b.totalActivity - a.totalActivity ||
    b.persistedSubmissions - a.persistedSubmissions ||
    b.directInteractions - a.directInteractions ||
    b.digitalActivity - a.digitalActivity ||
    (a.municipio === "Sin municipio" ? 1 : 0) -
     (b.municipio === "Sin municipio" ? 1 : 0) ||
    a.municipio.localeCompare(b.municipio, "es")
  )
  .slice(0, 10);
 const propertyFunnels = digitalInterest
  .map((item) => buildPropertyFunnel(item, propertyMetaBySlug.get(item.propertySlug)))
  .sort(
   (a, b) =>
    b.completedSubmissions - a.completedSubmissions ||
    b.totalDigitalActivity - a.totalDigitalActivity
  );

 const totalInteracciones = resumen.reduce((acc, item) => acc + item.total, 0);
 const totalWhatsapp = resumen.reduce(
  (acc, item) => acc + item.totalWhatsapp,
  0
 );
 const totalContact = resumen.reduce((acc, item) => acc + item.totalContact, 0);

 const propiedadTopTitulo = resumen[0]?.titulo ?? "Sin datos";
 const clicksTop = resumen[0]?.total ?? 0;
 const totalPropiedadesConInteres = resumen.length;
 const topFive = resumen.slice(0, 5);

 const ultimaActividadGlobal = resumen
  .map((item) => item.ultimaInteraccion)
  .filter(Boolean)
  .sort()
  .at(-1);

 return (
  <AdminPageShell>
   <div className="space-y-8">
    <AdminPageHeader
     breadcrumbs={[
      { href: "/admin", label: "Admin" },
      { label: "Leads" },
     ]}
     eyebrow="Admin · Leads"
     title="Gestión de leads"
     description="Da seguimiento a interacciones directas de clientes e identifica qué propiedades requieren atención."
     actions={
      <Link
       href="/listados"
       className="btn-secondary"
       target="_blank"
       rel="noopener noreferrer"
      >
       Ver listados
      </Link>
     }
    >
     <div className="mt-6 flex flex-wrap gap-3">
      <RangeLink
       range="today"
       currentRange={currentRange}
       currentEventType={currentEventType}
       currentPropertySlug={currentPropertySlug}
       label="Hoy"
      />
      <RangeLink
       range="7d"
       currentRange={currentRange}
       currentEventType={currentEventType}
       currentPropertySlug={currentPropertySlug}
       label="7 días"
      />
      <RangeLink
       range="30d"
       currentRange={currentRange}
       currentEventType={currentEventType}
       currentPropertySlug={currentPropertySlug}
       label="30 días"
      />
      <RangeLink
       range="all"
       currentRange={currentRange}
       currentEventType={currentEventType}
       currentPropertySlug={currentPropertySlug}
       label="Todo"
      />
     </div>

     <div className="mt-4 flex flex-wrap gap-3">
      <EventFilterLink
       eventType="all"
       currentEventType={currentEventType}
       currentPropertySlug={currentPropertySlug}
       currentRange={currentRange}
       label="Todos"
      />
      <EventFilterLink
       eventType="whatsapp_click"
       currentEventType={currentEventType}
       currentPropertySlug={currentPropertySlug}
       currentRange={currentRange}
       label="WhatsApp"
      />
      <EventFilterLink
       eventType="contact_click"
       currentEventType={currentEventType}
       currentPropertySlug={currentPropertySlug}
       currentRange={currentRange}
       label="Contacto"
      />
     </div>

     <p className="mt-4 text-sm text-[#4d4d4d]">
      Vista actual:{" "}
      <span className="font-medium">{rangeLabel(currentRange)}</span>
      {" · "}
      Canal:{" "}
      <span className="font-medium">
       {eventFilterLabel(currentEventType)}
      </span>
     </p>

     {currentPropertySlug && (
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-3">
       <p className="text-sm text-[#4d4d4d]">
        Propiedad:{" "}
        <span className="font-semibold text-[#000000]">
         {propertyFilterLabel}
        </span>
        {!propertyFilterInfo && (
         <span className="ml-2 text-[#8a8a8a]">(no encontrada)</span>
        )}
       </p>
       <Link
        href={clearPropiedadHref({
         range: currentRange,
         eventType: currentEventType,
        })}
        className="text-sm font-semibold text-[#11518b] transition hover:text-[#0d406d]"
       >
        Limpiar propiedad
       </Link>
      </div>
     )}
    </AdminPageHeader>

    <section className="space-y-5 rounded-[28px] border border-[#ececec] bg-white p-6 shadow-sm md:p-8">
     <div>
      <p className="eyebrow">Acciones requeridas</p>
      <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
       Actividad reciente que puede requerir seguimiento.
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-[#4d4d4d]">
       Los elementos nuevos usan las Últimas 24 horas. El interés
       directo alto usa los últimos 7 días.
      </p>
     </div>

     <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
      <ActionRequiredCard
       title="Nuevos registros prioritarios"
       value={actionRequired.newPriorityRegistrations.total}
       description={
        actionRequired.newPriorityRegistrations.total > 0
         ? `Última propiedad: ${
           actionRequired.newPriorityRegistrations.latestPropertyTitle ??
           "Propiedad no disponible"
          }`
         : "No hay registros prioritarios nuevos en las Últimas 24 horas."
       }
       meta={`Última fecha: ${formatDate(
        actionRequired.newPriorityRegistrations.latestAt
       )}`}
       href="#priority-registrations"
       linkLabel="Ver registros prioritarios"
      />
      <ActionRequiredCard
       title="Nuevos perfiles para visita"
       value={actionRequired.newShowingProfiles.total}
       description={
        actionRequired.newShowingProfiles.total > 0
         ? `Última propiedad: ${
           actionRequired.newShowingProfiles.latestPropertyTitle ??
           "Propiedad no disponible"
          }`
         : "No hay perfiles para visita nuevos en las Últimas 24 horas."
       }
       meta={`Última fecha: ${formatDate(
        actionRequired.newShowingProfiles.latestAt
       )}`}
       href="#showing-profiles"
       linkLabel="Ver perfiles para visita"
      />
      <ActionRequiredCard
       title="Contactos directos recientes"
       value={actionRequired.recentDirectContacts.total}
       description={
        actionRequired.recentDirectContacts.total > 0
         ? `WhatsApp: ${actionRequired.recentDirectContacts.totalWhatsapp} · Contacto: ${actionRequired.recentDirectContacts.totalContact}`
         : "No hay contactos directos registrados en las Últimas 24 horas."
       }
       meta={
        actionRequired.recentDirectContacts.latestPropertyTitle
         ? `Última propiedad: ${actionRequired.recentDirectContacts.latestPropertyTitle}`
         : "Última propiedad: ninguna"
       }
       href="#recientes-direct-activity"
       linkLabel="Ver actividad reciente"
      />
      <ActionRequiredCard
       title="Próximamente con registros"
       value={comingSoonWithRegistrations.length}
       description={
        comingSoonWithRegistrations.length > 0
         ? "Propiedades próximamente con registros prioritarios activos."
         : "No hay propiedades próximamente con registros."
       }
       meta="5 principales abajo"
       href="#coming-soon-registrations"
       linkLabel="Revisar listados"
      />
      <ActionRequiredCard
       title="Alto interés directo reciente"
       value={highRecentDirectInterest.length}
       description={
        highRecentDirectInterest.length > 0
         ? "Propiedades con más interacciones directas en los últimos 7 días."
         : "No hay alto interés directo en los últimos 7 días."
       }
       meta="5 principales abajo"
       href="#high-recientes-direct-interest"
       linkLabel="Revisar actividad"
      />
     </div>

     <div className="grid gap-6 xl:grid-cols-2">
      <div id="coming-soon-registrations">
       <ComingSoonRegistrationsList items={comingSoonWithRegistrations} />
      </div>
      <div id="high-recientes-direct-interest">
       <HighRecentDirectInterestList items={highRecentDirectInterest} />
      </div>
     </div>
    </section>

    <OperationalRecommendationsSection items={operationalRecommendations} />

    <CollapsibleAdminSection
     count={submissionSummary.priorityRegistrations.total}
     defaultOpen
     level={2}
     storageKey="admin-leads-priority-registrations"
     subtitle="Compradores de propiedades próximamente listos para seguimiento."
     title="Registros prioritarios"
    >
     <div className="space-y-5 p-6">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
       <ActionCard
        label="Registros prioritarios"
        value={`${submissionSummary.priorityRegistrations.total} pendientes`}
        description="Compradores de propiedades próximamente listos para seguimiento."
        meta={`Último recibido: ${formatDate(
         submissionSummary.priorityRegistrations.lastReceived
        )}`}
        href="#priority-registrations"
        linkLabel="Ver registros"
       />
       <ActionCard
        label="Perfiles de comprador"
        value="Solo email"
        description="Los perfiles generales de comprador todavía no se guardan."
        meta="El flujo actual envía email únicamente."
       />
       <ActionCard
        label="Formularios de vendedor"
        value="Solo email"
        description="Los formularios de comprador y vendedor todavía no se guardan."
        meta="El flujo actual envía email únicamente."
       />
      </div>
      <PriorityRegistrationsTable items={priorityRegistrations} />
     </div>
    </CollapsibleAdminSection>

    <CollapsibleAdminSection
     count={submissionSummary.propertyBuyerProfiles.total}
     defaultOpen
     level={2}
     storageKey="admin-leads-showing-profiles"
     subtitle="Perfiles de comprador por propiedad enviados para visitas."
     title="Perfiles para visita"
    >
     <div className="space-y-5 p-6">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
       <ActionCard
        label="Perfiles para visita"
        value={`${submissionSummary.propertyBuyerProfiles.total} recibidos`}
        description="Perfiles de comprador por propiedad recibidos."
        meta={`Último recibido: ${formatDate(
         submissionSummary.propertyBuyerProfiles.lastReceived
        )}`}
       />
      </div>
      <ShowingProfilesTable items={showingProfiles} />
     </div>
    </CollapsibleAdminSection>

    <CollapsibleAdminSection
     count={digitalInterest.length}
     level={3}
     storageKey="admin-leads-digital-interest"
     subtitle="Vistas, clics CTA y acciones exitosas por propiedad."
     title="Interés digital (GA4)"
    >
     <div className="space-y-5 p-6">
     {digitalInterest.length === 0 ? (
      <div className="surface-card border-l-4 border-[#11518b] p-6 text-sm text-[#4d4d4d]">
       Los informes digitales por propiedad todavía se están procesando en Google Analytics.
      </div>
     ) : (
      <>
       <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <DigitalActivityCard
         label="Propiedad más vista"
         item={mostViewed}
         value={mostViewed?.views ?? 0}
         description="Vistas de propiedades registradas por GA4."
        />
        <DigitalActivityCard
         label="Más clics en CTA"
         item={mostCta}
         value={mostCta ? digitalCtaTotal(mostCta) : 0}
         description="Priority, contact, WhatsApp and showing CTA clicks."
        />
        <DigitalActivityCard
         label="Más registros"
         item={mostRegistrations}
         value={mostRegistrations?.priorityRegistrationsSubmitted ?? 0}
         description="Registros prioritarios enviados."
        />
        <DigitalActivityCard
         label="Más perfiles para visita"
         item={mostShowingProfiles}
         value={mostShowingProfiles?.showingProfilesSubmitted ?? 0}
         description="Perfiles para visita enviados."
        />
        <DigitalActivityCard
         label="Mayor actividad digital"
         item={highestDigitalActivity}
         value={highestDigitalActivity?.total ?? 0}
         description="Total GA4 acciones digitales."
        />
       </div>

       <div className="grid gap-6 xl:grid-cols-2">
        <HotListingsTable items={hotListings} />
        <MunicipalityActivitySection items={municipalityRows} />
       </div>
      </>
     )}
    </div>
    </CollapsibleAdminSection>

    <CollapsibleAdminSection
     count={propertyFunnels.length}
     level={3}
     storageKey="admin-leads-property-intelligence-funnel"
     subtitle="Progreso por propiedad desde vistas hasta leads reales."
     title="Property Intelligence Funnel"
    >
     <div className="p-6">
      <PropertyIntelligenceFunnelSection items={propertyFunnels} />
     </div>
    </CollapsibleAdminSection>

    <CollapsibleAdminSection
     count={totalInteracciones}
     level={3}
     storageKey="admin-leads-direct-interest"
     subtitle="Solo lead_events internos de Neon: clics en WhatsApp y contacto."
     title="Interés directo (Neon)"
    >
     <div className="space-y-6 p-6">
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
     <StatCard
      label="Interacciones directas"
      value={totalInteracciones}
      description="Direct lead actions recorded"
     />
     <StatCard
      label="Contactos por WhatsApp"
      value={totalWhatsapp}
      description="Direct WhatsApp intent"
     />
     <StatCard
      label="Solicitudes de contacto"
      value={totalContact}
      description="Acciones CTA de contacto"
     />
     <StatCard
      label="Propiedades con interés directo"
      value={totalPropiedadesConInteres}
      description="Listados con actividad directa de leads"
     />
     <StatCard
      label="Última actividad"
      value={formatDate(ultimaActividadGlobal ?? null)}
      description="Interacción directa más reciente"
     />
     <StatCard
      label="Más contactada"
      value={clicksTop}
      description={
       propiedadTopTitulo === "Sin datos"
        ? "Sin actividad directa todavía"
        : `Propiedad principal: ${propiedadTopTitulo}`
      }
     />
    </div>
     <div className="grid gap-6 xl:grid-cols-2">
      <ChannelBar whatsapp={totalWhatsapp} contact={totalContact} />
      <TopPropertiesChart items={topFive} />
     </div>

     <div className="grid gap-6 xl:grid-cols-2">
      <DailyInteractionsChart items={diarios} />
      <RouteOriginBreakdown items={origenes} />
     </div>
     </div>
    </CollapsibleAdminSection>

    <CollapsibleAdminSection
     countLabel={`(${topFive.length} propiedades · ${actividadReciente.length} recientes)`}
     level={3}
     storageKey="admin-leads-recientes-activity"
     subtitle="Contactos directos recientes y propiedades más contactadas."
     title="Actividad reciente"
    >
    <div className="grid gap-6 p-6 xl:grid-cols-[0.95fr_1.05fr]">
     <div id="recientes-direct-activity" className="surface-card p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
       Seguimiento
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
       Propiedades más contactadas
      </h2>

      {topFive.length === 0 ? (
       <p className="mt-4 text-sm text-[#4d4d4d]">
        No se registraron interacciones directas durante el periodo seleccionado.
       </p>
      ) : (
       <div className="mt-6 space-y-4">
        {topFive.map((item, index) => (
         <div
          key={item.propiedadSlug}
          className="rounded-2xl border border-[#ececec] bg-[#fafafa] px-4 py-4"
         >
          <div className="flex items-start justify-between gap-4">
           <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4af37]">
             #{index + 1}
            </p>
            <p className="mt-1 truncate font-medium text-[#000000]">
             {item.titulo}
            </p>
            <p className="mt-1 truncate text-xs text-[#4d4d4d]">
             {item.propiedadSlug}
            </p>
            <p className="mt-2 text-xs text-[#4d4d4d]">
             Último evento: {formatDate(item.ultimaInteraccion)}
            </p>
           </div>

           <div className="text-right">
            <p className="text-2xl font-bold text-[#11518b]">
             {item.total}
            </p>
            <p className="text-xs text-[#4d4d4d]">directas</p>
           </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
           <Link
            href={`/listados/${item.propiedadSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
           >
            Ver web
           </Link>

           {item.propiedadId && (
            <Link
             href={`/admin/propiedades/${item.propiedadId}/editar`}
             className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
            >
             Editar
            </Link>
           )}
          </div>
         </div>
        ))}
       </div>
      )}
     </div>

     <div className="surface-card p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
       Actividad reciente
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
       Contactos directos recientes
      </h2>

      {actividadReciente.length === 0 ? (
       <p className="mt-4 text-sm text-[#4d4d4d]">
        No se registraron interacciones directas durante el periodo seleccionado.
       </p>
      ) : (
       <div className="mt-6 space-y-4">
        {actividadReciente.map((item) => (
         <div
          key={item.id}
          className="rounded-2xl border border-[#ececec] bg-[#fafafa] px-4 py-4"
         >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
           <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
             <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${eventBadgeClasses(
               item.tipoEvento
              )}`}
             >
              {eventLabel(item.tipoEvento)}
             </span>
             <CrmEstadoBadge>Contacto directo</CrmEstadoBadge>

             <span className="text-xs text-[#4d4d4d]">
              {formatRelative(item.createdAt)}
             </span>
            </div>

            <p className="mt-3 font-medium text-[#000000]">
             {item.titulo}
            </p>

            {item.propiedadSlug && (
             <p className="mt-1 text-xs text-[#4d4d4d]">
              {item.propiedadSlug}
             </p>
            )}

            <p className="mt-2 text-xs text-[#4d4d4d]">
             Ruta origen: {item.rutaOrigen ?? "—"}
            </p>

            <p className="mt-1 text-xs text-[#4d4d4d]">
             Fecha: {formatDate(item.createdAt)}
            </p>
           </div>

           <div className="flex flex-wrap gap-3">
            {item.propiedadSlug && (
             <Link
              href={`/listados/${item.propiedadSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
             >
              Ver web
             </Link>
            )}

            {item.propiedadId && (
             <Link
              href={`/admin/propiedades/${item.propiedadId}/editar`}
              className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
             >
              Editar
             </Link>
            )}
           </div>
          </div>
         </div>
        ))}
       </div>
      )}
     </div>
    </div>
    </CollapsibleAdminSection>

    <CollapsibleAdminSection
     count={resumen.length}
     level={3}
     storageKey="admin-leads-crm-summary"
     subtitle="Resumen operativo por propiedad para interés directo y digital."
     title="Resumen CRM por propiedad"
    >
     {resumen.length === 0 ? (
      <div className="px-6 py-12 text-center">
       <p className="text-lg font-medium text-[#000000]">
        No se registraron interacciones directas durante el periodo seleccionado.
       </p>
       <p className="mt-2 text-sm text-[#4d4d4d]">
        When someone clicks WhatsApp or a contact CTA from a property,
        it will appear here for broker follow-up.
       </p>
      </div>
     ) : (
      <div className="overflow-x-auto">
       <table className="min-w-full">
        <thead className="bg-[#fafafa]">
         <tr className="text-left">
          <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
           Propiedad
          </th>
          <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
           Direct interest
          </th>
          <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
           Interés digital
          </th>
          <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
           WhatsApp
          </th>
          <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
           Contacto
          </th>
          <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
           Primera interacción
          </th>
          <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
           Última interacción
          </th>
          <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
           Acciones
          </th>
         </tr>
        </thead>

        <tbody>
         {resumen.map((item) => {
          const digital = digitalInterestBySlug.get(item.propiedadSlug);

          return (
          <tr
           key={item.propiedadSlug}
           className="border-t border-[#f0f0f0]"
          >
           <td className="px-6 py-4">
            <div className="min-w-0">
             <p className="font-medium text-[#000000]">
              {item.titulo}
             </p>
             <p className="mt-1 text-xs text-[#4d4d4d]">
              {item.propiedadSlug}
             </p>
            </div>
           </td>

           <td className="px-6 py-4">
            <span className="inline-flex min-w-[56px] items-center justify-center rounded-full bg-[#11518b]/10 px-3 py-1.5 text-sm font-semibold text-[#11518b]">
             {item.total}
            </span>
           </td>

           <td className="px-6 py-4">
            <div className="min-w-[220px]">
             <span
              className="inline-flex min-w-[120px] items-center justify-center rounded-full bg-[#11518b]/10 px-3 py-1.5 text-sm font-semibold text-[#11518b]"
              title="Vistas del website, clics CTA y acciones exitosas por propiedad registradas por Google Analytics."
             >
              {digital?.total ?? 0} acciones digitales
             </span>
             <DigitalInterestDetails item={digital} />
            </div>
           </td>

           <td className="px-6 py-4 text-sm text-[#4d4d4d]">
            {item.totalWhatsapp}
           </td>

           <td className="px-6 py-4 text-sm text-[#4d4d4d]">
            {item.totalContact}
           </td>

           <td className="px-6 py-4 text-sm text-[#4d4d4d]">
            {formatDate(item.primeraInteraccion)}
           </td>

           <td className="px-6 py-4 text-sm text-[#4d4d4d]">
            {formatDate(item.ultimaInteraccion)}
           </td>

           <td className="px-6 py-4">
            <div className="flex flex-wrap gap-3">
             <Link
              href={`/listados/${item.propiedadSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
             >
              Ver web
             </Link>

             {item.propiedadId && (
              <Link
               href={`/admin/propiedades/${item.propiedadId}/editar`}
               className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
              >
               Editar
              </Link>
             )}

             <Link
              href="/admin/propiedades"
              className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
             >
              Ir a propiedades
             </Link>
            </div>
           </td>
          </tr>
          );
         })}
        </tbody>
       </table>
      </div>
     )}
    </CollapsibleAdminSection>
   </div>
  </AdminPageShell>
 );
}
