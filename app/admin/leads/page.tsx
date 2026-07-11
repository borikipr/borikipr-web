import Link from "next/link";
import { redirect } from "next/navigation";
import CopyLeadValueButton from "@/components/admin/CopyLeadValueButton";
import {
  getGa4PropertyDigitalInterest,
  type Ga4PropertyDigitalInterest,
} from "@/lib/admin/analytics/providers/ga4";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
  getActionRequiredSummary,
  getComingSoonPropertiesWithRegistrations,
  getHighRecentDirectInterest,
  getLeadSubmissionSummary,
  getLeadsActividadReciente,
  getLeadDailyTotals,
  getLeadPropertyFilterInfo,
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

function CrmStatusBadge({
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
      return "Últimos 7 días";
    case "30d":
      return "Últimos 30 días";
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

function clearPropertyHref({
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
          No direct interactions were recorded during the selected period.
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
          No direct interactions were recorded during the selected period.
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
          Priority Registrations
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
          Coming Soon buyer interest
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-lg font-medium text-[#000000]">
            No priority registrations yet.
          </p>
          <p className="mt-2 text-sm text-[#4d4d4d]">
            Registrations from Coming Soon properties will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#fafafa]">
              <tr className="text-left">
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Date</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Property</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Buyer Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Purchase Type</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Phone</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Email</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Actions</th>
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
                    <CrmStatusBadge>Priority Registration</CrmStatusBadge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/listados/${item.propertySlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
                      >
                        View Property
                      </Link>
                      <CopyLeadValueButton value={item.email} label="Copy Email" />
                      <CopyLeadValueButton value={item.phone} label="Copy Phone" />
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
          Showing Profiles
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
          Property buyer profiles received
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-lg font-medium text-[#000000]">
            No showing profiles received.
          </p>
          <p className="mt-2 text-sm text-[#4d4d4d]">
            Property-specific buyer profiles will appear here after submission.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#fafafa]">
              <tr className="text-left">
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Date</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Property</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Buyer Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Purchase Method</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Prequalified</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">Actions</th>
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
                      {item.propertyTitle ?? "Property not linked"}
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
                    <CrmStatusBadge>Showing Profile</CrmStatusBadge>
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
                          View Property
                        </Link>
                      ) : (
                        <span className="text-xs text-[#8a8a8a]">
                          Property unavailable
                        </span>
                      )}
                      <CopyLeadValueButton value={item.email} label="Copy Email" />
                      <CopyLeadValueButton value={item.phone} label="Copy Phone" />
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
        {item?.propertySlug ?? "No GA4 data yet"}
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
        Digital property reporting is still populating from Google Analytics.
      </p>
    );
  }

  const rows = [
    ["Website views", item.views],
    ["Priority page views", item.priorityPageViews],
    ["Registration CTA clicks", item.registrationCtaClicks],
    ["WhatsApp clicks", item.whatsappClicks],
    ["Contact clicks", item.contactClicks],
    ["Showing CTA clicks", item.showingCtaClicks],
    ["Priority registrations submitted", item.priorityRegistrationsSubmitted],
    ["Showing profiles submitted", item.showingProfilesSubmitted],
  ];

  return (
    <details className="mt-3 rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-3">
      <summary className="cursor-pointer text-xs font-semibold text-[#11518b]">
        View GA4 details
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
  items: Array<{
    propertySlug: string;
    propertyTitle: string;
    views: number;
    ctaClicks: number;
    submissions: number;
    total: number;
  }>;
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-[#eeeeee] px-6 py-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#11518b]">
          Top 5 Hot Listings
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
          GA4 digital activity ranking
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="px-6 py-10 text-sm text-[#4d4d4d]">
          Digital property reporting is still populating from Google Analytics.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#fafafa]">
              <tr className="text-left">
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
                  Property
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
                  Digital actions
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.propertySlug} className="border-t border-[#f0f0f0]">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-[#000000]">
                      {item.propertyTitle}
                    </p>
                    <p className="mt-1 text-xs text-[#4d4d4d]">
                      {item.propertySlug}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#11518b]">
                    {item.total} digital actions
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full border border-[#d9d9d9] bg-[#f8f8f8] px-3 py-1 text-xs font-semibold text-[#4d4d4d]">
                      Views {item.views} · CTA {item.ctaClicks} · Submissions{" "}
                      {item.submissions}
                    </span>
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

function MunicipalityDigitalTable({
  items,
}: {
  items: Array<{
    municipio: string;
    views: number;
    ctaClicks: number;
    submissions: number;
  }>;
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-[#eeeeee] px-6 py-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#11518b]">
          Municipalities
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
          Digital interest by municipality
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="px-6 py-10 text-sm text-[#4d4d4d]">
          Digital property reporting is still populating from Google Analytics.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#fafafa]">
              <tr className="text-left">
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
                  Municipality
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
                  Views
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
                  CTA
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-[#000000]">
                  Submissions
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
                    {item.views}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#4d4d4d]">
                    {item.ctaClicks}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#4d4d4d]">
                    {item.submissions}
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

function ComingSoonRegistrationsList({
  items,
}: {
  items: ComingSoonRegistrationItem[];
}) {
  return (
    <div className="surface-card p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
        Coming Soon With Registrations
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
        Follow-up opportunities
      </h2>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[#4d4d4d]">
          No Coming Soon properties currently have registrations.
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
                    Latest registration: {formatDate(item.latestAt)}
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
                  Open filtered lead view
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
        High Recent Direct Interest
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
        Last 7 days
      </h2>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[#4d4d4d]">
          No properties have high recent direct interest in the last 7 days.
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
                    WhatsApp: {item.totalWhatsapp} · Contact:{" "}
                    {item.totalContact} · Latest: {formatDate(item.latestAt)}
                  </p>
                </div>
                <div className="shrink-0 text-left md:text-right">
                  <p className="text-2xl font-bold text-[#11518b]">
                    {item.total}
                  </p>
                  <p className="text-xs text-[#4d4d4d]">direct interactions</p>
                </div>
              </div>
              <div className="mt-4">
                <Link
                  href={`/admin/leads?range=7d&event=all&property=${encodeURIComponent(
                    item.propertySlug
                  )}`}
                  className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
                >
                  Open filtered lead view
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
  const digitalInterestBySlug = new Map(
    digitalInterest.map((item) => [item.propertySlug, item])
  );
  const propertyMetaBySlug = new Map(
    resumen.map((item) => [
      item.propiedadSlug,
      { title: item.titulo, municipio: item.municipio },
    ])
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
  const hotListings = digitalInterest.slice(0, 5).map((item) => ({
    propertySlug: item.propertySlug,
    propertyTitle: propertyMetaBySlug.get(item.propertySlug)?.title ?? item.propertySlug,
    views: item.views,
    ctaClicks: digitalCtaTotal(item),
    submissions: digitalSubmissionTotal(item),
    total: item.total,
  }));
  const municipalityMap = new Map<
    string,
    { municipio: string; views: number; ctaClicks: number; submissions: number }
  >();

  for (const item of digitalInterest) {
    const municipio =
      propertyMetaBySlug.get(item.propertySlug)?.municipio ?? "Sin municipio";
    const current =
      municipalityMap.get(municipio) ?? {
        municipio,
        views: 0,
        ctaClicks: 0,
        submissions: 0,
      };

    current.views += item.views;
    current.ctaClicks += digitalCtaTotal(item);
    current.submissions += digitalSubmissionTotal(item);
    municipalityMap.set(municipio, current);
  }

  const municipalityRows = [...municipalityMap.values()]
    .sort(
      (a, b) =>
        b.views +
        b.ctaClicks +
        b.submissions -
        (a.views + a.ctaClicks + a.submissions)
    )
    .slice(0, 10);

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
    <main className="px-6 py-10">
      <div className="section-shell space-y-8">
        <div className="surface-card p-8 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Admin · Leads</p>
              <h1 className="mt-3 text-3xl font-bold text-[#000000]">
                Lead Management
              </h1>
              <p className="body-base mt-3 max-w-3xl">
                Track direct customer interactions and identify which properties
                require broker follow-up.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className="btn-secondary">
                Volver al dashboard
              </Link>
              <Link href="/listados" className="btn-secondary" target="_blank" rel="noopener noreferrer">
                Ver listados
              </Link>
            </div>
          </div>

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
                href={clearPropertyHref({
                  range: currentRange,
                  eventType: currentEventType,
                })}
                className="text-sm font-semibold text-[#11518b] transition hover:text-[#0d406d]"
              >
                Limpiar propiedad
              </Link>
            </div>
          )}
        </div>

        <div className="surface-card flex flex-col gap-4 border-l-4 border-[#11518b] p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
              Alcance del dashboard
            </p>
            <p className="mt-2 text-sm text-[#4d4d4d]">
              Only direct interactions are shown here. Website traffic,
              behavior and digital engagement are available under Analytics.
            </p>
          </div>
          <Link href="/admin/analytics" className="btn-secondary shrink-0">
            Open Analytics
          </Link>
        </div>

        <section className="space-y-5">
          <div>
            <p className="eyebrow">Action Required</p>
            <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
              Recent lead activity that may require broker follow-up.
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-[#4d4d4d]">
              New items use the last 24 hours. High direct interest uses the
              last 7 days. No workflow status has been added yet.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            <ActionRequiredCard
              title="New Priority Registrations"
              value={actionRequired.newPriorityRegistrations.total}
              description={
                actionRequired.newPriorityRegistrations.total > 0
                  ? `Latest: ${
                      actionRequired.newPriorityRegistrations.latestPropertyTitle ??
                      "Property unavailable"
                    }`
                  : "No new priority registrations in the last 24 hours."
              }
              meta={`Latest timestamp: ${formatDate(
                actionRequired.newPriorityRegistrations.latestAt
              )}`}
              href="#priority-registrations"
              linkLabel="View Priority Registrations"
            />
            <ActionRequiredCard
              title="New Showing Profiles"
              value={actionRequired.newShowingProfiles.total}
              description={
                actionRequired.newShowingProfiles.total > 0
                  ? `Latest: ${
                      actionRequired.newShowingProfiles.latestPropertyTitle ??
                      "Property unavailable"
                    }`
                  : "No new showing profiles in the last 24 hours."
              }
              meta={`Latest timestamp: ${formatDate(
                actionRequired.newShowingProfiles.latestAt
              )}`}
              href="#showing-profiles"
              linkLabel="View Showing Profiles"
            />
            <ActionRequiredCard
              title="Recent Direct Contacts"
              value={actionRequired.recentDirectContacts.total}
              description={
                actionRequired.recentDirectContacts.total > 0
                  ? `WhatsApp: ${actionRequired.recentDirectContacts.totalWhatsapp} · Contact: ${actionRequired.recentDirectContacts.totalContact}`
                  : "No direct contacts recorded in the last 24 hours."
              }
              meta={
                actionRequired.recentDirectContacts.latestPropertyTitle
                  ? `Latest property: ${actionRequired.recentDirectContacts.latestPropertyTitle}`
                  : "Latest property: none"
              }
              href="#recent-direct-activity"
              linkLabel="View Recent Activity"
            />
            <ActionRequiredCard
              title="Coming Soon With Registrations"
              value={comingSoonWithRegistrations.length}
              description={
                comingSoonWithRegistrations.length > 0
                  ? "Coming Soon listings with active priority registrations."
                  : "No Coming Soon properties currently have registrations."
              }
              meta="Top 5 shown below"
              href="#coming-soon-registrations"
              linkLabel="Review Listings"
            />
            <ActionRequiredCard
              title="High Recent Direct Interest"
              value={highRecentDirectInterest.length}
              description={
                highRecentDirectInterest.length > 0
                  ? "Properties with the most direct interactions in the last 7 days."
                  : "No high recent direct interest in the last 7 days."
              }
              meta="Top 5 shown below"
              href="#high-recent-direct-interest"
              linkLabel="Review Activity"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div id="coming-soon-registrations">
              <ComingSoonRegistrationsList items={comingSoonWithRegistrations} />
            </div>
            <div id="high-recent-direct-interest">
              <HighRecentDirectInterestList items={highRecentDirectInterest} />
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <p className="eyebrow">Lead Submissions</p>
            <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
              Existing successful submissions
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-[#4d4d4d]">
              These cards surface existing successful submissions already saved
              in Neon. No pipeline status or workflow has been added yet.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <ActionCard
              label="Priority registrations"
              value={`${submissionSummary.priorityRegistrations.total} waiting`}
              description="Coming Soon buyers ready for follow-up."
              meta={`Last received: ${formatDate(
                submissionSummary.priorityRegistrations.lastReceived
              )}`}
              href="#priority-registrations"
              linkLabel="View registrations"
            />
            <ActionCard
              label="Showing profiles"
              value={`${submissionSummary.propertyBuyerProfiles.total} received`}
              description="Property-specific buyer profiles submitted."
              meta={`Last received: ${formatDate(
                submissionSummary.propertyBuyerProfiles.lastReceived
              )}`}
            />
            <ActionCard
              label="Buyer profiles"
              value="Email only"
              description="General buyer profile records are not persisted yet."
              meta="Current general buyer profile flow sends email only."
            />
            <ActionCard
              label="Seller forms"
              value="Email only"
              description="Buyer and seller request records are not persisted yet."
              meta="Current buyer and seller flows send email only."
            />
          </div>
        </section>

        <PriorityRegistrationsTable items={priorityRegistrations} />
        <ShowingProfilesTable items={showingProfiles} />

        <section className="space-y-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#11518b]">
              Digital Interest (GA4)
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
              Digital Property Activity
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-[#4d4d4d]">
              GA4 website views, CTA clicks and successful property actions are
              shown separately from Neon direct interest.
            </p>
          </div>

          {digitalInterest.length === 0 ? (
            <div className="surface-card border-l-4 border-[#11518b] p-6 text-sm text-[#4d4d4d]">
              Digital property reporting is still populating from Google
              Analytics.
            </div>
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
                <DigitalActivityCard
                  label="Most viewed property"
                  item={mostViewed}
                  value={mostViewed?.views ?? 0}
                  description="Property views recorded by GA4."
                />
                <DigitalActivityCard
                  label="Most CTA clicks"
                  item={mostCta}
                  value={mostCta ? digitalCtaTotal(mostCta) : 0}
                  description="Priority, contact, WhatsApp and showing CTA clicks."
                />
                <DigitalActivityCard
                  label="Most registrations"
                  item={mostRegistrations}
                  value={mostRegistrations?.priorityRegistrationsSubmitted ?? 0}
                  description="Priority registrations submitted."
                />
                <DigitalActivityCard
                  label="Most showing profiles"
                  item={mostShowingProfiles}
                  value={mostShowingProfiles?.showingProfilesSubmitted ?? 0}
                  description="Showing profiles submitted."
                />
                <DigitalActivityCard
                  label="Highest digital activity"
                  item={highestDigitalActivity}
                  value={highestDigitalActivity?.total ?? 0}
                  description="Total GA4 digital actions."
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <HotListingsTable items={hotListings} />
                <MunicipalityDigitalTable items={municipalityRows} />
              </div>
            </>
          )}
        </section>

        <section className="space-y-5">
          <div>
            <p className="eyebrow">Direct Interest (Neon)</p>
            <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
              Direct contact activity
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-[#4d4d4d]">
              These metrics come from internal lead_events only: WhatsApp and
              contact CTA clicks.
            </p>
          </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
          <StatCard
            label="Direct interactions"
            value={totalInteracciones}
            description="Direct lead actions recorded"
          />
          <StatCard
            label="WhatsApp contacts"
            value={totalWhatsapp}
            description="Direct WhatsApp intent"
          />
          <StatCard
            label="Contact requests"
            value={totalContact}
            description="Contact CTA actions"
          />
          <StatCard
            label="Properties with direct interest"
            value={totalPropiedadesConInteres}
            description="Listings with direct lead activity"
          />
          <StatCard
            label="Latest activity"
            value={formatDate(ultimaActividadGlobal ?? null)}
            description="Most recent direct interaction"
          />
          <StatCard
            label="Most contacted"
            value={clicksTop}
            description={
              propiedadTopTitulo === "Sin datos"
                ? "No direct activity yet"
                : `Top property: ${propiedadTopTitulo}`
            }
          />
        </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChannelBar whatsapp={totalWhatsapp} contact={totalContact} />
          <TopPropertiesChart items={topFive} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <DailyInteractionsChart items={diarios} />
          <RouteOriginBreakdown items={origenes} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div id="recent-direct-activity" className="surface-card p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              Seguimiento
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
              Propiedades más contactadas
            </h2>

            {topFive.length === 0 ? (
              <p className="mt-4 text-sm text-[#4d4d4d]">
                No direct interactions were recorded during the selected period.
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
                No direct interactions were recorded during the selected period.
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
                          <CrmStatusBadge>Direct Contact</CrmStatusBadge>

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

        <div className="surface-card overflow-hidden">
          <div className="border-b border-[#eeeeee] px-6 py-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              Detalle operativo
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
              Resumen CRM por propiedad
            </h2>
          </div>

          {resumen.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-lg font-medium text-[#000000]">
                No direct interactions were recorded during the selected period.
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
                      Digital Interest
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
                            title="Website views, CTA clicks and successful property actions recorded by Google Analytics."
                          >
                            {digital?.total ?? 0} digital actions
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
        </div>
      </div>
    </main>
  );
}
