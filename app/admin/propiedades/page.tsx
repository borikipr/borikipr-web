import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { getAdminPropiedades } from "@/lib/admin/queries";
import PropiedadRowActions from "./PropiedadRowActions";
import StatusBadge from "@/components/admin/StatusBadge";
import AdminAlert from "@/components/admin/AdminAlert";

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
  searchParams: Promise<{ ok?: string; id?: string }>;
}) {
  const user = await getAdminSessionUser();

  if (!user) {
    redirect("/admin/login");
  }

  const propiedades = await getAdminPropiedades();
  const params = await searchParams;

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
                    <th className="px-6 py-4 font-semibold">Tipo</th>
                    <th className="px-6 py-4 font-semibold">Estado</th>
                    <th className="px-6 py-4 font-semibold">Destacado</th>
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
                        <StatusBadge variant={estadoVariant(item.estado)}>
                          {estadoLabel(item.estado)}
                        </StatusBadge>
                      </td>

                      <td className="px-6 py-5 text-sm text-[#4d4d4d]">
                        {item.destacado ? (
                          <StatusBadge variant="green">Destacado</StatusBadge>
                        ) : (
                          <StatusBadge variant="outline">Normal</StatusBadge>
                        )}
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