import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { getAdminDashboardStats } from "@/lib/admin/queries";
import { logoutAdmin } from "./actions";

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
    <div className="surface-card flex h-full flex-col p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-xl font-semibold text-[#000000]">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
        {description}
      </p>
      <div className="mt-auto flex flex-wrap gap-3 pt-5">
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
    <AdminPageShell>
      <div className="space-y-8">
        <AdminPageHeader
          breadcrumbs={[{ label: "Admin" }]}
          eyebrow="Dashboard"
          title={`Bienvenido, ${user}`}
          description="Desde aquí puedes administrar contenido clave del website con una vista clara y profesional."
          actions={
            <form action={logoutAdmin}>
              <button type="submit" className="btn-secondary">
                Cerrar sesión
              </button>
            </form>
          }
        />

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

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
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
            title="Gestionar leads"
            description="Revisa contactos directos, registros prioritarios, perfiles para visita e interés digital."
            primaryHref="/admin/leads"
            primaryLabel="Ver leads"
          />

          <ActionCard
            eyebrow="Analytics"
            title="Ver estadísticas"
            description="Consulta tráfico, páginas vistas, eventos, dispositivos y señales de comportamiento del website."
            primaryHref="/admin/analytics"
            primaryLabel="Ver analytics"
          />

          <ActionCard
            eyebrow="Sitio web"
            title="Vista pública"
            description="Revisa rápidamente cómo se ve el contenido publicado para los clientes."
            primaryHref="/"
            primaryLabel="Ir al home"
            secondaryHref="/listados"
            secondaryLabel="Ver listados"
          />
        </div>
      </div>
    </AdminPageShell>
  );
}
