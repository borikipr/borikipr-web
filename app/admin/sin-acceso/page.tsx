import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requireAdminAccess } from "@/lib/admin/access-context";

export default async function AdminForbiddenPage() {
  await requireAdminAccess();
  return <AdminPageShell><section className="surface-card mx-auto max-w-xl p-6 text-center md:p-8" role="alert">
    <p className="eyebrow">Acceso restringido</p><h1 className="mt-2 text-2xl font-bold text-slate-950">No tienes acceso a esta sección</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">Tu cuenta no tiene el acceso necesario para ver esta información.</p>
    <Link className="btn-primary mt-5" href="/admin">Volver al Dashboard</Link>
  </section></AdminPageShell>;
}
