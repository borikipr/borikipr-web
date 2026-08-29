import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminAccessError, requireSuperAdmin } from "@/lib/admin/access-context";
import TeamMemberForm from "../TeamMemberForm";

export default async function NewTeamMemberPage() {
  try { await requireSuperAdmin(); } catch (error) { if (error instanceof AdminAccessError && error.code === "unauthenticated") redirect("/admin/login"); redirect("/admin"); }
  return <AdminPageShell><AdminPageHeader breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/equipo", label: "Equipo" }, { label: "Añadir miembro" }]} eyebrow="Administración interna" title="Añadir miembro" description="Crea una cuenta interna y envía una invitación segura para configurar su contraseña." /><TeamMemberForm mode="create" /></AdminPageShell>;
}
