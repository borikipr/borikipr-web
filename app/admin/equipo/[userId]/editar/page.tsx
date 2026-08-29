import { notFound, redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminAccessError, requireSuperAdmin } from "@/lib/admin/access-context";
import { getTeamDirectoryMember } from "@/lib/admin/team-directory";
import TeamMemberForm from "../../TeamMemberForm";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function EditTeamMemberPage({ params }: { params: Promise<{ userId: string }> }) {
  let access;
  try { access = await requireSuperAdmin(); } catch (error) { if (error instanceof AdminAccessError && error.code === "unauthenticated") redirect("/admin/login"); redirect("/admin"); }
  const { userId } = await params;
  if (!UUID_PATTERN.test(userId) || access.user.id === userId) notFound();
  const member = await getTeamDirectoryMember(userId);
  if (!member || member.systemRole === "super_admin") notFound();
  return <AdminPageShell><AdminPageHeader breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/equipo", label: "Equipo" }, { href: `/admin/equipo/${member.id}`, label: member.displayName }, { label: "Editar" }]} eyebrow="Cuenta interna" title={`Editar ${member.displayName}`} description="Actualiza la identidad profesional. El correo, usuario y acceso se administran por separado." /><TeamMemberForm mode="edit" targetId={member.id} member={member} /></AdminPageShell>;
}
