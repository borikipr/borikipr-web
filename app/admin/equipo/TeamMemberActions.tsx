"use client";

import { useActionState, useState } from "react";
import { Mail, Shield, UserCheck, UserX } from "lucide-react";
import { AdminActionDialog } from "@/components/admin/AdminActionsMenu";
import type { AccountState, SystemRole } from "@/lib/admin/access-types";
import { changeMemberRoleAction, disableMemberAction, reactivateMemberAction, resendInvitationAction } from "./actions";
import { initialTeamActionState } from "./action-state";

function Feedback({ state }: { state: { error: string; success: string } }) {
  if (state.error) return <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>;
  if (state.success) return <p role="status" className="mt-3 text-sm text-emerald-700">{state.success}</p>;
  return null;
}

function DialogButtons({ pending, submitLabel, danger = false, onCancel }: { pending: boolean; submitLabel: string; danger?: boolean; onCancel: () => void }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn-secondary justify-center" onClick={onCancel}>Cancelar</button><button type="submit" disabled={pending} className={danger ? "admin-danger-button" : "btn-primary"}>{pending ? "Procesando…" : submitLabel}</button></div>;
}

export default function TeamMemberActions({ targetId, displayName, accountState, systemRole }: { targetId: string; displayName: string; accountState: AccountState; systemRole: SystemRole }) {
  const [roleOpen, setRoleOpen] = useState(false); const [disableOpen, setDisableOpen] = useState(false); const [reactivateOpen, setReactivateOpen] = useState(false);
  const [resendState, resendAction, resendPending] = useActionState(resendInvitationAction, initialTeamActionState);
  const [roleState, roleAction, rolePending] = useActionState(changeMemberRoleAction, initialTeamActionState);
  const [disableState, disableAction, disablePending] = useActionState(disableMemberAction, initialTeamActionState);
  const [reactivateState, reactivateAction, reactivatePending] = useActionState(reactivateMemberAction, initialTeamActionState);
  const canChangeRole = accountState !== "disabled" && systemRole !== "super_admin";
  return <section className="surface-card p-5 md:p-6" aria-labelledby="member-actions-heading">
    <div><p className="eyebrow">Gestión de cuenta</p><h2 id="member-actions-heading" className="mt-2 text-base font-bold text-slate-950">Acciones</h2><p className="mt-1 text-sm leading-6 text-slate-600">Las acciones se aplican solo a esta cuenta y quedan registradas de forma segura.</p></div>
    <div className="mt-5 flex flex-wrap gap-2">
      {accountState === "pending_setup" && <form action={resendAction}><input type="hidden" name="targetId" value={targetId} /><button type="submit" className="btn-secondary" disabled={resendPending}><Mail aria-hidden="true" size={16} />{resendPending ? "Enviando…" : "Reenviar invitación"}</button></form>}
      {canChangeRole && <button type="button" className="btn-secondary" onClick={() => setRoleOpen(true)}><Shield aria-hidden="true" size={16} />Cambiar acceso</button>}
      {accountState === "disabled" ? <button type="button" className="btn-secondary" onClick={() => setReactivateOpen(true)}><UserCheck aria-hidden="true" size={16} />Reactivar cuenta</button> : <button type="button" className="admin-danger-button" onClick={() => setDisableOpen(true)}><UserX aria-hidden="true" size={16} />Desactivar cuenta</button>}
    </div>
    <Feedback state={resendState} />
    <AdminActionDialog open={roleOpen} onClose={() => setRoleOpen(false)} title="Cambiar acceso al sistema" description={`Actualiza el acceso de ${displayName}. Su perfil profesional no modifica este permiso.`}>
      <form action={roleAction} className="grid gap-4"><input type="hidden" name="targetId" value={targetId} /><div className="space-y-1.5"><label htmlFor="managedSystemRole" className="text-sm font-semibold text-slate-800">Nuevo acceso</label><select id="managedSystemRole" name="systemRole" className="input-premium" defaultValue={systemRole === "admin" ? "admin" : "member"}><option value="member">Miembro</option><option value="admin">Administrador</option></select></div><Feedback state={roleState} /><DialogButtons pending={rolePending} submitLabel="Actualizar acceso" onCancel={() => setRoleOpen(false)} /></form>
    </AdminActionDialog>
    <AdminActionDialog open={disableOpen} onClose={() => setDisableOpen(false)} danger title="Desactivar cuenta" description={` ${displayName} perderá acceso inmediatamente y sus sesiones activas se cerrarán. Su historial se conserva.`}>
      <form action={disableAction} className="grid gap-4"><input type="hidden" name="targetId" value={targetId} /><Feedback state={disableState} /><DialogButtons pending={disablePending} submitLabel="Desactivar cuenta" danger onCancel={() => setDisableOpen(false)} /></form>
    </AdminActionDialog>
    <AdminActionDialog open={reactivateOpen} onClose={() => setReactivateOpen(false)} title="Reactivar cuenta" description={`${displayName} quedará pendiente de configuración. Se enviará una invitación para crear una nueva contraseña; las sesiones anteriores no volverán.`}>
      <form action={reactivateAction} className="grid gap-4"><input type="hidden" name="targetId" value={targetId} /><Feedback state={reactivateState} /><DialogButtons pending={reactivatePending} submitLabel="Reactivar y enviar invitación" onCancel={() => setReactivateOpen(false)} /></form>
    </AdminActionDialog>
  </section>;
}
