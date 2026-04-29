import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { getAdminPropiedades } from "@/lib/admin/queries";
import PropiedadRowActions from "./PropiedadRowActions";
import StatusBadge from "@/components/admin/StatusBadge";
import AdminAlert from "@/components/admin/AdminAlert";
import TipoFilter from "./TipoFilter";

function formatoPrecio(precio: number, tipo: "venta" | "renta") {
  return tipo === "renta"
    ? `$${precio.toLocaleString("en-US")}/mes`
    : `$${precio.toLocaleString("en-US")}`;
}

function estadoVariant(
  estado: "disponible" | "bajo_contrato" | "vendida" | "rentada"
) {
  switch (estado) {
    case "disponible":
      return "blue";
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
  estado: "disponible" | "bajo_contrato" | "vendida" | "rentada"
) {
  switch (estado) {
    case "disponible":
      return "Disponible";
    case "bajo_contrato":
      return "Bajo contrato";
    case "vendida":
      return "Vendida";
    case "rentada":
      return "Rentada";
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
    <main className="px-6 py-10">
      <div className="section-shell space-y-6">
        <div className="surface-card p-8 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Admin · Propiedades</p>
              <h1 className="mt-3 text-3xl font-bold text-[#000000]">
                Listado de propiedades
              </h1>
              <p className="body-base mt-3">
                Administra los listados disponibles en el website.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <TipoFilter currentTipo={params.tipo} />

              <div className="flex flex-wrap gap-3">
                <Link href="/admin" className="btn-secondary">
                  Volver al panel
                </Link>

                <Link href="/admin/propiedades/nueva" className="btn-primary">
                  Nueva propiedad
                </Link>
              </div>
            </div>
          </div>
        </div>

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
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-[#0d1b2a] text-left text-sm text-white">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Título</th>
                    <th className="px-6 py-4 font-semibold">Municipio</th>
                    <th className="px-6 py-4 font-semibold">Precio</th>
                    <th className="px-6 py-4 font-semibold">Interés</th>
                    <th className="px-6 py-4 font-semibold">Tipo</th>
                    <th className="px-6 py-4 font-semibold">Origen</th>
                    <th className="px-6 py-4 font-semibold">Estado</th>
                    <th className="px-6 py-4 font-semibold">Acciones</th>
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
                      <td className="px-6 py-5">
                        <div>
                          <p className="font-semibold text-[#000000]">
                            {item.titulo}
                          </p>
                          <p className="mt-1 text-sm text-[#4d4d4d]">
                            /{item.slug}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-sm text-[#4d4d4d]">
                        {item.municipio}
                      </td>

                      <td className="px-6 py-5 text-sm text-[#4d4d4d]">
                        {formatoPrecio(Number(item.precio), item.tipo_negocio)}
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]/10 text-[#1f9d4c]">
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.554 4.189 1.602 6.04L0 24l6.117-1.605a11.803 11.803 0 005.925 1.598h.005c6.632 0 12.032-5.4 12.035-12.034a11.762 11.762 0 00-3.417-8.444" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-[#000000]">
                              {item.total_leads}
                            </p>
                            <p className="text-xs text-[#4d4d4d]">interacciones</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-sm text-[#4d4d4d]">
                        <div className="space-y-2">
                          <div>
                            {item.tipo_negocio === "venta" ? "Venta" : "Renta"}
                          </div>
                          <StatusBadge variant="outline">
                            {item.tipo_propiedad}
                          </StatusBadge>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <StatusBadge variant={item.origen_listado === "propio" ? "blue" : item.origen_listado === "co_broke" ? "gold" : "gray"}>
                          {item.origen_listado === "propio" ? "Propio" : item.origen_listado === "co_broke" ? "Co-Broke" : "Externo"}
                        </StatusBadge>
                      </td>

                      <td className="px-6 py-5">
                        <StatusBadge variant={estadoVariant(item.estado)}>
                          {estadoLabel(item.estado)}
                        </StatusBadge>
                      </td>

                      <td className="px-6 py-5">
                        <div className="mb-3 flex flex-wrap gap-3">
                          <Link
                            href={`/listados/${item.slug}`}
                            target="_blank"
                            className="text-sm font-medium text-[#11518b] hover:text-[#0d406d]"
                          >
                            Ver web
                          </Link>

                          <Link
                            href={`/admin/propiedades/${item.id}/editar`}
                            className="text-sm font-medium text-[#11518b] hover:text-[#0d406d]"
                          >
                            Editar
                          </Link>
                        </div>

                        <PropiedadRowActions
                          id={item.id}
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
    </main>
  );
}