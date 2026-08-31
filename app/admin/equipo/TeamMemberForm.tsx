"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { RolePicker } from "@/app/admin/profile/ProfileForms";
import { rolesRequireLicense, type ProfessionalRoleId } from "@/lib/admin/professional-profile";
import { createMemberAction, updateMemberProfileAction } from "./actions";
import { initialTeamActionState } from "./action-state";

type MemberFormProps = {
  mode: "create" | "edit";
  targetId?: string;
  member?: {
    displayName: string;
    username: string;
    email: string | null;
    professionalRoles: ProfessionalRoleId[];
    professionalTitle: string | null;
    professionalLicenseNumber: string | null;
    systemRole: "super_admin" | "admin" | "member";
  };
};

function Feedback({ state }: { state: { error: string; success: string } }) {
  if (state.error) return <p role="alert" className="profile-feedback is-error">{state.error}</p>;
  if (state.success) return <p role="status" className="profile-feedback is-success">{state.success}</p>;
  return null;
}

export default function TeamMemberForm({ mode, targetId, member }: MemberFormProps) {
  const action = mode === "create" ? createMemberAction : updateMemberProfileAction;
  const [state, formAction, pending] = useActionState(action, initialTeamActionState);
  const initialRoles = member?.professionalRoles?.length ? member.professionalRoles : [];
  const [roles, setRoles] = useState<ProfessionalRoleId[]>(initialRoles);
  const [customTitle, setCustomTitle] = useState(initialRoles.includes("other") ? member?.professionalTitle ?? "" : "");
  const [licenseNumber, setLicenseNumber] = useState(member?.professionalLicenseNumber ?? "");
  const needsLicense = useMemo(() => rolesRequireLicense(roles), [roles]);
  const isCreate = mode === "create";

  return (
    <form action={formAction} className="surface-card grid gap-7 p-5 md:p-7" noValidate>
      {targetId && <input type="hidden" name="targetId" value={targetId} />}
      <section aria-labelledby="team-identity-heading" className="grid gap-4 border-b border-slate-200 pb-7">
        <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0d1b2a] text-white"><UserRound aria-hidden="true" size={17} /></span><div><h2 id="team-identity-heading" className="text-base font-bold text-slate-950">Identidad</h2><p className="mt-0.5 text-sm leading-6 text-slate-600">La información básica para reconocer y acceder a esta cuenta interna.</p></div></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2"><label htmlFor="displayName" className="text-sm font-semibold text-slate-800">Nombre visible</label><input id="displayName" name="displayName" className="input-premium" defaultValue={member?.displayName ?? ""} maxLength={100} autoComplete="name" required /></div>
          {isCreate ? <><div className="space-y-1.5"><label htmlFor="email" className="text-sm font-semibold text-slate-800">Email de acceso</label><input id="email" name="email" type="email" className="input-premium" autoComplete="email" maxLength={254} required /><p className="text-xs leading-5 text-slate-500">Se usa para la invitación y recuperación segura.</p></div><div className="space-y-1.5"><label htmlFor="username" className="text-sm font-semibold text-slate-800">Usuario de acceso</label><input id="username" name="username" className="input-premium" autoComplete="username" minLength={3} maxLength={60} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,59}" required /><p className="text-xs leading-5 text-slate-500">3–60 caracteres: letras, números, punto, guion o guion bajo.</p></div></> : <><div className="space-y-1.5"><span className="text-sm font-semibold text-slate-800">Email de acceso</span><p className="input-premium flex min-h-10 items-center bg-slate-50 text-slate-600">{member?.email ?? "No disponible"}</p></div><div className="space-y-1.5"><span className="text-sm font-semibold text-slate-800">Usuario de acceso</span><p className="input-premium flex min-h-10 items-center bg-slate-50 text-slate-600">{member?.username}</p></div></>}
        </div>
      </section>
      <section aria-labelledby="team-professional-heading" className="grid gap-4 border-b border-slate-200 pb-7">
        <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0d1b2a] text-white"><Building2 aria-hidden="true" size={17} /></span><div><h2 id="team-professional-heading" className="text-base font-bold text-slate-950">Perfil profesional</h2><p className="mt-0.5 text-sm leading-6 text-slate-600">Describe el trabajo de la persona. No cambia su acceso al sistema.</p></div></div>
        <RolePicker roles={roles} onChange={setRoles} customTitle={customTitle} onCustomTitleChange={setCustomTitle} />
        {needsLicense ? <div className="space-y-1.5"><label htmlFor="professionalLicenseNumber" className="text-sm font-semibold text-slate-800">Número de licencia</label><input id="professionalLicenseNumber" name="professionalLicenseNumber" className="input-premium" value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} maxLength={80} required placeholder="Lic. C-XXXXX" /><p className="text-xs leading-5 text-slate-500">Información profesional; no concede permisos.</p></div> : <input type="hidden" name="professionalLicenseNumber" value="" />}
      </section>
      {isCreate && <section aria-labelledby="team-access-heading" className="grid gap-4">
        <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0d1b2a] text-white"><ShieldCheck aria-hidden="true" size={17} /></span><div><h2 id="team-access-heading" className="text-base font-bold text-slate-950">Acceso al sistema</h2><p className="mt-0.5 text-sm leading-6 text-slate-600">El acceso se administra por separado del perfil profesional.</p></div></div>
        <div className="max-w-md space-y-1.5"><label htmlFor="systemRole" className="text-sm font-semibold text-slate-800">Rol del sistema</label><select id="systemRole" name="systemRole" className="input-premium" defaultValue="member"><option value="member">Miembro</option><option value="admin">Administrador</option></select></div>
      </section>}
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between"><Link href={isCreate ? "/admin/equipo" : `/admin/equipo/${targetId}`} className="btn-secondary justify-center">Cancelar</Link><div className="flex flex-col gap-2 sm:items-end"><button type="submit" className="btn-primary" disabled={pending}>{pending ? "Guardando…" : isCreate ? "Crear y enviar invitación" : "Guardar cambios"}</button><Feedback state={state} /></div></div>
    </form>
  );
}
