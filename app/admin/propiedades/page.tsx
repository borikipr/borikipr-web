import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  MapPin,
  MousePointerClick,
  Plus,
  Search,
  Star,
  UsersRound,
} from "lucide-react";
import AdminAlert from "@/components/admin/AdminAlert";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import StatusBadge from "@/components/admin/StatusBadge";
import { getAdminAccessContext } from "@/lib/admin/access-context";
import { getAdminPropiedades, type AdminPropiedadRow } from "@/lib/admin/queries";
import PropiedadRowActions from "./PropiedadRowActions";

type PropertyStatus = AdminPropiedadRow["estado"];

function formatoPrecio(precio: number, tipo: "venta" | "renta") {
  if (!Number.isFinite(precio) || precio <= 0) return "Precio próximamente";
  return tipo === "renta"
    ? `$${precio.toLocaleString("en-US")}/mes`
    : `$${precio.toLocaleString("en-US")}`;
}

function estadoVariant(estado: PropertyStatus) {
  if (estado === "disponible") return "green";
  if (estado === "coming_soon" || estado === "bajo_contrato") return "amber";
  return "gray";
}

function estadoLabel(estado: PropertyStatus) {
  return {
    disponible: "Disponible",
    coming_soon: "Próximamente",
    bajo_contrato: "Bajo contrato",
    vendida: "Vendida",
    rentada: "Alquilada",
  }[estado];
}

function matchesQuery(item: AdminPropiedadRow, query: string) {
  if (!query) return true;
  const haystack = `${item.titulo} ${item.municipio} ${item.sector_comunidad ?? ""} ${item.slug}`.toLocaleLowerCase("es");
  return haystack.includes(query.toLocaleLowerCase("es"));
}

export default async function AdminPropiedadesPage({
  searchParams,
}: {
  searchParams: Promise<{
    destacado?: string;
    estado?: string;
    id?: string;
    ok?: string;
    q?: string;
    tipo?: string;
  }>;
}) {
  const access = await getAdminAccessContext();
  if (!access) redirect("/admin/login");
  const canManage = access.isAdminBaseline || access.moduleAccess.get("properties") === "manage";

  const params = await searchParams;
  const allProperties = await getAdminPropiedades();
  const query = params.q?.trim() ?? "";
  const properties = allProperties.filter((item) => {
    if (!matchesQuery(item, query)) return false;
    if (params.tipo && item.tipo_propiedad !== params.tipo) return false;
    if (params.estado && item.estado !== params.estado) return false;
    if (params.destacado === "si" && !item.destacado) return false;
    if (params.destacado === "no" && item.destacado) return false;
    return true;
  });
  const hasFilters = Boolean(query || params.tipo || params.estado || params.destacado);

  return (
    <AdminPageShell>
      <div className="property-inventory-page">
        <AdminPageHeader
          breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Propiedades" }]}
          eyebrow="Inventario"
          title="Propiedades"
          description="Consulta el inventario, actualiza su publicación y administra cada listado desde un solo lugar."
          actions={canManage ? (
            <Link href="/admin/propiedades/nueva" className="btn-primary">
              <Plus aria-hidden="true" size={17} /> Nueva propiedad
            </Link>
          ) : null}
        />

        {params.ok && (
          <AdminAlert variant="success">
            {params.ok === "created" && "Propiedad creada correctamente."}
            {params.ok === "updated" && "Cambios guardados correctamente."}
            {params.ok === "deleted" && "Propiedad eliminada correctamente."}
          </AdminAlert>
        )}

        <section className="property-inventory-overview" aria-label="Resumen del inventario">
          <div><span>Total</span><strong>{allProperties.length}</strong></div>
          <div><span>Disponibles</span><strong>{allProperties.filter((item) => item.estado === "disponible").length}</strong></div>
          <div><span>Bajo contrato</span><strong>{allProperties.filter((item) => item.estado === "bajo_contrato").length}</strong></div>
          <div><span>Destacadas</span><strong>{allProperties.filter((item) => item.destacado).length}</strong></div>
        </section>

        <form method="get" className="property-filter-bar" aria-label="Filtrar propiedades">
          <label className="property-search-field">
            <span className="sr-only">Buscar propiedad</span>
            <Search aria-hidden="true" size={18} />
            <input name="q" defaultValue={query} placeholder="Buscar por título, municipio o sector" />
          </label>
          <label>
            <span>Estado</span>
            <select name="estado" defaultValue={params.estado ?? ""}>
              <option value="">Todos</option>
              <option value="disponible">Disponible</option>
              <option value="coming_soon">Próximamente</option>
              <option value="bajo_contrato">Bajo contrato</option>
              <option value="vendida">Vendida</option>
              <option value="rentada">Alquilada</option>
            </select>
          </label>
          <label>
            <span>Tipo</span>
            <select name="tipo" defaultValue={params.tipo ?? ""}>
              <option value="">Todos</option>
              <option value="Casa">Casa</option>
              <option value="Apartamento">Apartamento</option>
              <option value="Condominio">Condominio</option>
              <option value="Terreno">Terreno</option>
              <option value="Comercial">Comercial</option>
            </select>
          </label>
          <label>
            <span>Destacada</span>
            <select name="destacado" defaultValue={params.destacado ?? ""}>
              <option value="">Todas</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </label>
          <button type="submit" className="btn-secondary">Aplicar filtros</button>
          {hasFilters && <Link href="/admin/propiedades" className="property-filter-reset">Limpiar</Link>}
        </form>

        <div className="property-inventory-heading">
          <div>
            <h2>Inventario</h2>
            <p>{properties.length} {properties.length === 1 ? "propiedad visible" : "propiedades visibles"}</p>
          </div>
        </div>

        {properties.length === 0 ? (
          <section className="property-empty-state">
            <span aria-hidden="true"><Building2 size={24} /></span>
            <h2>{hasFilters ? "No encontramos propiedades" : "No hay propiedades todavía"}</h2>
            <p>{hasFilters ? "Ajusta los filtros para ver otros resultados." : "Crea la primera propiedad para comenzar a publicar inventario."}</p>
            {hasFilters ? <Link href="/admin/propiedades" className="btn-primary">Limpiar filtros</Link> : canManage ? <Link href="/admin/propiedades/nueva" className="btn-primary">Nueva propiedad</Link> : null}
          </section>
        ) : (
          <section className="property-inventory-list" aria-label="Listado de propiedades">
            {properties.map((item) => (
              <article key={item.id} className={`property-inventory-row ${params.id === item.id ? "is-highlighted" : ""}`}>
                <div className="property-thumbnail">
                  {item.cover_image_url ? (
                    <Image src={item.cover_image_url} alt="" fill sizes="(max-width: 640px) 104px, 132px" className="object-cover" />
                  ) : (
                    <Building2 aria-hidden="true" size={26} />
                  )}
                  {item.destacado && <span><Star aria-hidden="true" size={12} fill="currentColor" /> Destacada</span>}
                </div>

                <div className="property-primary-info">
                  <div className="property-title-line">
                    <h3>{item.titulo}</h3>
                    <StatusBadge variant={estadoVariant(item.estado)}>{estadoLabel(item.estado)}</StatusBadge>
                  </div>
                  <p className="property-location"><MapPin aria-hidden="true" size={15} /> {item.sector_comunidad ? `${item.sector_comunidad}, ` : ""}{item.municipio}</p>
                  <div className="property-compact-meta">
                    <span>{item.tipo_negocio === "venta" ? "Venta" : "Alquiler"}</span>
                    <span>{item.tipo_propiedad}</span>
                    <span>{item.origen_listado === "propio" ? "Listado propio" : item.origen_listado === "co_broke" ? "Co-Broke" : "Externo"}</span>
                  </div>
                </div>

                <div className="property-price-block">
                  <span>Precio</span>
                  <strong>{formatoPrecio(Number(item.precio), item.tipo_negocio)}</strong>
                </div>

                <div className="property-activity-block">
                  <span><MousePointerClick aria-hidden="true" size={16} /><strong>{item.total_interactions}</strong> {item.total_interactions === 1 ? "interacción" : "interacciones"}</span>
                  <Link href={`/admin/leads?property=${encodeURIComponent(item.id)}`} aria-label={`Ver contactos de ${item.titulo}`}>
                    <UsersRound aria-hidden="true" size={16} /><strong>{item.total_contacts}</strong> {item.total_contacts === 1 ? "contacto" : "contactos"}
                  </Link>
                </div>

                {canManage ? <PropiedadRowActions id={item.id} slug={item.slug} titulo={item.titulo} estadoActual={item.estado} destacadoActual={item.destacado} /> : null}
              </article>
            ))}
          </section>
        )}
      </div>
    </AdminPageShell>
  );
}
