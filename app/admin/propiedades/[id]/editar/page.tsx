import { redirect } from "next/navigation";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { getAdminPropiedadById } from "@/lib/admin/queries";
import Link from "next/link";
import EditarPropiedadForm from "./EditarPropiedadForm";

export default async function EditarPropiedadPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getAdminSessionUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { id } = params;
  const propiedad = await getAdminPropiedadById(id);

  if (!propiedad) {
    redirect("/admin/propiedades");
  }

  return (
    <main className="min-h-screen bg-[#f8f8f8] px-6 py-10">
      <div className="section-shell">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Admin · Editar propiedad</p>
            <h1 className="mt-3 text-3xl font-bold text-[#000000]">
              Editar propiedad
            </h1>
            <p className="body-base mt-3">
              Modifica los datos del listado y sus imágenes.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/listados/${propiedad.slug}`}
              target="_blank"
              className="btn-secondary"
            >
              Ver web
            </Link>

            <Link href="/admin/propiedades" className="btn-secondary">
              Volver a propiedades
            </Link>
          </div>
        </div>

        <EditarPropiedadForm propiedad={propiedad} />
      </div>
    </main>
  );
}