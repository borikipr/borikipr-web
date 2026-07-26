import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  PhoneCall,
} from "lucide-react";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
  CANONICAL_LEAD_SOURCE_LABELS,
  type CanonicalLeadSourceType,
} from "@/lib/admin/queries/canonical-leads";
import {
  FOLLOW_UP_BUCKET_LABELS,
  FOLLOW_UP_PAGE_SIZE,
  INACTIVITY_DAYS,
  getLeadFollowUpCenter,
  normalizeLeadFollowUpFilters,
  type FollowUpBucket,
  type LeadFollowUpFilters,
  type LeadFollowUpItem,
} from "@/lib/admin/queries/lead-follow-ups";
import { markContactedFromCenterAction, setFollowUpFromCenterAction } from "./actions";
import { updateLeadGroupAction } from "../../lead-groups/actions";

type PageSearchParams = Record<string, string | string[] | undefined>;

const STATUS_LABELS = { new: "Nuevo", active: "Activo" } as const;
const BUCKET_DESCRIPTIONS: Record<FollowUpBucket, string> = {
  overdue: "La hora acordada ya pasó.",
  today: "Programados para el resto del día de hoy.",
  upcoming: "Desde mañana hasta los próximos siete días.",
  new_without_follow_up: "Leads nuevos que todavía no tienen una fecha acordada.",
  inactive: `Sin interacción ni gestión durante ${INACTIVITY_DAYS} días o más.`,
};
const EMPTY_MESSAGES: Record<FollowUpBucket, string> = {
  overdue: "No hay seguimientos vencidos.",
  today: "No hay seguimientos pendientes para hoy.",
  upcoming: "No hay seguimientos en los próximos siete días.",
  new_without_follow_up: "Todos los leads nuevos tienen seguimiento.",
  inactive: "No hay leads sin actividad reciente.",
};
const OTHER_SECTION = "other" as const;
type FollowUpSection = FollowUpBucket | typeof OTHER_SECTION;
const SECTION_LABELS: Record<FollowUpSection, string> = {
  ...FOLLOW_UP_BUCKET_LABELS,
  other: "Sin alerta inmediata",
};
const SECTION_DESCRIPTIONS: Record<FollowUpSection, string> = {
  ...BUCKET_DESCRIPTIONS,
  other:
    "Registros activos sin una alerta inmediata o con seguimiento posterior a los próximos siete días.",
};
const SECTION_EMPTY_MESSAGES: Record<FollowUpSection, string> = {
  ...EMPTY_MESSAGES,
  other: "No hay otros registros operacionales.",
};
const FOLLOW_UP_SECTIONS = [
  ...(Object.keys(FOLLOW_UP_BUCKET_LABELS) as FollowUpBucket[]),
  OTHER_SECTION,
] as const;

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-PR", {
    timeZone: "America/Puerto_Rico",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function dateTimeLocal(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function SourceBadge({ source }: { source: CanonicalLeadSourceType }) {
  return <span className="inline-flex rounded-full border border-[#d9d9d9] bg-[#f8f8f8] px-2.5 py-1 text-xs font-semibold text-[#334155]">{CANONICAL_LEAD_SOURCE_LABELS[source]}</span>;
}

function followUpHref(
  filters: LeadFollowUpFilters,
  overrides: Partial<{
    bucket: FollowUpBucket | "all";
    page: number;
    showIndividuals: boolean;
  }> = {}
) {
  const params = new URLSearchParams();
  const showIndividuals =
    overrides.showIndividuals ?? filters.showIndividuals;
  const bucket = overrides.bucket ?? filters.bucket;
  const page = overrides.page ?? filters.page;
  if (filters.search) params.set("q", filters.search);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.source !== "all") params.set("source", filters.source);
  if (filters.propertyId) params.set("property", filters.propertyId);
  if (bucket !== "all") params.set("bucket", bucket);
  if (filters.sort !== "urgency") params.set("sort", filters.sort);
  if (showIndividuals) params.set("individuals", "1");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/admin/leads/seguimientos${query ? `?${query}` : ""}`;
}

function SummaryCard({
  bucket,
  count,
  href,
}: {
  bucket: FollowUpBucket;
  count: number;
  href: string;
}) {
  return (
    <Link className="surface-card block p-5 transition hover:-translate-y-0.5 hover:border-[#d4af37]" href={href}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4af37]">{FOLLOW_UP_BUCKET_LABELS[bucket]}</p>
      <p className="mt-3 text-3xl font-bold text-[#000000]">{count}</p>
      <p className="mt-2 text-sm text-[#4d4d4d]">Registros operacionales</p>
    </Link>
  );
}

function LeadCard({ lead }: { lead: LeadFollowUpItem }) {
  return (
    <article className="rounded-3xl border border-[#e8e8e8] bg-white p-4 md:p-5">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.65fr)_minmax(280px,0.8fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-lg font-semibold text-[#000000]">{lead.name}</h3>
            {lead.entityType === "group" && <span className="rounded-full bg-[#d4af37]/20 px-2.5 py-1 text-xs font-semibold">Caso · {lead.memberNames.length} personas</span>}
            <span className="rounded-full bg-[#11518b]/10 px-2.5 py-1 text-xs font-semibold text-[#11518b]">{STATUS_LABELS[lead.status]}</span>
          </div>
          <div className="mt-2 space-y-1 text-sm text-[#4d4d4d]">
            {lead.email && <p className="break-all">{lead.email}</p>}
            {lead.phone && <p>{lead.phone}</p>}
          </div>
          {lead.entityType === "group" && <p className="mt-2 break-words text-sm text-[#334155]">{lead.memberNames.join(" + ")}</p>}
          <div className="mt-3 flex flex-wrap gap-2">{lead.sourceTypes.map((source) => <SourceBadge key={source} source={source} />)}</div>
          <p className="mt-3 text-sm font-medium text-[#334155]">Propiedad: {lead.propertyTitle ?? "Sin propiedad asociada"}</p>
          {lead.entityType === "lead" && lead.sharedContact && (
            <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-amber-800">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />Contacto compartido con otra persona
            </p>
          )}
          {!lead.bucket && <p className="mt-3 text-sm font-semibold text-[#4d4d4d]">Sin alerta inmediata</p>}
          {lead.secondaryFlags.length > 0 && (
            <p className="mt-2 text-xs text-[#6b7280]">También requiere atención por: {lead.secondaryFlags.map((flag) => FOLLOW_UP_BUCKET_LABELS[flag].toLowerCase()).join(", ")}.</p>
          )}
        </div>

        <dl className="grid content-start gap-3 text-sm">
          <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Próximo seguimiento</dt><dd className="mt-1 font-semibold text-[#1f2937]">{formatDate(lead.nextFollowUpAt)}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Última actividad</dt><dd className="mt-1 text-[#4d4d4d]">{lead.lastActivityAt ? formatDate(lead.lastActivityAt) : "Sin actividad registrada"}</dd></div>
        </dl>

        <div className="min-w-0 space-y-3">
          <form action={lead.entityType === "group" ? updateLeadGroupAction : setFollowUpFromCenterAction} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input name={lead.entityType === "group" ? "group_id" : "lead_id"} type="hidden" value={lead.id} />
            <input name="operation_key" type="hidden" value={randomUUID()} />
            {lead.entityType === "group" && <input name="intent" type="hidden" value="follow_up" />}
            <label className="sr-only" htmlFor={`follow-up-${lead.id}`}>Próximo seguimiento para {lead.name}</label>
            <input className="input-field min-w-0 w-full" defaultValue={dateTimeLocal(lead.nextFollowUpAt)} id={`follow-up-${lead.id}`} name="next_follow_up_at" type="datetime-local" />
            <button className="btn-secondary px-4 py-2 text-sm" type="submit">Guardar</button>
          </form>
          <div className="flex flex-wrap gap-2">
            <form action={lead.entityType === "group" ? updateLeadGroupAction : markContactedFromCenterAction}>
              <input name={lead.entityType === "group" ? "group_id" : "lead_id"} type="hidden" value={lead.id} />
              <input name="operation_key" type="hidden" value={randomUUID()} />
              {lead.entityType === "group" && <input name="intent" type="hidden" value="contacted" />}
              <button className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm" type="submit"><PhoneCall aria-hidden="true" className="h-4 w-4" />Marcar contactado</button>
            </form>
            {lead.nextFollowUpAt && (
              <form action={lead.entityType === "group" ? updateLeadGroupAction : setFollowUpFromCenterAction}>
                <input name={lead.entityType === "group" ? "group_id" : "lead_id"} type="hidden" value={lead.id} />
                <input name="operation_key" type="hidden" value={randomUUID()} />
                {lead.entityType === "group" && <input name="intent" type="hidden" value="follow_up" />}
                <input name="next_follow_up_at" type="hidden" value="" />
                <button className="btn-secondary px-4 py-2 text-sm" type="submit">Limpiar seguimiento</button>
              </form>
            )}
            <Link className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm" href={lead.entityType === "group" ? `/admin/leads/casos/${lead.id}` : `/admin/leads/${lead.id}`}>{lead.entityType === "group" ? "Abrir Caso 360" : "Abrir Lead 360"}<ExternalLink aria-hidden="true" className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export default async function LeadFollowUpCenterPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const user = await getAdminSessionUser();
  if (!user) redirect("/admin/login");
  const params = await searchParams;
  const filters = normalizeLeadFollowUpFilters(params);
  const success = typeof params.ok === "string" ? params.ok.slice(0, 120) : null;
  const error = typeof params.error === "string" ? params.error.slice(0, 180) : null;
  const hasFilters = Boolean(
    filters.search || filters.status !== "all" || filters.source !== "all" ||
    filters.propertyId || filters.bucket !== "all" || filters.sort !== "urgency" ||
    filters.page > 1
  );
  let center;
  let queryFailed = false;
  try {
    center = await getLeadFollowUpCenter(filters);
  } catch {
    queryFailed = true;
    center = {
      items: [],
      summary: { overdue: 0, today: 0, upcoming: 0, new_without_follow_up: 0, inactive: 0 },
      properties: [],
      page: 1,
      pageSize: FOLLOW_UP_PAGE_SIZE,
      total: 0,
      totalPages: 1,
    };
  }
  if (!queryFailed && center.total > 0 && filters.page > center.totalPages) {
    redirect(followUpHref(filters, { page: center.totalPages }));
  }
  const grouped: Record<FollowUpSection, LeadFollowUpItem[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    new_without_follow_up: [],
    inactive: [],
    other: [],
  };
  for (const item of center.items) {
    grouped[item.bucket ?? OTHER_SECTION].push(item);
  }
  const firstVisible =
    center.total === 0 ? 0 : (center.page - 1) * center.pageSize + 1;
  const lastVisible = Math.min(center.page * center.pageSize, center.total);

  return (
    <AdminPageShell>
      <AdminPageHeader
        actions={<Link className="btn-secondary" href="/admin/leads">Volver al directorio</Link>}
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/leads", label: "Leads" }, { label: "Seguimientos" }]}
        description="Una vista diaria, sin duplicar personas, para priorizar contactos y abrir el expediente Lead 360 correspondiente."
        eyebrow="Trabajo diario"
        title="Centro de seguimientos"
      >
        <p className="mt-3 flex max-w-3xl items-start gap-2 text-sm text-[#4d4d4d]"><Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#11518b]" />Hoy se calcula en America/Puerto_Rico. Un seguimiento pasa a vencido al superar su hora programada.</p>
      </AdminPageHeader>

      <section className="surface-card p-4"><div className="flex flex-wrap gap-2" role="group" aria-label="Vista de seguimientos"><Link className={!filters.showIndividuals ? "btn-primary" : "btn-secondary"} href={followUpHref(filters, { page: 1, showIndividuals: false })}>Vista operativa</Link><Link className={filters.showIndividuals ? "btn-primary" : "btn-secondary"} href={followUpHref(filters, { page: 1, showIndividuals: true })}>Mostrar personas individuales</Link></div><p className="mt-3 text-sm text-[#4d4d4d]">La vista operativa usa el seguimiento propio del caso y oculta las tareas individuales de sus miembros para evitar trabajo duplicado.</p></section>

      {success && <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-900" role="status"><CheckCircle2 aria-hidden="true" className="h-5 w-5" />{success}</div>}
      {(error || filters.invalid) && <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-950" role="alert"><AlertCircle aria-hidden="true" className="h-5 w-5" />{error ?? "Se ignoraron filtros no válidos. Revisa tu selección."}</div>}

      <section aria-label="Resumen de seguimientos" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {(Object.keys(FOLLOW_UP_BUCKET_LABELS) as FollowUpBucket[]).map((bucket) => <SummaryCard bucket={bucket} count={center.summary[bucket]} href={followUpHref(filters, { bucket, page: 1 })} key={bucket} />)}
      </section>

      <section className="surface-card p-5">
        <form action="/admin/leads/seguimientos" className="grid gap-4 md:grid-cols-2 xl:grid-cols-6" method="get">
          {filters.showIndividuals && <input name="individuals" type="hidden" value="1" />}
          <label className="xl:col-span-2"><span className="mb-2 block text-sm font-semibold">Buscar</span><input className="input-field w-full" defaultValue={filters.search} maxLength={320} name="q" placeholder="Nombre, correo o teléfono" type="search" /></label>
          <label><span className="mb-2 block text-sm font-semibold">Estado</span><select className="input-field w-full" defaultValue={filters.status} name="status"><option value="all">Todos</option><option value="new">Nuevo</option><option value="active">Activo</option></select></label>
          <label><span className="mb-2 block text-sm font-semibold">Fuente</span><select className="input-field w-full" defaultValue={filters.source} name="source"><option value="all">Todas</option>{Object.entries(CANONICAL_LEAD_SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className="mb-2 block text-sm font-semibold">Propiedad</span><select className="input-field w-full" defaultValue={filters.propertyId ?? ""} name="property"><option value="">Todas</option>{center.properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
          <label><span className="mb-2 block text-sm font-semibold">Grupo</span><select className="input-field w-full" defaultValue={filters.bucket} name="bucket"><option value="all">Todos</option>{Object.entries(FOLLOW_UP_BUCKET_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className="mb-2 block text-sm font-semibold">Orden</span><select className="input-field w-full" defaultValue={filters.sort} name="sort"><option value="urgency">Urgencia</option><option value="newest">Más nuevos</option><option value="oldest_follow_up">Seguimiento más antiguo</option></select></label>
          <div className="flex flex-wrap items-end gap-3 xl:col-span-5"><button className="btn-primary" type="submit">Aplicar filtros</button><Link className="btn-secondary" href="/admin/leads/seguimientos">Limpiar</Link></div>
        </form>
      </section>

      {!queryFailed && (
        <section className="surface-card flex flex-wrap items-center justify-between gap-3 px-5 py-4" aria-label="Resultados de seguimientos">
          <div>
            <p className="eyebrow">{filters.showIndividuals ? "Vista de identidades" : "Vista operativa"}</p>
            <p className="mt-1 text-sm text-[#4d4d4d]">
              Mostrando {firstVisible}–{lastVisible} de {center.total} registro{center.total === 1 ? "" : "s"} operacional{center.total === 1 ? "" : "es"}
            </p>
          </div>
          <p className="text-sm font-semibold text-[#334155]">Página {center.page} de {center.totalPages}</p>
        </section>
      )}

      {queryFailed ? (
        <section className="surface-card border-l-4 border-red-500 p-6" role="alert"><h2 className="text-lg font-semibold">No se pudo cargar el centro</h2><p className="mt-2 text-sm text-[#4d4d4d]">Intenta nuevamente. No se modificó ningún dato.</p></section>
      ) : center.items.length === 0 && hasFilters ? (
        <section className="surface-card p-8 text-center"><CalendarClock aria-hidden="true" className="mx-auto h-8 w-8 text-[#11518b]" /><h2 className="mt-3 text-lg font-semibold">No hay resultados</h2><p className="mt-2 text-sm text-[#4d4d4d]">No encontramos leads que coincidan con los filtros actuales.</p></section>
      ) : (
        FOLLOW_UP_SECTIONS.map((section) => (
          <section aria-labelledby={`${section}-heading`} className="surface-card overflow-hidden" key={section}>
            <header className="border-b border-[#eeeeee] bg-[#f8f8f8] px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-semibold" id={`${section}-heading`}>{SECTION_LABELS[section]}</h2><p className="mt-1 text-sm text-[#4d4d4d]">{SECTION_DESCRIPTIONS[section]}</p></div><span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">{grouped[section].length}</span></div></header>
            <div className="grid gap-4 p-4 md:p-5">{grouped[section].length > 0 ? grouped[section].map((lead) => <LeadCard key={`${lead.entityType}-${lead.id}`} lead={lead} />) : <p className="py-4 text-sm text-[#6b7280]">{SECTION_EMPTY_MESSAGES[section]}</p>}</div>
          </section>
        ))
      )}
      {!queryFailed && center.totalPages > 1 && (
        <nav aria-label="Paginación de seguimientos" className="surface-card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm">Página {center.page} de {center.totalPages}</p>
          <div className="flex flex-wrap gap-2">
            {center.page > 1 && <Link className="btn-secondary" href={followUpHref(filters, { page: center.page - 1 })}>Anterior</Link>}
            {center.page < center.totalPages && <Link className="btn-secondary" href={followUpHref(filters, { page: center.page + 1 })}>Siguiente</Link>}
          </div>
        </nav>
      )}
    </AdminPageShell>
  );
}
