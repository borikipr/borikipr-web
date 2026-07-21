import Link from "next/link";
import { redirect } from "next/navigation";
import { UsersRound } from "lucide-react";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
  CANONICAL_LEAD_PAGE_SIZE,
  CANONICAL_LEAD_SOURCE_LABELS,
  getCanonicalLeadDirectory,
  normalizeCanonicalLeadFilters,
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
    <article className={`min-w-0 rounded-3xl border p-5 ${isCase ? "border-blue-200 bg-blue-50/60" : "border-[#e8e8e8] bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold text-[#000000]">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-[#334155]">{isCase ? `Caso compartido · ${item.personCount} personas` : "1 persona"}</p>
        </div>
        <span className="rounded-full bg-[#11518b]/10 px-3 py-1 text-xs font-semibold text-[#11518b]">{UNIFIED_STATUS_LABELS[item.status as keyof typeof UNIFIED_STATUS_LABELS] ?? item.status}</span>
      </div>
      {isCase && <p className="mt-3 break-words text-sm text-[#4d4d4d]">{item.name}</p>}
      {(item.email || item.phone) && <div className="mt-3 grid gap-1 text-sm text-[#334155]">{item.email && <p className="break-all">{item.email}</p>}{item.phone && <p>{item.phone}</p>}</div>}
      <div className="mt-4 flex flex-wrap gap-1.5">{item.sourceTypes.map((source) => <SourceBadge key={source} source={source} />)}</div>
      {item.contextTitle && <p className="mt-4 break-words text-sm"><span className="font-semibold">Propiedad:</span> {item.contextTitle}</p>}
      <div className="mt-4 grid gap-1 text-xs text-[#6b7280]">
        <p>{item.sourceCount} interacción{item.sourceCount === 1 ? "" : "es"}</p>
        <p>Última actividad: {formatDate(item.lastActivityAt)}</p>
        {item.nextFollowUpAt && <p className="font-semibold text-[#8a5b00]">Seguimiento: {formatDate(item.nextFollowUpAt)}</p>}
        {item.sharedContact && <p className="font-semibold text-[#11518b]">Contacto compartido</p>}
      </div>
      <Link aria-label={`Ver detalles de ${title}`} className="btn-secondary mt-5 w-full px-4 py-2.5 text-center text-sm" href={href}>Ver detalles</Link>
    </article>
  );
}

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const user = await getAdminSessionUser();
  if (!user) redirect("/admin/login");
  const raw = await searchParams;
  const canonicalFilters = normalizeCanonicalLeadFilters(raw);
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
        <section aria-label="Resumen de leads" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[["Identidades", reference.summary.total, "Personas canónicas activas"], ["Nuevos hoy", reference.summary.newToday, "Creados hoy"], ["Últimos 7 días", reference.summary.newLast7Days, "Personas recientes"], ["Registro prioritario", reference.summary.withPriorityRegistration, "Con esta fuente"], ["Múltiples interacciones", reference.summary.withMultipleInteractions, "Más de un formulario"]].map(([label, value, detail]) => <div className="surface-card p-5" key={String(label)}><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">{label}</p><p className="mt-3 text-3xl font-bold">{value}</p><p className="mt-2 text-sm text-[#4d4d4d]">{detail}</p></div>)}
        </section>
        <section className="surface-card p-5">
          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Vista del directorio">
            <Link className={!filters.showIndividuals ? "btn-primary" : "btn-secondary"} href={directoryHref({ ...filters, showIndividuals: false }, 1)}>Vista operativa</Link>
            <Link className={filters.showIndividuals ? "btn-primary" : "btn-secondary"} href={directoryHref({ ...filters, showIndividuals: true }, 1)}>Mostrar personas individuales</Link>
          </div>
          <form action="/admin/leads" className="grid gap-4 lg:grid-cols-6" method="get">
            {filters.showIndividuals && <input name="individuals" type="hidden" value="1" />}
            <label className="lg:col-span-2"><span className="mb-2 block text-sm font-semibold">Buscar</span><input className="input-field w-full" defaultValue={filters.search} maxLength={320} name="q" placeholder="Nombre, correo, teléfono o propiedad" type="search" /></label>
            <label><span className="mb-2 block text-sm font-semibold">Estado</span><select className="input-field w-full" defaultValue={filters.status} name="status"><option value="all">Todos</option>{Object.entries(UNIFIED_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span className="mb-2 block text-sm font-semibold">Fuente</span><select className="input-field w-full" defaultValue={filters.source} name="source"><option value="all">Todas</option>{Object.entries(CANONICAL_LEAD_SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span className="mb-2 block text-sm font-semibold">Propiedad</span><select className="input-field w-full" defaultValue={filters.propertyId ?? ""} name="property"><option value="">Todas</option>{reference.properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
            <label><span className="mb-2 block text-sm font-semibold">Fecha</span><select className="input-field w-full" defaultValue={filters.range} name="range"><option value="all">Todo</option><option value="today">Hoy</option><option value="7d">7 días</option><option value="30d">30 días</option></select></label>
            <label><span className="mb-2 block text-sm font-semibold">Orden</span><select className="input-field w-full" defaultValue={filters.sort} name="sort"><option value="recent">Más recientes</option><option value="oldest">Más antiguos</option><option value="name_asc">Nombre A–Z</option><option value="name_desc">Nombre Z–A</option></select></label>
            <div className="flex flex-wrap items-end gap-3 lg:col-span-5"><button className="btn-primary" type="submit">Aplicar filtros</button><Link className="btn-secondary" href="/admin/leads">Limpiar</Link></div>
          </form>
        </section>
        <section className="surface-card overflow-hidden">
          <header className="border-b border-[#eeeeee] px-5 py-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">{filters.showIndividuals ? "Vista de identidades" : "Vista operativa"}</p><h2 className="mt-2 text-2xl font-semibold">{filters.showIndividuals ? "Personas individuales" : "Personas y casos compartidos"}</h2></div><p className="text-sm text-[#4d4d4d]">{directory.total} resultado{directory.total === 1 ? "" : "s"} · {CANONICAL_LEAD_PAGE_SIZE} por página</p></div></header>
          {directory.items.length ? <div className="grid min-w-0 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 md:p-5">{directory.items.map((item) => <LeadResultCard item={item} key={`${item.entityType}-${item.id}`} />)}</div> : <div className="px-6 py-14 text-center"><UsersRound className="mx-auto h-8 w-8 text-[#11518b]" /><h3 className="mt-3 text-lg font-semibold">{hasFilters ? "No hay resultados" : "No hay leads todavía"}</h3><p className="mt-2 text-sm text-[#4d4d4d]">{hasFilters ? "Ajusta o limpia los filtros." : "Las personas y casos aparecerán aquí."}</p></div>}
          {directory.totalPages > 1 && <nav aria-label="Paginación de leads" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeeee] px-5 py-4"><p className="text-sm">Página {filters.page} de {directory.totalPages}</p><div className="flex gap-2">{filters.page > 1 && <Link className="btn-secondary" href={directoryHref(filters, filters.page - 1)}>Anterior</Link>}{filters.page < directory.totalPages && <Link className="btn-secondary" href={directoryHref(filters, filters.page + 1)}>Siguiente</Link>}</div></nav>}
        </section>
      </>}
    </AdminPageShell>
  );
}
