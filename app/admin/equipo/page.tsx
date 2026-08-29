import Link from "next/link";
import { UserPlus, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import TeamMemberAvatar from "@/components/admin/TeamMemberAvatar";
import { AccountLifecycleBadge, ProfessionalIdentity, SystemRoleBadge, TeamIdentityEmail } from "@/components/admin/TeamMemberMeta";
import { AdminAccessError, requireSuperAdmin } from "@/lib/admin/access-context";
import { listTeamDirectoryMembers } from "@/lib/admin/team-directory";

async function requireTeamDirectoryAccess() {
  try {
    return await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AdminAccessError && error.code === "unauthenticated") redirect("/admin/login");
    redirect("/admin");
  }
}

export default async function TeamDirectoryPage() {
  await requireTeamDirectoryAccess();
  const members = await listTeamDirectoryMembers();

  return (
    <AdminPageShell>
      <AdminPageHeader breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Equipo" }]} eyebrow="Administración interna" title="Equipo" description="Consulta las cuentas internas, su identidad profesional y su estado de acceso." actions={<Link href="/admin/equipo/nuevo" className="btn-primary"><UserPlus aria-hidden="true" size={17} />Añadir miembro</Link>} />
      {members.length ? (
        <section aria-labelledby="team-directory-heading" className="surface-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 md:px-6"><UsersRound aria-hidden="true" size={20} className="text-[#11518b]" /><div><h2 id="team-directory-heading" className="text-base font-bold text-slate-900">Directorio interno</h2><p className="mt-0.5 text-sm text-slate-600">{members.length} {members.length === 1 ? "cuenta registrada" : "cuentas registradas"}</p></div></div>
          <ul className="divide-y divide-slate-200" aria-label="Miembros del equipo">
            {members.map((member) => (
              <li key={member.id}>
                <Link href={`/admin/equipo/${member.id}`} prefetch={false} className="group block px-5 py-5 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#11518b] md:px-6">
                  <div className="grid gap-4 lg:grid-cols-[minmax(15rem,1.2fr)_minmax(16rem,1.4fr)_auto] lg:items-center lg:gap-6">
                    <div className="flex min-w-0 items-center gap-3"><TeamMemberAvatar imageUrl={member.profileImageUrl} name={member.displayName} /><div className="min-w-0"><h3 className="truncate text-base font-bold text-slate-900 group-hover:text-[#11518b]">{member.displayName}</h3><div className="mt-1"><TeamIdentityEmail member={member} /></div></div></div>
                    <ProfessionalIdentity member={member} compact />
                    <div className="flex flex-wrap gap-2 lg:justify-end"><SystemRoleBadge role={member.systemRole} /><AccountLifecycleBadge state={member.accountState} /></div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="surface-card px-5 py-10 text-center md:px-6"><UsersRound aria-hidden="true" size={30} className="mx-auto text-[#11518b]" /><h2 className="mt-3 text-lg font-bold text-slate-900">Todavía no hay miembros en el equipo.</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Las cuentas internas aparecerán aquí cuando estén disponibles.</p></section>
      )}
    </AdminPageShell>
  );
}
