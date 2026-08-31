"use client";

import { useActionState, useCallback, useState } from "react";
import { AdminActionDialog } from "@/components/admin/AdminActionsMenu";
import PublicProfileStatusBadge from "@/components/admin/PublicProfileStatusBadge";
import type { PublicProfileApprovalState } from "@/lib/admin/professional-profile";
import { approvePublicProfessionalProfileAction, withdrawPublicProfessionalProfileApprovalAction } from "./actions";
import { initialTeamActionState, type TeamActionState } from "./action-state";

export default function PublicProfileReview({ targetId, displayName, status, isSelf }: { targetId: string; displayName: string; status: PublicProfileApprovalState; isSelf: boolean }) {
  const [approveOpen, setApproveOpen] = useState(false); const [withdrawOpen, setWithdrawOpen] = useState(false);
  const approveAndCloseOnSuccess = useCallback(async (previousState: TeamActionState, formData: FormData) => {
    const nextState = await approvePublicProfessionalProfileAction(previousState, formData);
    if (nextState.success) setApproveOpen(false);
    return nextState;
  }, []);
  const withdrawAndCloseOnSuccess = useCallback(async (previousState: TeamActionState, formData: FormData) => {
    const nextState = await withdrawPublicProfessionalProfileApprovalAction(previousState, formData);
    if (nextState.success) setWithdrawOpen(false);
    return nextState;
  }, []);
  const [approveState, approveAction, approving] = useActionState(approveAndCloseOnSuccess, initialTeamActionState);
  const [withdrawState, withdrawAction, withdrawing] = useActionState(withdrawAndCloseOnSuccess, initialTeamActionState);
  const feedback = approveState.success || withdrawState.success;
  const canApprove = !isSelf && status === "pending_review";
  const canWithdraw = !isSelf && status === "approved";
  return <section className="surface-card p-5 md:p-6" aria-labelledby="public-profile-heading">
    <p className="eyebrow">Perfil profesional</p><h2 id="public-profile-heading" className="mt-2 text-lg font-bold text-slate-950">Perfil profesional público</h2>
    <div className="mt-3 flex flex-wrap items-center gap-3"><PublicProfileStatusBadge state={status} />{isSelf && status === "pending_review" ? <p className="text-sm text-slate-600">Otra superadministración debe revisar este perfil.</p> : null}</div>
    {(canApprove || canWithdraw) && <div className="mt-4"><button type="button" className={canWithdraw ? "btn-secondary" : "btn-primary"} onClick={() => canApprove ? setApproveOpen(true) : setWithdrawOpen(true)}>{canApprove ? "Aprobar perfil" : "Retirar aprobación"}</button></div>}
    {feedback ? <p className="mt-3 text-sm text-emerald-700" role="status">{feedback}</p> : null}
    <AdminActionDialog open={approveOpen} onClose={() => setApproveOpen(false)} title="Aprobar perfil profesional" description={`Aprobarás el perfil de ${displayName} para futuras áreas públicas de Borikí.`}><form action={approveAction} className="grid gap-4"><input type="hidden" name="targetId" value={targetId}/>{approveState.error ? <p role="alert" className="text-sm text-red-700">{approveState.error}</p> : null}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn-secondary" onClick={() => setApproveOpen(false)}>Cancelar</button><button type="submit" disabled={approving} className="btn-primary">{approving ? "Procesando…" : "Aprobar perfil"}</button></div></form></AdminActionDialog>
    <AdminActionDialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title="Retirar aprobación" description={`El perfil de ${displayName} requerirá una nueva revisión antes de usarse en áreas públicas.`}><form action={withdrawAction} className="grid gap-4"><input type="hidden" name="targetId" value={targetId}/>{withdrawState.error ? <p role="alert" className="text-sm text-red-700">{withdrawState.error}</p> : null}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn-secondary" onClick={() => setWithdrawOpen(false)}>Cancelar</button><button type="submit" disabled={withdrawing} className="admin-danger-button">{withdrawing ? "Procesando…" : "Retirar aprobación"}</button></div></form></AdminActionDialog>
  </section>;
}
