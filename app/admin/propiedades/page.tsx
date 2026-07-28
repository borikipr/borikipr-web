import Link from "next/link";
import { redirect } from "next/navigation";
import { MousePointerClick, UsersRound } from "lucide-react";
import AdminAlert from "@/components/admin/AdminAlert";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import StatusBadge from "@/components/admin/StatusBadge";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { getAdminPropiedades } from "@/lib/admin/queries";
import PropiedadRowActions from "./PropiedadRowActions";
import TipoFilter from "./TipoFilter";

function formatoPrecio(precio: number, tipo: "venta" | "renta") {
  if (!Number.isFinite(precio) || precio <= 0) {
    return "Precio próximamente";
  }

  return tipo === "renta"
    ? `$${precio.toLocaleString("en-US")}/mes`
    : `$${precio.toLocaleString("en-US")}`;
}

function estadoVariant(
  estado: "disponible" | "coming_soon" | "bajo_contrato" | "vendida" | "rentada"
) {
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

function estadoLabel(
  estado: "disponible" | "coming_soon" | "bajo_contrato" | "vendida" | "rentada"
) {
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
      return estado;
  }
}

export default async function AdminPropiedadesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; id?: string; tipo?: string }>;
}) {
  const user = await getAdminSessionUser();

  if (!user) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const propiedades = await getAdminPropiedades(params.tipo);

  return (
    <AdminPageShell>
      <div className="space-y-6">
        <AdminPageHeader
          breadcrumbs={[
            { href: "/admin", label: "Admin" },
            { label: "Propiedades" },
          ]}
          eyebrow="Admin · Propiedades"
          title="Listado de propiedades"
          description="Administra los listados disponibles en el website."
          actions={
            <>
              <TipoFilter currentTipo={params.tipo} />
              <Link href="/admin/propiedades/nueva" className="btn-primary">
                Nueva propiedad
              </Link>
            </>
          }
        />

        {params.ok && (
          <AdminAlert variant="success">
            {params.ok === "created" && "Propiedad creada correctamente."}
            {params.ok === "updated" && "Cambios guardados correctamente."}
            {params.ok === "deleted" && "Propiedad eliminada correctamente."}
          </AdminAlert>
        )}

        <div className="surface-card overflow-hidden">
          {propiedades.length === 0 ? (
            <div className="p-10 text-center md:p-16">
              <h2 className="text-2xl font-semibold text-[#000000]">
                No hay propiedades creadas
              </h2>
              <p className="mt-4 text-[#4d4d4d]">
                Cuando añadas propiedades, aparecerán aquí.
              </p>
              <div className="mt-8">
                <Link href="/admin/propiedades/nueva" className="btn-primary">
                  Crear primera propiedad
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto xl:overflow-visible">
              <table className="w-full min-w-[980px] table-fixed border-collapse xl:min-w-0">
                <colgroup>
                  <col className="w-[16%]" />
                  <col className="w-[9%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[13%]" />
                  <col className="w-[21%]" />
                </colgroup>
                <thead className="bg-[#0d1b2a] text-left text-sm text-white">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Título</th>
                    <th className="px-4 py-4 font-semibold">Municipio</th>
                    <th className="px-4 py-4 font-semibold">Precio</th>
                    <th className="px-4 py-4 font-semibold">Actividad</th>
                    <th className="px-4 py-4 font-semibold">Tipo</th>
                    <th className="px-4 py-4 font-semibold">Origen</th>
                    <th className="px-4 py-4 font-semibold">Estado</th>
                    <th className="px-4 py-4 font-semibold">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {propiedades.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-t border-[#ececec] align-top transition-all duration-700 ${
                        params.id === item.id
                          ? "bg-green-50 ring-2 ring-green-300"
                          : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-5">
                        <p className="break-words font-semibold text-[#000000]">
                          {item.titulo}
                        </p>
                        <p className="mt-1 break-words text-sm text-[#4d4d4d]">
                          /{item.slug}
                        </p>
                      </td>

                      <td className="px-4 py-5 text-sm text-[#4d4d4d]">
                        {item.sector_comunidad ? (
                          <span>
                            <span className="block font-semibold text-[#000000]">
                              {item.sector_comunidad}
                            </span>
                            <span>{item.municipio}</span>
                          </span>
                        ) : (
                          item.municipio
                        )}
                      </td>

                      <td className="px-4 py-5 text-sm text-[#4d4d4d]">
                        {formatoPrecio(Number(item.precio), item.tipo_negocio)}
                      </td>

                      <td className="px-4 py-5">
                        <div className="space-y-2">
                          <div
                            className="flex items-center gap-2 px-2"
                            title="Clics de WhatsApp y contacto registrados"
                          >
                            <MousePointerClick
                              aria-hidden="true"
                              className="h-4 w-4 shrink-0 text-[#1f9d4c]"
                            />
                            <p className="text-xs text-[#4d4d4d]">
                              <span className="font-bold text-[#000000]">
                                {item.total_interactions}
                              </span>{" "}
                              interacción
                              {item.total_interactions === 1 ? "" : "es"}
                            </p>
                          </div>
                          <Link
                            aria-label={`Ver ${item.total_contacts} ${
                              item.total_contacts === 1
                                ? "contacto"
                                : "contactos"
                            } de ${item.titulo}`}
                            href={`/admin/leads?property=${encodeURIComponent(
                              item.id
                            )}`}
                            className="flex items-center gap-2 rounded-2xl px-2 py-1.5 transition hover:bg-[#11518b]/5 focus:outline-none focus:ring-2 focus:ring-[#11518b]/30"
                          >
                            <UsersRound
                              aria-hidden="true"
                              className="h-4 w-4 shrink-0 text-[#11518b]"
                            />
                            <p className="text-xs font-semibold text-[#11518b]">
                              <span className="font-bold">
                                {item.total_contacts}
                              </span>{" "}
                              contacto
                              {item.total_contacts === 1 ? "" : "s"}
                            </p>
                          </Link>
                        </div>
                      </td>

                      <td className="px-4 py-5 text-sm text-[#4d4d4d]">
                        <div className="space-y-2">
                          <div>
                            {item.tipo_negocio === "venta" ? "Venta" : "Alquiler"}
                          </div>
                          <StatusBadge variant="outline">
                            {item.tipo_propiedad}
                          </StatusBadge>
                        </div>
                      </td>

                      <td className="px-4 py-5">
                        <StatusBadge
                          variant={
                            item.origen_listado === "propio"
                              ? "blue"
                              : item.origen_listado === "co_broke"
                                ? "gold"
                                : "outline"
                          }
                        >
                          {item.origen_listado === "propio"
                            ? "Propio"
                            : item.origen_listado === "co_broke"
                              ? "Co-Broke"
                              : "Externo"}
                        </StatusBadge>
                      </td>

                      <td className="px-4 py-5">
                        <StatusBadge variant={estadoVariant(item.estado)}>
                          {estadoLabel(item.estado)}
                        </StatusBadge>
                      </td>

                      <td className="px-4 py-5">
                        <PropiedadRowActions
                          id={item.id}
                          slug={item.slug}
                          estadoActual={item.estado}
                          destacadoActual={item.destacado}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}
