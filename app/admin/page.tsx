import { getAdminSessionUser } from "@/lib/admin/auth";
import { redirect } from "next/navigation";
import { logoutAdmin } from "./actions";
import Link from "next/link";

export default async function AdminPage() {
  const user = await getAdminSessionUser();

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen bg-[#f8f8f8] px-6 py-10">
      <div className="section-shell">
        <div className="surface-card p-8 md:p-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow">Panel admin</p>
              <h1 className="mt-3 text-3xl font-bold text-[#000000]">
                Bienvenido, {user}
              </h1>
              <p className="body-base mt-3">
                Desde aquí vamos a administrar propiedades, estados e imágenes.
              </p>
            </div>

            <form action={logoutAdmin}>
              <button type="submit" className="btn-secondary">
                Cerrar sesión
              </button>
            </form>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div className="surface-muted p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                Propiedades
              </p>
              <h2 className="mt-3 text-xl font-semibold text-[#000000]">
                Administrar listados
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                Crear, editar, cambiar estado y eliminar propiedades.
              </p>
              <div className="mt-5">
                <Link href="/admin/propiedades" className="btn-primary">
                  Entrar
                </Link>
              </div>
            </div>

            <div className="surface-muted p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                Imágenes
              </p>
              <h2 className="mt-3 text-xl font-semibold text-[#000000]">
                Gestionar galería
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                Mantener URLs e imágenes en orden para cada propiedad.
              </p>
            </div>

            <div className="surface-muted p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                Estado actual
              </p>
              <h2 className="mt-3 text-xl font-semibold text-[#000000]">
                Base del admin lista
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                Login, sesión y protección de rutas ya funcionando.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}