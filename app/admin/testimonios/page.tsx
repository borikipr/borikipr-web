import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { getAdminTestimonios } from "@/lib/admin/testimonios-queries";
import TestimonioRowActions from "./TestimonioRowActions";
import StatusBadge from "@/components/admin/StatusBadge";
import AdminAlert from "@/components/admin/AdminAlert";

export default async function AdminTestimoniosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; id?: string }>;
}) {
  const user = await getAdminSessionUser();

  if (!user) {
    redirect("/admin/login");
  }

  const testimonios = await getAdminTestimonios();
  const params = await searchParams;

  return (
    <main className="px-6 py-10">
      <div className="section-shell space-y-6">
        <div className="surface-card p-8 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Admin · Testimonios</p>
              <h1 className="mt-3 text-3xl font-bold text-[#000000]">
                Listado de testimonios
              </h1>
              <p className="body-base mt-3">
                Administra los testimonios que fortalecen la confianza del website.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className="btn-secondary">
                Volver al panel
              </Link>

              <Link href="/admin/testimonios/nuevo" className="btn-primary">
                Nuevo testimonio
              </Link>
            </div>
          </div>
        </div>

        {params.ok && (
          <AdminAlert variant="success">
            {params.ok === "created" && "Testimonio creado correctamente."}
            {params.ok === "updated" && "Cambios guardados correctamente."}
            {params.ok === "deleted" && "Testimonio eliminado correctamente."}
          </AdminAlert>
        )}

        <div className="surface-card overflow-hidden">
          {testimonios.length === 0 ? (
            <div className="p-10 text-center md:p-16">
              <h2 className="text-2xl font-semibold text-[#000000]">
                No hay testimonios creados
              </h2>
              <p className="mt-4 text-[#4d4d4d]">
                Cuando añadas testimonios, aparecerán aquí.
              </p>
              <div className="mt-8">
                <Link href="/admin/testimonios/nuevo" className="btn-primary">
                  Crear primer testimonio
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-[#0d1b2a] text-left text-sm text-white">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Nombre</th>
                    <th className="px-6 py-4 font-semibold">Tipo</th>
                    <th className="px-6 py-4 font-semibold">Ubicación</th>
                    <th className="px-6 py-4 font-semibold">Texto</th>
                    <th className="px-6 py-4 font-semibold">Activo</th>
                    <th className="px-6 py-4 font-semibold">Destacado</th>
                    <th className="px-6 py-4 font-semibold">Orden</th>
                    <th className="px-6 py-4 font-semibold">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {testimonios.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-t border-[#ececec] align-top transition-all duration-700 ${
                        params.id === item.id
                          ? "bg-green-50 ring-2 ring-green-300"
                          : "bg-white"
                      }`}
                    >
                      <td className="px-6 py-5">
                        <p className="font-semibold text-[#000000]">
                          {item.nombre}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <StatusBadge
                          variant={
                            item.tipo === "comprador" ? "blue" : "gold"
                          }
                        >
                          {item.tipo === "comprador" ? "Comprador" : "Vendedor"}
                        </StatusBadge>
                      </td>

                      <td className="px-6 py-5 text-sm text-[#4d4d4d]">
                        {item.ubicacion || "—"}
                      </td>

                      <td className="max-w-[420px] px-6 py-5 text-sm text-[#4d4d4d]">
                        <p className="line-clamp-4">{item.texto}</p>
                      </td>

                      <td className="px-6 py-5">
                        {item.activo ? (
                          <StatusBadge variant="green">Activo</StatusBadge>
                        ) : (
                          <StatusBadge variant="gray">Inactivo</StatusBadge>
                        )}
                      </td>

                      <td className="px-6 py-5">
                        {item.destacado ? (
                          <StatusBadge variant="green">Destacado</StatusBadge>
                        ) : (
                          <StatusBadge variant="outline">Normal</StatusBadge>
                        )}
                      </td>

                      <td className="px-6 py-5 text-sm text-[#4d4d4d]">
                        {item.orden}
                      </td>

                      <td className="px-6 py-5">
                        <div className="mb-3 flex flex-wrap gap-3">
                          <Link
                            href={`/admin/testimonios/${item.id}/editar`}
                            className="text-sm font-medium text-[#11518b] hover:text-[#0d406d]"
                          >
                            Editar
                          </Link>
                        </div>

                        <TestimonioRowActions
                          id={item.id}
                          activoActual={item.activo}
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