import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminAccessContext } from "@/lib/admin/access-context";
import { systemRoleLabels } from "@/lib/admin/access-types";
import ProfileForms from "./ProfileForms";

export default async function AdminProfilePage({ searchParams }: { searchParams: Promise<{ passwordReset?: string }> }) {
  const access = await getAdminAccessContext();
  if (!access) redirect("/admin/login");
  const admin = access.user;
  const { passwordReset } = await searchParams;
  return (
    <AdminPageShell>
      <div className="space-y-6">
        <AdminPageHeader breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Mi perfil" }]} eyebrow="Cuenta" title="Mi perfil" description="Tu identidad profesional, cuenta y seguridad en Borikí." />
        {passwordReset === "1" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">Tu contraseña se restableció correctamente.</div>}
        {!admin.email && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" role="status">Añade un email para habilitar la recuperación segura de contraseña.</div>}
        <ProfileForms displayName={admin.displayName} professionalTitle={admin.professionalTitle || ""} professionalRoles={admin.professionalRoles} professionalLicenseNumber={admin.professionalLicenseNumber || ""} profileImageUrl={admin.profileImageUrl || ""} email={admin.email || ""} username={admin.username} roleLabel={systemRoleLabels[access.systemRole]} />
      </div>
    </AdminPageShell>
  );
}
