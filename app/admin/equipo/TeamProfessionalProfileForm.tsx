"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { UserRound } from "lucide-react";
import { ProfilePhotoControl, RolePicker } from "@/app/admin/profile/ProfileForms";
import PublicProfileStatusBadge from "@/components/admin/PublicProfileStatusBadge";
import { professionalRoleTitle, rolesRequireLicense, type ProfessionalRoleId, type PublicProfileApprovalState } from "@/lib/admin/professional-profile";
import type { AccountState } from "@/lib/admin/access-types";
import { initialTeamActionState, type TeamActionState, updateTeamProfessionalProfileAction } from "./actions";

type Props = {
  target: {
    id: string; displayName: string; username: string; accountState: AccountState;
    professionalRoles: ProfessionalRoleId[]; professionalTitle: string | null; professionalLicenseNumber: string | null;
    profileImageUrl: string | null; professionalEmail: string | null; professionalPhone: string | null;
    whatsappEnabled: boolean; professionalBio: string | null; publicProfileEnabled: boolean;
    publicProfileApprovalState: PublicProfileApprovalState;
  };
};

function Feedback({ state }: { state: { error: string; success: string } }) {
  if (state.error) return <p role="alert" className="profile-feedback is-error">{state.error}</p>;
  if (state.success) return <p role="status" className="profile-feedback is-success">{state.success}</p>;
  return null;
}

function FieldError({ state, field }: { state: TeamActionState; field: string }) {
  if (state.field !== field || !state.error) return null;
  return <p id={`${field}-error`} role="alert" className="text-sm text-red-700">{state.error}</p>;
}

export default function TeamProfessionalProfileForm({ target }: Props) {
  const readOnly = target.accountState === "disabled";
  const [state, action, pending] = useActionState(updateTeamProfessionalProfileAction, initialTeamActionState);
  const [imageUrl, setImageUrl] = useState(target.profileImageUrl || "");
  const [roles, setRoles] = useState<ProfessionalRoleId[]>(target.professionalRoles);
  const [customTitle, setCustomTitle] = useState(target.professionalRoles.includes("other") ? target.professionalTitle || "" : "");
  const [licenseNumber, setLicenseNumber] = useState(target.professionalLicenseNumber || "");
  const [hasPhone, setHasPhone] = useState(Boolean(target.professionalPhone));
  const [whatsappEnabled, setWhatsappEnabled] = useState(target.whatsappEnabled);
  const credentialsChanged = useMemo(() => JSON.stringify(roles) !== JSON.stringify(target.professionalRoles) || licenseNumber.trim() !== (target.professionalLicenseNumber || ""), [licenseNumber, roles, target.professionalLicenseNumber, target.professionalRoles]);
  const needsLicense = rolesRequireLicense(roles);
  const title = professionalRoleTitle(target.professionalRoles, target.professionalTitle || "");

  return <form action={action} className="surface-card grid gap-6 p-5 md:max-w-3xl md:p-7" noValidate>
    <input type="hidden" name="targetId" value={target.id} />
    <div className="flex items-center gap-3 border-b border-slate-200 pb-5"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0d1b2a] text-white"><UserRound aria-hidden="true" size={20}/></div><div><p className="text-sm font-semibold text-slate-950">{target.displayName}</p><p className="text-sm text-slate-600">{title || "Perfil profesional"}</p></div></div>
    {target.accountState === "pending_setup" ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">La cuenta aún no está activa. Puedes preparar la información profesional, pero el perfil no estará disponible hasta que la persona active su cuenta y autorice su perfil público.</p> : null}
    {readOnly ? <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">Esta cuenta está deshabilitada. El perfil profesional es solo de lectura.</p> : null}
    <fieldset disabled={readOnly} className="grid gap-5 disabled:opacity-75">
      <ProfilePhotoControl imageUrl={imageUrl} onChange={setImageUrl} displayName={target.displayName} username={target.username} uploadPurpose="team-profile" targetId={target.id} />
      <FieldError state={state} field="profileImageUrl" />
      <input type="hidden" name="profileImageUrl" value={imageUrl} />
      <div className="space-y-1.5"><label htmlFor="displayName" className="text-sm font-semibold text-slate-800">Nombre visible</label><input id="displayName" name="displayName" className="input-premium" defaultValue={target.displayName} maxLength={100} required aria-describedby={state.field === "displayName" ? "displayName-error" : undefined} /><FieldError state={state} field="displayName" /></div>
      <RolePicker roles={roles} onChange={setRoles} customTitle={customTitle} onCustomTitleChange={setCustomTitle} />
      <FieldError state={state} field="professionalRoles" />
      {needsLicense ? <div className="space-y-1.5"><label htmlFor="professionalLicenseNumber" className="text-sm font-semibold text-slate-800">Número de licencia</label><input id="professionalLicenseNumber" name="professionalLicenseNumber" className="input-premium" value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} maxLength={80} required placeholder="Lic. C-XXXXX" aria-describedby={state.field === "professionalLicenseNumber" ? "professionalLicenseNumber-error" : undefined} /><FieldError state={state} field="professionalLicenseNumber" /></div> : <input type="hidden" name="professionalLicenseNumber" value="" />}
      {target.publicProfileApprovalState === "approved" && credentialsChanged ? <p className="text-sm leading-6 text-amber-800">Cambiar el rol profesional o la licencia requerirá una nueva revisión del perfil público.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><label htmlFor="professionalEmail" className="text-sm font-semibold text-slate-800">Email profesional</label><input id="professionalEmail" name="professionalEmail" type="email" className="input-premium" defaultValue={target.professionalEmail || ""} maxLength={254} aria-describedby={state.field === "professionalEmail" ? "professionalEmail-error" : undefined} /><FieldError state={state} field="professionalEmail" /></div><div className="space-y-1.5"><label htmlFor="professionalPhone" className="text-sm font-semibold text-slate-800">Teléfono profesional</label><input id="professionalPhone" name="professionalPhone" type="tel" className="input-premium" defaultValue={target.professionalPhone || ""} placeholder="(787) 555-1234" aria-describedby={state.field === "professionalPhone" ? "professionalPhone-error" : undefined} onChange={(event) => { const next = Boolean(event.target.value.trim()); setHasPhone(next); if (!next) setWhatsappEnabled(false); }} /><FieldError state={state} field="professionalPhone" /></div></div>
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"><input type="checkbox" name="professionalPhoneWhatsappEnabled" value="true" checked={whatsappEnabled} onChange={(event) => setWhatsappEnabled(event.target.checked)} disabled={!hasPhone} className="mt-0.5 h-4 w-4" /><span><strong className="block text-slate-900">Usar este número para WhatsApp</strong>{!hasPhone ? <span className="mt-1 block text-xs text-slate-500">Añade un teléfono profesional para habilitar WhatsApp.</span> : null}</span></label>
      <div className="space-y-1.5"><label htmlFor="professionalBio" className="text-sm font-semibold text-slate-800">Biografía profesional</label><textarea id="professionalBio" name="professionalBio" className="input-premium min-h-28" defaultValue={target.professionalBio || ""} maxLength={2000} aria-describedby={state.field === "professionalBio" ? "professionalBio-error" : "professionalBioHelp"} /><p id="professionalBioHelp" className="text-xs leading-5 text-slate-500">Breve descripción de su experiencia y servicios.</p><FieldError state={state} field="professionalBio" /></div>
    </fieldset>
    <section className="rounded-xl border border-slate-200 px-4 py-3" aria-labelledby="public-profile-status"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="public-profile-status" className="text-sm font-semibold text-slate-900">Perfil público</h2><p className="mt-1 text-xs text-slate-600">Solicitud de perfil público: {target.publicProfileEnabled ? "Sí" : "No"}</p></div><PublicProfileStatusBadge state={target.publicProfileApprovalState}/></div></section>
    <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between"><Link href={`/admin/equipo/${target.id}`} className="btn-secondary justify-center">Volver</Link>{!readOnly ? <div className="flex flex-col gap-2 sm:items-end"><button type="submit" className="btn-primary" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</button><Feedback state={state}/></div> : null}</div>
  </form>;
}
