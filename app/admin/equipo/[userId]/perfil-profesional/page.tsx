import { notFound, redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { AccountLifecycleBadge } from "@/components/admin/TeamMemberMeta";
import TeamMemberAvatar from "@/components/admin/TeamMemberAvatar";
import { AdminAccessError, requireSuperAdmin } from "@/lib/admin/access-context";
import { getTeamProfessionalEditorTarget } from "@/lib/admin/team-directory";
import TeamProfessionalProfileForm from "../../TeamProfessionalProfileForm";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function TeamProfessionalProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  let access;
  try { access = await requireSuperAdmin(); } catch (error) { if (error instanceof AdminAccessError && error.code === "unauthenticated") redirect("/admin/login"); redirect("/admin"); }
  const { userId } = await params;
  if (!UUID_PATTERN.test(userId)) notFound();
  if (access.user.id === userId) redirect("/admin/profile");
  const member = await getTeamProfessionalEditorTarget(userId);
  if (!member) notFound();
  return <AdminPageShell><AdminPageHeader breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/equipo", label: "Equipo" }, { href: `/admin/equipo/${member.id}`, label: member.displayName }, { label: "Editar perfil profesional" }]} eyebrow="Cuenta interna" title="Editar perfil profesional" description={`Actualiza la información profesional de ${member.displayName}.`} /><div className="mb-5 flex items-center gap-3"><TeamMemberAvatar imageUrl={member.profileImageUrl} name={member.displayName} size="default"/><div className="min-w-0"><p className="font-semibold text-slate-900">{member.displayName}</p><div className="mt-1"><AccountLifecycleBadge state={member.accountState}/></div></div></div><TeamProfessionalProfileForm target={member}/></AdminPageShell>;
}
