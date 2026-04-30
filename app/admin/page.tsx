import { getAdminSessionUser } from "@/lib/admin/auth";
import { redirect } from "next/navigation";
import { logoutAdmin } from "./actions";
import Link from "next/link";
import { getAdminDashboardStats } from "@/lib/admin/queries";

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="surface-card p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold text-[#000000]">{value}</p>
      <p className="mt-2 text-sm text-[#4d4d4d]">{description}</p>
    </div>
  );
}

function ActionCard({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="surface-card p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-xl font-semibold text-[#000000]">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
        {description}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={primaryHref} className="btn-primary">
          {primaryLabel}
        </Link>

        {secondaryHref && secondaryLabel && (
          <Link href={secondaryHref} className="btn-secondary">
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function AdminPage() {
  const user = await getAdminSessionUser();

  if (!user) {
    redirect("/admin/login");
  }

  const stats = await getAdminDashboardStats();

  return (
    <main className="px-6 py-10">
      <div className="section-shell space-y-8">
        <div className="surface-card p-8 md:p-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow">Dashboard</p>
              <h1 className="mt-3 text-3xl font-bold text-[#000000]">
                Bienvenido, {user}
              </h1>
              <p className="body-base mt-3">
                Desde aquí puedes administrar contenido clave del website con una
                vista clara y profesional.
              </p>
            </div>

            <form action={logoutAdmin}>
              <button type="submit" className="btn-secondary">
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total"
            value={stats.total}
            description="Propiedades registradas"
          />
          <StatCard
            label="Disponibles"
            value={stats.disponibles}
            description="Listas para promoción"
          />
          <StatCard
            label="Bajo contrato"
            value={stats.bajoContrato}
            description="En proceso de cierre"
          />
          <StatCard
            label="Cerradas"
            value={stats.cerradas}
            description="Vendidas o alquiladas"
          />
          <StatCard
            label="Destacadas"
            value={stats.destacadas}
            description="Con prioridad visual"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            eyebrow="Propiedades"
            title="Administrar listados"
            description="Crear, editar, cambiar estado y eliminar propiedades del website."
            primaryHref="/admin/propiedades"
            primaryLabel="Ver propiedades"
            secondaryHref="/admin/propiedades/nueva"
            secondaryLabel="Nueva propiedad"
          />

          <ActionCard
            eyebrow="Testimonios"
            title="Gestionar confianza"
            description="Crear, editar y organizar testimonios de compradores y vendedores."
            primaryHref="/admin/testimonios"
            primaryLabel="Ver testimonios"
            secondaryHref="/admin/testimonios/nuevo"
            secondaryLabel="Nuevo testimonio"
          />

          <ActionCard
            eyebrow="Leads"
            title="Ver interacciones"
            description="Consulta qué propiedades están generando más interés a través de clics en WhatsApp."
            primaryHref="/admin/leads"
            primaryLabel="Ver leads"
          />

          <ActionCard
            eyebrow="Website"
            title="Vista pública"
            description="Revisa rápidamente cómo se ve el contenido publicado para los clientes."
            primaryHref="/"
            primaryLabel="Ir al home"
            secondaryHref="/listados"
            secondaryLabel="Ver listados"
          />
        </div>
      </div>
    </main>
  );
}