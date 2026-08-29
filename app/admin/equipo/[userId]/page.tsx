import { Building2, UserRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import TeamMemberAvatar from "@/components/admin/TeamMemberAvatar";
import { AccountLifecycleBadge, ProfessionalIdentity, SystemRoleBadge, TeamIdentityEmail } from "@/components/admin/TeamMemberMeta";
import { AdminAccessError, requireSuperAdmin } from "@/lib/admin/access-context";
import { getTeamDirectoryMember } from "@/lib/admin/team-directory";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireTeamDetailAccess() {
  try {
    return await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AdminAccessError && error.code === "unauthenticated") redirect("/admin/login");
    redirect("/admin");
  }
}

export default async function TeamMemberDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  await requireTeamDetailAccess();
  const { userId } = await params;
  if (!UUID_PATTERN.test(userId)) notFound();
  const member = await getTeamDirectoryMember(userId);
  if (!member) notFound();

  return (
    <AdminPageShell>
      <AdminPageHeader breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/equipo", label: "Equipo" }, { label: member.displayName }]} eyebrow="Cuenta interna" title={member.displayName} description="Resumen de identidad profesional y acceso de esta cuenta." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,.85fr)]">
        <section className="surface-card p-5 md:p-6" aria-labelledby="member-summary-heading">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center"><TeamMemberAvatar imageUrl={member.profileImageUrl} name={member.displayName} size="large" /><div className="min-w-0"><h2 id="member-summary-heading" className="text-xl font-bold text-slate-900">{member.displayName}</h2><div className="mt-2"><TeamIdentityEmail member={member} /></div><div className="mt-4 flex flex-wrap gap-2"><SystemRoleBadge role={member.systemRole} /><AccountLifecycleBadge state={member.accountState} /></div></div></div>
          <div className="mt-6 border-t border-slate-200 pt-5"><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><UserRound aria-hidden="true" size={17} className="text-[#11518b]" />Identidad profesional</h3><div className="mt-3"><ProfessionalIdentity member={member} /></div></div>
        </section>
        <aside className="surface-card p-5 md:p-6" aria-labelledby="account-context-heading"><h2 id="account-context-heading" className="flex items-center gap-2 text-base font-bold text-slate-900"><Building2 aria-hidden="true" size={18} className="text-[#11518b]" />Cuenta interna</h2><dl className="mt-4 space-y-4 text-sm"><div><dt className="font-medium text-slate-500">Organización</dt><dd className="mt-1 font-semibold text-slate-800">Erickson Real Estate · Borikí</dd></div><div><dt className="font-medium text-slate-500">Estado de la cuenta</dt><dd className="mt-2"><AccountLifecycleBadge state={member.accountState} /></dd></div><div><dt className="font-medium text-slate-500">Rol del sistema</dt><dd className="mt-2"><SystemRoleBadge role={member.systemRole} /></dd></div></dl></aside>
      </div>
    </AdminPageShell>
  );
}
