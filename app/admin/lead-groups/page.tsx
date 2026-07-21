import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
  LEAD_GROUP_PAGE_SIZE,
  LEAD_GROUP_ROLE_LABELS,
  LEAD_GROUP_STATUS_LABELS,
  getLeadGroupDirectory,
  normalizeLeadGroupFilters,
} from "@/lib/admin/queries/lead-groups";

type SearchParams = Record<string, string | string[] | undefined>;

function formatDate(value: string | null) {
  if (!value) return "Sin seguimiento";
  return new Intl.DateTimeFormat("es-PR", {
    timeZone: "America/Puerto_Rico", dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));
}

export default async function LeadGroupsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getAdminSessionUser();
  if (!user) redirect("/admin/login");
  const params = await searchParams;
  const filters = normalizeLeadGroupFilters(params);
  const directory = await getLeadGroupDirectory(filters);
  const result = typeof params.group_result === "string" ? params.group_result : null;
  const href = (page: number) => {
    const query = new URLSearchParams();
    if (filters.search) query.set("q", filters.search);
    if (filters.status !== "all") query.set("status", filters.status);
    if (filters.propertyId) query.set("property", filters.propertyId);
    if (page > 1) query.set("page", String(page));
    const value = query.toString();
    return value ? `/admin/lead-groups?${value}` : "/admin/lead-groups";
  };

  return (
    <AdminPageShell>
      <AdminPageHeader
        actions={<><Link className="btn-primary" href="/admin/leads">Directorio operacional</Link><Link className="btn-secondary" href="/admin/leads/seguimientos">Seguimientos</Link></>}
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Casos" }]}
        description="Casos operacionales que reúnen personas relacionadas sin alterar ni fusionar sus identidades canónicas."
        eyebrow="Trabajo con clientes"
        title="Casos compartidos"
      />

      {result === "rolled_back" && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-900" role="alert">No se pudo crear el caso. Ningún cambio fue aplicado.</div>}

      <section className="surface-card p-5">
        <form action="/admin/lead-groups" className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" method="get">
          <label className="xl:col-span-2"><span className="mb-2 block text-sm font-semibold">Buscar</span><input className="input-field w-full" defaultValue={filters.search} name="q" placeholder="Caso, persona, contacto o propiedad" type="search" /></label>
          <label><span className="mb-2 block text-sm font-semibold">Estado</span><select className="input-field w-full" defaultValue={filters.status} name="status"><option value="all">Todos</option>{Object.entries(LEAD_GROUP_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className="mb-2 block text-sm font-semibold">Propiedad</span><select className="input-field w-full" defaultValue={filters.propertyId ?? ""} name="property"><option value="">Todas</option>{directory.properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
          <div className="flex flex-wrap items-end gap-3"><button className="btn-primary" type="submit">Aplicar</button><Link className="btn-secondary" href="/admin/lead-groups">Limpiar</Link></div>
        </form>
      </section>

      <section className="surface-card overflow-hidden">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#eeeeee] px-5 py-5">
          <div><p className="eyebrow">Casos activos</p><h2 className="mt-2 text-2xl font-semibold">Trabajo operacional</h2></div>
          <p className="text-sm text-[#4d4d4d]">{directory.total} caso{directory.total === 1 ? "" : "s"} · {LEAD_GROUP_PAGE_SIZE} por página</p>
        </header>
        {directory.items.length === 0 ? (
          <div className="px-6 py-14 text-center"><h3 className="text-lg font-semibold">No hay casos que coincidan</h3><p className="mt-2 text-sm text-[#4d4d4d]">Los casos se crean manualmente desde Lead 360 cuando existen personas relacionadas.</p></div>
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 md:p-5">
            {directory.items.map((group) => (
              <article className="min-w-0 rounded-3xl border border-[#e8e8e8] bg-white p-5" key={group.id}>
                <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 break-words text-lg font-semibold">{group.title}</h3><span className="rounded-full bg-[#11518b]/10 px-3 py-1 text-xs font-semibold text-[#11518b]">{LEAD_GROUP_STATUS_LABELS[group.status]}</span></div>
                {group.propertyTitle && <p className="mt-3 text-sm font-semibold text-[#334155]">Propiedad: {group.propertyTitle}</p>}
                <ul className="mt-4 grid gap-2">{group.members.map((member) => <li className="rounded-2xl bg-[#f8f8f8] p-3" key={member.id}><p className="break-words text-sm font-semibold">{member.name}{member.isPrimaryContact ? " · contacto principal" : ""}</p><p className="mt-1 text-xs text-[#6b7280]">{LEAD_GROUP_ROLE_LABELS[member.role]}</p></li>)}</ul>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-[#6b7280]">Interacciones</dt><dd className="mt-1 font-semibold">{group.interactionCount}</dd></div><div><dt className="text-xs text-[#6b7280]">Seguimiento</dt><dd className="mt-1 font-semibold">{formatDate(group.nextFollowUpAt)}</dd></div><div className="col-span-2"><dt className="text-xs text-[#6b7280]">Última actividad</dt><dd className="mt-1">{formatDate(group.lastActivityAt)}</dd></div></dl>
                <Link className="btn-primary mt-5 w-full text-center" href={`/admin/lead-groups/${group.id}`}>Abrir Caso 360</Link>
              </article>
            ))}
          </div>
        )}
        {directory.totalPages > 1 && <nav aria-label="Paginación de casos" className="flex items-center justify-between gap-3 border-t border-[#eeeeee] px-5 py-4"><p className="text-sm">Página {filters.page} de {directory.totalPages}</p><div className="flex gap-2">{filters.page > 1 && <Link className="btn-secondary" href={href(filters.page - 1)}>Anterior</Link>}{filters.page < directory.totalPages && <Link className="btn-secondary" href={href(filters.page + 1)}>Siguiente</Link>}</div></nav>}
      </section>
    </AdminPageShell>
  );
}
