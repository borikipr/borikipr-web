import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
  CANONICAL_LEAD_PAGE_SIZE,
  CANONICAL_LEAD_SOURCE_LABELS,
  canonicalLeadDirectoryHref,
  getCanonicalLeadDirectory,
  normalizeCanonicalLeadFilters,
  type CanonicalLeadFilters,
  type CanonicalLeadSourceType,
} from "@/lib/admin/queries/canonical-leads";

type PageSearchParams = Record<string, string | string[] | undefined>;

const STATUS_LABELS: Record<string, string> = {
  new: "Nuevo",
  active: "Activo",
  do_not_contact: "No contactar",
  archived: "Archivado",
  merged: "Fusionado",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">{label}</p>
      <p className="mt-3 text-3xl font-bold text-[#000000]">{value}</p>
      <p className="mt-2 text-sm text-[#4d4d4d]">{detail}</p>
    </div>
  );
}

function SourceBadge({ source }: { source: CanonicalLeadSourceType }) {
  return (
    <span className="inline-flex rounded-full border border-[#d9d9d9] bg-[#f8f8f8] px-2.5 py-1 text-xs font-semibold text-[#334155]">
      {CANONICAL_LEAD_SOURCE_LABELS[source]}
    </span>
  );
}

function Pagination({ filters, totalPages }: { filters: CanonicalLeadFilters; totalPages: number }) {
  if (totalPages <= 1) return null;
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === totalPages || Math.abs(page - filters.page) <= 1
  );

  return (
    <nav aria-label="Paginación de leads" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeeee] px-5 py-4">
      <p className="text-sm text-[#4d4d4d]">Página {filters.page} de {totalPages}</p>
      <div className="flex flex-wrap gap-2">
        {filters.page > 1 && (
          <Link className="btn-secondary px-3 py-2 text-sm" href={canonicalLeadDirectoryHref(filters, { page: filters.page - 1 })}>
            Anterior
          </Link>
        )}
        {pageNumbers.map((page, index) => {
          const previous = pageNumbers[index - 1];
          return (
            <span className="contents" key={page}>
              {previous && page - previous > 1 && <span className="px-1 py-2 text-[#6b7280]">…</span>}
              <Link
                aria-current={page === filters.page ? "page" : undefined}
                className={page === filters.page ? "rounded-lg bg-[#11518b] px-3 py-2 text-sm font-semibold text-white" : "rounded-lg border border-[#d9d9d9] bg-white px-3 py-2 text-sm font-semibold text-[#334155]"}
                href={canonicalLeadDirectoryHref(filters, { page })}
              >
                {page}
              </Link>
            </span>
          );
        })}
        {filters.page < totalPages && (
          <Link className="btn-secondary px-3 py-2 text-sm" href={canonicalLeadDirectoryHref(filters, { page: filters.page + 1 })}>
            Siguiente
          </Link>
        )}
      </div>
    </nav>
  );
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const user = await getAdminSessionUser();
  if (!user) redirect("/admin/login");

  const filters = normalizeCanonicalLeadFilters(await searchParams);
  let directory;
  let queryFailed = false;

  try {
    directory = await getCanonicalLeadDirectory(filters);
  } catch {
    queryFailed = true;
    directory = {
      items: [],
      total: 0,
      totalPages: 1,
      summary: { total: 0, newToday: 0, newLast7Days: 0, withPriorityRegistration: 0, withMultipleInteractions: 0 },
      properties: [],
      relatedDataUnavailable: false,
    };
  }

  const hasFilters = Boolean(
    filters.search || filters.source !== "all" || filters.range !== "all" || filters.propertyId
  );

  return (
    <AdminPageShell>
      <AdminPageHeader
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Leads" }]}
        description="Directorio canónico de personas e interacciones persistidas en Neon. Cada persona aparece una sola vez, aunque haya enviado varios formularios."
        eyebrow="Relaciones con clientes"
        title="Leads"
      />

      {queryFailed ? (
        <section className="surface-card border-l-4 border-red-500 p-6" role="alert">
          <h2 className="text-lg font-semibold text-[#000000]">No se pudo cargar el directorio</h2>
          <p className="mt-2 text-sm text-[#4d4d4d]">Intenta nuevamente. No se modificó ningún dato.</p>
        </section>
      ) : (
        <>
          <section aria-label="Resumen de leads" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Total de leads" value={directory.summary.total} detail="Identidades canónicas sin fusionar" />
            <StatCard label="Nuevos hoy" value={directory.summary.newToday} detail="Creados desde el inicio del día" />
            <StatCard label="Nuevos últimos 7 días" value={directory.summary.newLast7Days} detail="Identidades creadas recientemente" />
            <StatCard label="Con registro prioritario" value={directory.summary.withPriorityRegistration} detail="Personas vinculadas a ese formulario" />
            <StatCard label="Con múltiples interacciones" value={directory.summary.withMultipleInteractions} detail="Más de una fuente persistida" />
          </section>

          <section className="surface-card p-5">
            <form action="/admin/leads" className="grid gap-4 lg:grid-cols-6" method="get">
              <label className="lg:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-[#000000]">Buscar</span>
                <input className="input-field w-full" defaultValue={filters.search} maxLength={320} name="q" placeholder="Nombre, correo o teléfono" type="search" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-[#000000]">Fuente</span>
                <select className="input-field w-full" defaultValue={filters.source} name="source">
                  <option value="all">Todas</option>
                  {Object.entries(CANONICAL_LEAD_SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-[#000000]">Fecha</span>
                <select className="input-field w-full" defaultValue={filters.range} name="range">
                  <option value="today">Hoy</option><option value="7d">7 días</option><option value="30d">30 días</option><option value="all">Todo</option>
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-[#000000]">Propiedad</span>
                <select className="input-field w-full" defaultValue={filters.propertyId ?? ""} name="property">
                  <option value="">Todas</option>
                  {directory.properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-[#000000]">Orden</span>
                <select className="input-field w-full" defaultValue={filters.sort} name="sort">
                  <option value="recent">Más recientes</option><option value="oldest">Más antiguos</option><option value="name_asc">Nombre A–Z</option><option value="name_desc">Nombre Z–A</option>
                </select>
              </label>
              <div className="flex flex-wrap items-end gap-3 lg:col-span-6">
                <button className="btn-primary" type="submit">Aplicar filtros</button>
                <Link className="btn-secondary" href="/admin/leads">Limpiar</Link>
              </div>
            </form>
          </section>

          {directory.relatedDataUnavailable && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900" role="status">
              Algunas identidades no tienen una fuente relacionada disponible. La identidad canónica se conserva en el directorio.
            </div>
          )}

          <section className="surface-card overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-[#eeeeee] px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="eyebrow">Directorio canónico</p><h2 className="mt-2 text-2xl font-semibold text-[#000000]">Personas e interacciones</h2></div>
              <p className="text-sm text-[#4d4d4d]">{directory.total} resultado{directory.total === 1 ? "" : "s"} · {CANONICAL_LEAD_PAGE_SIZE} por página</p>
            </div>

            {directory.items.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <h3 className="text-lg font-semibold text-[#000000]">{directory.summary.total === 0 ? "No hay leads canónicos todavía" : "No hay leads que coincidan con los filtros"}</h3>
                <p className="mt-2 text-sm text-[#4d4d4d]">{hasFilters ? "Ajusta o limpia los filtros para ampliar los resultados." : "Las personas aparecerán aquí cuando exista una identidad canónica persistida."}</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-[#eeeeee] md:hidden">
                  {directory.items.map((lead) => (
                    <article className="p-5" key={lead.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words font-semibold text-[#000000]">{lead.name}</h3>
                          <p className="mt-1 text-xs text-[#6b7280]">Creado {formatDate(lead.createdAt)}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#11518b]/10 px-3 py-1 text-xs font-semibold text-[#11518b]">{STATUS_LABELS[lead.status] ?? lead.status}</span>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-[#334155]">
                        {lead.email && <p className="break-all">{lead.email}</p>}
                        {lead.phone && <p>{lead.phone}</p>}
                        <div>
                          <p className="font-semibold text-[#000000]">{lead.primarySource ? CANONICAL_LEAD_SOURCE_LABELS[lead.primarySource] : "Sin fuente vinculada"}</p>
                          <p className="mt-1 text-xs text-[#6b7280]">{lead.sourceCount} interacción{lead.sourceCount === 1 ? "" : "es"}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">{lead.sourceTypes.map((source) => <SourceBadge key={source} source={source} />)}</div>
                        </div>
                        {(lead.contextTitle || lead.contextDetail) && <div><p className="font-medium text-[#000000]">{lead.contextTitle ?? lead.contextDetail}</p>{lead.contextTitle && lead.contextDetail && <p className="mt-1 text-xs text-[#6b7280]">{lead.contextDetail}</p>}</div>}
                        <p className="text-xs text-[#6b7280]">Última actividad {formatDate(lead.lastActivityAt)}</p>
                      </div>
                      <Link aria-label={`Ver detalles de ${lead.name}`} className="btn-secondary mt-4 w-full px-4 py-2.5 text-sm" href={`/admin/leads/${lead.id}`}>Ver detalles</Link>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full">
                  <thead className="bg-[#fafafa]"><tr className="text-left">
                    <th className="px-5 py-4 text-sm font-semibold">Persona</th><th className="px-5 py-4 text-sm font-semibold">Contacto</th><th className="px-5 py-4 text-sm font-semibold">Fuentes</th><th className="px-5 py-4 text-sm font-semibold">Contexto</th><th className="px-5 py-4 text-sm font-semibold">Actividad</th><th className="px-5 py-4 text-sm font-semibold">Estado</th><th className="px-5 py-4 text-sm font-semibold">Acción</th>
                  </tr></thead>
                  <tbody>
                    {directory.items.map((lead) => (
                      <tr className="border-t border-[#eeeeee] align-top" key={lead.id}>
                        <td className="px-5 py-5"><p className="font-semibold text-[#000000]">{lead.name}</p><p className="mt-1 text-xs text-[#6b7280]">Creado {formatDate(lead.createdAt)}</p></td>
                        <td className="px-5 py-5 text-sm text-[#334155]"><p>{lead.email ?? "Sin correo"}</p><p className="mt-1">{lead.phone ?? "Sin teléfono"}</p></td>
                        <td className="px-5 py-5"><p className="text-sm font-semibold text-[#000000]">{lead.primarySource ? CANONICAL_LEAD_SOURCE_LABELS[lead.primarySource] : "Sin fuente vinculada"}</p><p className="mt-1 text-xs text-[#6b7280]">{lead.sourceCount} interacción{lead.sourceCount === 1 ? "" : "es"}</p><div className="mt-2 flex max-w-md flex-wrap gap-1.5">{lead.sourceTypes.map((source) => <SourceBadge key={source} source={source} />)}</div></td>
                        <td className="px-5 py-5 text-sm text-[#334155]"><p className="font-medium text-[#000000]">{lead.contextTitle ?? lead.contextDetail ?? "Sin contexto"}</p>{lead.contextTitle && lead.contextDetail && <p className="mt-1 text-xs text-[#6b7280]">{lead.contextDetail}</p>}</td>
                        <td className="px-5 py-5 text-sm text-[#334155]">{formatDate(lead.lastActivityAt)}</td>
                        <td className="px-5 py-5"><span className="inline-flex rounded-full bg-[#11518b]/10 px-3 py-1 text-xs font-semibold text-[#11518b]">{STATUS_LABELS[lead.status] ?? lead.status}</span></td>
                        <td className="px-5 py-5"><Link aria-label={`Ver detalles de ${lead.name}`} className="inline-flex rounded-lg border border-[#11518b] px-3 py-2 text-sm font-semibold text-[#11518b] hover:bg-[#11518b] hover:text-white" href={`/admin/leads/${lead.id}`}>Ver detalles</Link></td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </>
            )}
            <Pagination filters={filters} totalPages={directory.totalPages} />
          </section>
        </>
      )}
    </AdminPageShell>
  );
}
