import { BadgeCheck, BriefcaseBusiness, KeyRound, Mail } from "lucide-react";
import type { TeamDirectoryMember } from "@/lib/admin/team-directory";
import { systemRoleLabels } from "@/lib/admin/access-types";
import { professionalRoleLabels, rolesRequireLicense } from "@/lib/admin/professional-profile";

const lifecycleLabels = {
  active: "Activo",
  pending_setup: "Pendiente de configuración",
  disabled: "Desactivado",
} as const;

const lifecycleClasses = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  pending_setup: "border-amber-200 bg-amber-50 text-amber-900",
  disabled: "border-slate-200 bg-slate-100 text-slate-700",
} as const;

export function AccountLifecycleBadge({ state }: { state: TeamDirectoryMember["accountState"] }) {
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${lifecycleClasses[state]}`}><BadgeCheck aria-hidden="true" size={14} className="mr-1.5" />{lifecycleLabels[state]}</span>;
}

export function SystemRoleBadge({ role }: { role: TeamDirectoryMember["systemRole"] }) {
  return <span className="inline-flex min-h-7 items-center rounded-full border border-[#c8d9e8] bg-[#eef6fb] px-2.5 py-1 text-xs font-semibold text-[#0d406d]"><KeyRound aria-hidden="true" size={14} className="mr-1.5" />{systemRoleLabels[role]}</span>;
}

export function ProfessionalIdentity({ member, compact = false }: { member: TeamDirectoryMember; compact?: boolean }) {
  const roles = professionalRoleLabels(member.professionalRoles, member.professionalTitle || "");
  const hasLicense = rolesRequireLicense(member.professionalRoles) && member.professionalLicenseNumber;
  if (!roles.length) return <p className="text-sm text-slate-500">Sin rol profesional registrado</p>;
  return <div className={compact ? "space-y-1" : "space-y-2"}>
    <p className="flex items-start gap-2 text-sm leading-5 text-slate-700"><BriefcaseBusiness aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-[#11518b]" /><span>{roles.join(" · ")}</span></p>
    {hasLicense ? <p className="ml-6 text-sm font-medium text-slate-600">Lic. {member.professionalLicenseNumber}</p> : null}
  </div>;
}

export function TeamIdentityEmail({ member }: { member: TeamDirectoryMember }) {
  return <p className="flex min-w-0 items-center gap-2 text-sm text-slate-600"><Mail aria-hidden="true" size={16} className="shrink-0 text-slate-400" /><span className="truncate">{member.email || member.username}</span></p>;
}

export { lifecycleLabels };
