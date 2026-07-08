import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
  getLeadsActividadReciente,
  getLeadDailyTotals,
  getLeadRouteOrigins,
  getLeadsResumen,
  type LeadDailyTotal,
  type LeadEventFilter,
  type LeadRange,
  type LeadRouteOrigin,
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

type LeadItem = {
  propiedadId: string | null;
  propiedadSlug: string;
  titulo: string;
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
      return "bg-[#25D366]/10 text-[#1f9d4c]";
    case "contact_click":
      return "bg-[#11518b]/10 text-[#11518b]";
    default:
      return "bg-[#4d4d4d]/10 text-[#4d4d4d]";
  }
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
}: {
  range: LeadRange;
  eventType: LeadEventFilter;
}) {
  const params = new URLSearchParams();
  params.set("range", range);
  params.set("event", eventType);
  return `/admin/leads?${params.toString()}`;
}

function RangeLink({
  range,
  currentRange,
  currentEventType,
  label,
}: {
  range: LeadRange;
  currentRange: LeadRange;
  currentEventType: LeadEventFilter;
  label: string;
}) {
  const active = range === currentRange;

  return (
    <Link
      href={leadsHref({ range, eventType: currentEventType })}
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
  label,
}: {
  eventType: LeadEventFilter;
  currentEventType: LeadEventFilter;
  currentRange: LeadRange;
  label: string;
}) {
  const active = eventType === currentEventType;

  return (
    <Link
      href={leadsHref({ range: currentRange, eventType })}
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
        Conversión por canal
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
        WhatsApp vs Contacto
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
        Visual rápido
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
        Top propiedades
      </h2>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[#4d4d4d]">
          Aún no hay datos para graficar.
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
        Tendencia diaria
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
        Interacciones por día
      </h2>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#d9d9d9] bg-[#fafafa] p-6 text-sm text-[#4d4d4d]">
          No hay interacciones registradas para el rango y canal seleccionados.
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
        Origen de interacción
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
        Rutas que generan interés
      </h2>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#d9d9d9] bg-[#fafafa] p-6 text-sm text-[#4d4d4d]">
          Aún no hay rutas de origen para mostrar en esta vista.
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

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; event?: string }>;
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

  const [leads, actividad, rutasOrigen, interaccionesPorDia] = await Promise.all([
    getLeadsResumen(currentRange, currentEventType),
    getLeadsActividadReciente(20, currentRange, currentEventType),
    getLeadRouteOrigins(currentRange, currentEventType),
    getLeadDailyTotals(currentRange, currentEventType),
  ]);

  const resumen = leads as LeadItem[];
  const actividadReciente = actividad as ActividadItem[];
  const origenes = rutasOrigen as RouteOriginItem[];
  const diarios = interaccionesPorDia as DailyItem[];

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
                Interacciones del website
              </h1>
              <p className="body-base mt-3 max-w-3xl">
                Monitorea los clics internos registrados desde las propiedades:
                WhatsApp, contacto, rutas de origen y actividad reciente.
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
              label="Hoy"
            />
            <RangeLink
              range="7d"
              currentRange={currentRange}
              currentEventType={currentEventType}
              label="7 días"
            />
            <RangeLink
              range="30d"
              currentRange={currentRange}
              currentEventType={currentEventType}
              label="30 días"
            />
            <RangeLink
              range="all"
              currentRange={currentRange}
              currentEventType={currentEventType}
              label="Todo"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <EventFilterLink
              eventType="all"
              currentEventType={currentEventType}
              currentRange={currentRange}
              label="Todos"
            />
            <EventFilterLink
              eventType="whatsapp_click"
              currentEventType={currentEventType}
              currentRange={currentRange}
              label="WhatsApp"
            />
            <EventFilterLink
              eventType="contact_click"
              currentEventType={currentEventType}
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
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
          <StatCard
            label="Total"
            value={totalInteracciones}
            description="Interacciones registradas"
          />
          <StatCard
            label="WhatsApp"
            value={totalWhatsapp}
            description="Clicks a WhatsApp"
          />
          <StatCard
            label="Contacto"
            value={totalContact}
            description="Clicks a contacto"
          />
          <StatCard
            label="Listings con interés"
            value={totalPropiedadesConInteres}
            description="Propiedades con actividad"
          />
          <StatCard
            label="Última actividad"
            value={formatDate(ultimaActividadGlobal ?? null)}
            description="Interacción más reciente"
          />
          <StatCard
            label="Top actual"
            value={clicksTop}
            description={
              propiedadTopTitulo === "Sin datos"
                ? "Sin datos suficientes"
                : `Más interés en: ${propiedadTopTitulo}`
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

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="surface-card p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              Top 5
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
              Propiedades con más interés
            </h2>

            {topFive.length === 0 ? (
              <p className="mt-4 text-sm text-[#4d4d4d]">
                Aún no se han registrado interacciones.
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
                        <p className="text-xs text-[#4d4d4d]">interacciones</p>
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
              Actividad en vivo
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[#000000]">
              Eventos recientes
            </h2>

            {actividadReciente.length === 0 ? (
              <p className="mt-4 text-sm text-[#4d4d4d]">
                Aún no hay actividad reciente.
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
              Detalle completo
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#000000]">
              Resumen por propiedad
            </h2>
          </div>

          {resumen.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-lg font-medium text-[#000000]">
                Aún no hay interacciones registradas.
              </p>
              <p className="mt-2 text-sm text-[#4d4d4d]">
                Cuando alguien haga clic desde una propiedad, se verá reflejado
                aquí.
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
                      Total
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
                  {resumen.map((item) => (
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
