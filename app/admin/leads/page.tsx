import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CalendarClock, ExternalLink, Mail, Phone, UsersRound } from "lucide-react";
import { AdminActionsMenu } from "@/components/admin/AdminActionsMenu";
import { LeadsPagination } from "@/components/admin/LeadsPagination";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
  CANONICAL_LEAD_PAGE_SIZE,
  CANONICAL_LEAD_SOURCE_LABELS,
  getCanonicalLeadDirectory,
  normalizeCanonicalLeadFilters,
  resolveCanonicalLeadPropertyFilter,
  type CanonicalLeadSourceType,
} from "@/lib/admin/queries/canonical-leads";
import {
  UNIFIED_STATUS_LABELS,
  getUnifiedLeadDirectory,
  normalizeUnifiedDirectoryFilters,
  type UnifiedDirectoryFilters,
  type UnifiedDirectoryItem,
} from "@/lib/admin/queries/unified-lead-directory";

type PageSearchParams = Record<string, string | string[] | undefined>;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function SourceBadge({ source }: { source: CanonicalLeadSourceType }) {
  return <span className="inline-flex rounded-full border border-[#d9d9d9] bg-[#f8f8f8] px-2.5 py-1 text-xs font-semibold text-[#334155]">{CANONICAL_LEAD_SOURCE_LABELS[source]}</span>;
}

function statusClasses(status: string) {
  return {
    new: "border-sky-200 bg-sky-50 text-sky-800",
    active: "border-emerald-200 bg-emerald-50 text-emerald-800",
    on_hold: "border-amber-200 bg-amber-50 text-amber-900",
    closed: "border-slate-200 bg-slate-100 text-slate-700",
    do_not_contact: "border-red-200 bg-red-50 text-red-800",
    archived: "border-slate-200 bg-slate-100 text-slate-700",
  }[status] ?? "border-slate-200 bg-slate-50 text-slate-700";
}

function directoryHref(filters: UnifiedDirectoryFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.source !== "all") params.set("source", filters.source);
  if (filters.range !== "all") params.set("range", filters.range);
  if (filters.propertyId) params.set("property", filters.propertyId);
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  if (filters.showIndividuals) params.set("individuals", "1");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/admin/leads${query ? `?${query}` : ""}`;
}

function LeadResultCard({ item }: { item: UnifiedDirectoryItem }) {
  const isCase = item.entityType === "group";
  const title = isCase ? item.memberNames.join(" + ") : item.name;
  const href = isCase ? `/admin/leads/casos/${item.id}` : `/admin/leads/${item.id}`;
  return (
    <article className={`lead-directory-row ${isCase ? "is-case" : ""}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-base font-semibold text-slate-950">{title}</h3>
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(item.status)}`}>{UNIFIED_STATUS_LABELS[item.status as keyof typeof UNIFIED_STATUS_LABELS] ?? item.status}</span>
          {isCase && <span className="inline-flex rounded-full border border-[#d4af37]/30 bg-[#d4af37]/15 px-2.5 py-1 text-xs font-semibold text-[#725900]">Caso · {item.personCount} personas</span>}
        </div>
        {isCase && <p className="mt-1 break-words text-sm text-slate-600">{item.name}</p>}
        <div className="lead-directory-contact">
          {item.email && <a href={`mailto:${item.email}`}><Mail aria-hidden="true" size={15} /><span>{item.email}</span></a>}
          {item.phone && <a href={`tel:${item.phone.replace(/[^+\d]/g, "")}`}><Phone aria-hidden="true" size={15} /><span>{item.phone}</span></a>}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">{item.sourceTypes.map((source) => <SourceBadge key={source} source={source} />)}</div>
      </div>
      <div className="lead-directory-context">
        {item.contextTitle ? <p className="flex min-w-0 items-start gap-2"><Building2 aria-hidden="true" size={16} /><span className="min-w-0 break-words">{item.contextTitle}</span></p> : <p>Sin propiedad asociada</p>}
        <p>{item.sourceCount} {item.sourceCount === 1 ? "interacción" : "interacciones"}</p>
        {item.entityType === "lead" && item.sharedContact && <p className="font-semibold text-amber-800">Contacto compartido</p>}
      </div>
      <div className="lead-directory-activity">
        <p className="flex items-start gap-2"><CalendarClock aria-hidden="true" size={16} /><span><strong>Última actividad</strong><br />{formatDate(item.lastActivityAt)}</span></p>
        {item.nextFollowUpAt ? <p className="font-semibold text-amber-800">Seguimiento<br />{formatDate(item.nextFollowUpAt)}</p> : <p>Sin seguimiento programado</p>}
      </div>
      <div className="lead-directory-actions">
        <Link aria-label={`Abrir ${isCase ? "caso" : "lead"} de ${title}`} className="property-edit-action" href={href}>Ver detalles <ExternalLink aria-hidden="true" size={15} /></Link>
        <AdminActionsMenu compact label={`Acciones de ${title}`}>
          <Link role="menuitem" className="admin-actions-item" href={href}><span aria-hidden="true"><ExternalLink size={17} /></span><span>Ver detalle</span></Link>
          {item.email && <a role="menuitem" className="admin-actions-item" href={`mailto:${item.email}`}><span aria-hidden="true"><Mail size={17} /></span><span>Enviar correo</span></a>}
          {item.phone && <a role="menuitem" className="admin-actions-item" href={`tel:${item.phone.replace(/[^+\d]/g, "")}`}><span aria-hidden="true"><Phone size={17} /></span><span>Llamar</span></a>}
          <Link role="menuitem" className="admin-actions-item" href="/admin/leads/seguimientos"><span aria-hidden="true"><CalendarClock size={17} /></span><span>Ver seguimientos</span></Link>
        </AdminActionsMenu>
      </div>
    </article>
  );
}

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const user = await getAdminSessionUser();
  if (!user) redirect("/admin/login");
  const raw = await searchParams;
  const rawProperty = Array.isArray(raw.property)
    ? raw.property[0]
    : raw.property;
  const propertyResolution = await resolveCanonicalLeadPropertyFilter(
    rawProperty ?? null
  );
  const normalizedRaw = propertyResolution.property
    ? { ...raw, property: propertyResolution.property.id }
    : raw;
  const canonicalFilters = normalizeCanonicalLeadFilters(normalizedRaw);
  const filters = normalizeUnifiedDirectoryFilters(canonicalFilters, raw);
  let directory;
  let reference;
  let failed = false;
  try {
    [directory, reference] = await Promise.all([
      getUnifiedLeadDirectory(filters),
      getCanonicalLeadDirectory({ ...canonicalFilters, page: 1 }),
    ]);
  } catch {
    failed = true;
    directory = { items: [], total: 0, totalPages: 1 };
    reference = { items: [], total: 0, totalPages: 1, summary: { total: 0, newToday: 0, newLast7Days: 0, withPriorityRegistration: 0, withMultipleInteractions: 0 }, properties: [], relatedDataUnavailable: false };
  }
  const propertyOptions = [...reference.properties];
  if (
    propertyResolution.property &&
    !propertyOptions.some(
      (property) => property.id === propertyResolution.property?.id
    )
  ) {
    propertyOptions.push(propertyResolution.property);
    propertyOptions.sort((left, right) =>
      left.title.localeCompare(right.title, "es-PR")
    );
  }
  const selectedProperty =
    propertyResolution.property ??
    propertyOptions.find((property) => property.id === filters.propertyId) ??
    null;
  const hasFilters = Boolean(filters.search || filters.status !== "all" || filters.source !== "all" || filters.range !== "all" || filters.propertyId);
  return (
    <AdminPageShell>
      <AdminPageHeader
        actions={<Link className="btn-primary" href="/admin/leads/seguimientos">Centro de seguimientos</Link>}
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Leads" }]}
        description="Personas y casos compartidos en un solo directorio operacional. Las identidades canónicas permanecen separadas."
        eyebrow="Relaciones con clientes" title="Leads"
      />
      {failed ? <section className="surface-card border-l-4 border-red-500 p-6" role="alert"><h2 className="text-lg font-semibold">No se pudo cargar el directorio</h2><p className="mt-2 text-sm text-[#4d4d4d]">Intenta nuevamente. No se modificó ningún dato.</p></section> : <>
        <section aria-label="Resumen de leads" className="lead-directory-summary">
          {[["Identidades", reference.summary.total, "Personas activas"], ["Nuevos hoy", reference.summary.newToday, "Ingresos recientes"], ["Últimos 7 días", reference.summary.newLast7Days, "Personas recientes"], ["Registro prioritario", reference.summary.withPriorityRegistration, "Con esta fuente"], ["Múltiples interacciones", reference.summary.withMultipleInteractions, "Más de un formulario"]].map(([label, value, detail]) => <div key={String(label)}><p>{label}</p><strong>{value}</strong><small>{detail}</small></div>)}
        </section>
        <section className="lead-filter-bar">
          {selectedProperty && (
            <div
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3"
              role="status"
            >
              <p className="text-sm text-[#334155]">
                Filtrando por propiedad:{" "}
                <strong>{selectedProperty.title}</strong>
              </p>
              <Link
                className="text-sm font-semibold text-[#11518b] hover:underline"
                href="/admin/leads"
              >
                Quitar filtro
              </Link>
            </div>
          )}
          {propertyResolution.invalid && (
            <div
              className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-[#6b4f00]"
              role="alert"
            >
              La propiedad seleccionada no está disponible para filtrar.
            </div>
          )}
          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Vista del directorio">
            <Link className={!filters.showIndividuals ? "btn-primary" : "btn-secondary"} href={directoryHref({ ...filters, showIndividuals: false }, 1)}>Vista operativa</Link>
            <Link className={filters.showIndividuals ? "btn-primary" : "btn-secondary"} href={directoryHref({ ...filters, showIndividuals: true }, 1)}>Mostrar personas individuales</Link>
          </div>
          <form action="/admin/leads" className="grid gap-4 lg:grid-cols-6" method="get">
            {filters.showIndividuals && <input name="individuals" type="hidden" value="1" />}
            <label className="lg:col-span-2"><span className="mb-2 block text-sm font-semibold">Buscar</span><input className="input-field w-full" defaultValue={filters.search} maxLength={320} name="q" placeholder="Nombre, correo, teléfono o propiedad" type="search" /></label>
            <label><span className="mb-2 block text-sm font-semibold">Estado</span><select className="input-field w-full" defaultValue={filters.status} name="status"><option value="all">Todos</option>{Object.entries(UNIFIED_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span className="mb-2 block text-sm font-semibold">Fuente</span><select className="input-field w-full" defaultValue={filters.source} name="source"><option value="all">Todas</option>{Object.entries(CANONICAL_LEAD_SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span className="mb-2 block text-sm font-semibold">Propiedad</span><select className="input-field w-full" defaultValue={filters.propertyId ?? ""} name="property"><option value="">Todas</option>{propertyOptions.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
            <label><span className="mb-2 block text-sm font-semibold">Fecha</span><select className="input-field w-full" defaultValue={filters.range} name="range"><option value="all">Todo</option><option value="today">Hoy</option><option value="7d">7 días</option><option value="30d">30 días</option></select></label>
            <label><span className="mb-2 block text-sm font-semibold">Orden</span><select className="input-field w-full" defaultValue={filters.sort} name="sort"><option value="recent">Más recientes</option><option value="oldest">Más antiguos</option><option value="name_asc">Nombre A–Z</option><option value="name_desc">Nombre Z–A</option></select></label>
            <div className="flex flex-wrap items-end gap-3 lg:col-span-5"><button className="btn-primary" type="submit">Aplicar filtros</button><Link className="btn-secondary" href="/admin/leads">Limpiar</Link></div>
          </form>
        </section>
        <section className="lead-directory-surface">
          <header className="border-b border-[#eeeeee] px-5 py-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">{filters.showIndividuals ? "Vista de identidades" : "Vista operativa"}</p><h2 className="mt-2 text-2xl font-semibold">{filters.showIndividuals ? "Personas individuales" : "Personas y casos compartidos"}</h2></div><p className="text-sm text-[#4d4d4d]">{directory.total} resultado{directory.total === 1 ? "" : "s"} · {CANONICAL_LEAD_PAGE_SIZE} por página</p></div></header>
          {directory.items.length ? <div className="lead-directory-list">{directory.items.map((item) => <LeadResultCard item={item} key={`${item.entityType}-${item.id}`} />)}</div> : <div className="px-6 py-14 text-center"><UsersRound className="mx-auto h-8 w-8 text-[#11518b]" /><h3 className="mt-3 text-lg font-semibold">{hasFilters ? "No hay resultados" : "No hay leads todavía"}</h3><p className="mt-2 text-sm text-[#4d4d4d]">{propertyResolution.invalid ? "La propiedad seleccionada no está disponible para filtrar." : selectedProperty && propertyResolution.rawInteractionCount > 0 ? "Esta propiedad tiene actividad registrada, pero todavía no hay personas o casos identificados para mostrar." : selectedProperty ? "No hay personas o casos asociados con esta propiedad." : hasFilters ? "Ajusta o limpia los filtros." : "Las personas y casos aparecerán aquí."}</p></div>}
          <LeadsPagination currentPage={filters.page} hrefForPage={(page) => directoryHref(filters, page)} totalPages={directory.totalPages} />
        </section>
      </>}
    </AdminPageShell>
  );
}
