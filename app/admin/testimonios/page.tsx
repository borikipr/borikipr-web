import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminAlert from "@/components/admin/AdminAlert";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import StatusBadge from "@/components/admin/StatusBadge";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { getAdminTestimonios } from "@/lib/admin/testimonios-queries";
import TestimonioRowActions from "./TestimonioRowActions";
import TestimonioTipoFilter from "./TestimonioTipoFilter";

export default async function AdminTestimoniosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; id?: string; tipo?: string }>;
}) {
  const user = await getAdminSessionUser();

  if (!user) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const testimonios = await getAdminTestimonios(params.tipo);

  return (
    <AdminPageShell>
      <div className="space-y-6">
        <AdminPageHeader
          breadcrumbs={[
            { href: "/admin", label: "Admin" },
            { label: "Testimonios" },
          ]}
          eyebrow="Admin · Testimonios"
          title="Listado de testimonios"
          description="Administra los testimonios que fortalecen la confianza del website."
          actions={
            <>
              <TestimonioTipoFilter currentTipo={params.tipo} />
              <Link href="/admin/testimonios/nuevo" className="btn-primary">
                Nuevo testimonio
              </Link>
            </>
          }
        />

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
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 overflow-hidden rounded-full border border-[#e8e8e8] bg-[#f8f8f8]">
                            {item.foto_url ? (
                              <Image
                                src={item.foto_url}
                                alt={item.nombre}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-[#11518b] text-xs font-bold text-white">
                                {item.nombre.charAt(0)}
                              </div>
                            )}
                          </div>
                          <p className="font-semibold text-[#000000]">
                            {item.nombre}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <StatusBadge
                          variant={item.tipo === "comprador" ? "blue" : "gold"}
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
