"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import {
  correctSignatureRequestAction,
  archiveSignatureDraftAction,
  deleteSignatureDraftAction,
  duplicateSignatureRequestAction,
  removeSignatureRequestAction,
  restoreSignatureRequestAction,
  voidSignatureDocumentAction,
  type SignatureAdminActionState,
} from "@/app/admin/signatures/actions";
import { signatureActionPolicy, type SignatureActionKey } from "@/lib/signatures/action-policy";

const INITIAL: SignatureAdminActionState = { ok: false, message: "" };
function Result({ state }: { state: SignatureAdminActionState }) {
  return state.message ? <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`} aria-live="polite">{state.message}</p> : null;
}
function ActionSection({ label, children, danger = false }: { label: string; children: ReactNode; danger?: boolean }) {
  return <details className={`signature-action-section ${danger ? "is-danger" : ""}`}><summary>{label}</summary><div>{children}</div></details>;
}

export default function SignatureDocumentActions({ documentId, title, status, operationallyHidden, sourceAvailable, deletionEligible }: {
  documentId: string; title: string; status: string; operationallyHidden: boolean; sourceAvailable: boolean; deletionEligible: boolean;
}) {
  const [duplicateState, duplicate, duplicatePending] = useActionState(duplicateSignatureRequestAction, INITIAL);
  const [correctState, correct, correctPending] = useActionState(correctSignatureRequestAction, INITIAL);
  const [voidState, voidAction, voidPending] = useActionState(voidSignatureDocumentAction, INITIAL);
  const [archiveState, archive, archivePending] = useActionState(removeSignatureRequestAction, INITIAL);
  const [draftArchiveState, draftArchive, draftArchivePending] = useActionState(archiveSignatureDraftAction, INITIAL);
  const [restoreState, restore, restorePending] = useActionState(restoreSignatureRequestAction, INITIAL);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteSignatureDraftAction, INITIAL);
  const actions = new Set<SignatureActionKey>(signatureActionPolicy({ status, operationallyHidden, sourceAvailable, deletionEligible }));

  return <details className="signature-actions" id="acciones">
    <summary className="btn-secondary">Acciones</summary>
    <div className="signature-actions-menu">
      {actions.has("edit") ? <Link href="#preparacion">Editar</Link> : <Link href="#resumen">Ver</Link>}
      {(actions.has("resend") || actions.has("remind")) && <Link href="#destinatarios">Reenviar invitación / Recordar</Link>}
      {actions.has("history") && <Link href="#historial">Ver historial</Link>}
      {actions.has("advanced") && <Link href="#detalles-avanzados">Ver detalles avanzados</Link>}
      {actions.has("duplicate") && <ActionSection label="Duplicar"><form action={duplicate} className="grid gap-3">
        <p className="text-sm text-slate-600">Copia PDF, roles, campos y ruta; nunca firmas, valores, tokens ni sesiones.</p>
        <input name="documentId" type="hidden" value={documentId}/><label className="text-sm font-semibold">Título<input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="title" defaultValue={`Copia de ${title}`} required/></label><label className="text-sm font-semibold">Expira<input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="expiresOn" type="date" required/></label><button className="btn-secondary justify-self-start" disabled={duplicatePending}>Duplicar solicitud</button><Result state={duplicateState}/>
      </form></ActionSection>}
      {actions.has("correct") && <ActionSection label="Corregir"><form action={correct} className="grid gap-3">
        <p className="text-sm text-slate-600">Crea un borrador vinculado. La solicitud original conserva su evidencia y auditoría intactas.</p><input name="documentId" type="hidden" value={documentId}/><input name="title" type="hidden" value={`Corrección — ${title}`}/><label className="text-sm font-semibold">Expira<input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="expiresOn" type="date" required/></label><button className="btn-secondary justify-self-start" disabled={correctPending}>Preparar corrección</button><Result state={correctState}/>
      </form></ActionSection>}
      {actions.has("cancel") && <ActionSection label="Cancelar solicitud" danger><form action={voidAction} className="grid gap-3">
        <p className="text-sm text-slate-600">Anula accesos pendientes y conserva toda la evidencia existente.</p><input name="documentId" type="hidden" value={documentId}/><label className="text-sm font-semibold">Razón<textarea className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="reason" required/></label><button className="signature-danger-button" disabled={voidPending}>Cancelar solicitud</button><Result state={voidState}/>
      </form></ActionSection>}
      {actions.has("archive") && <ActionSection label="Archivar"><form action={status === "draft" ? draftArchive : archive} className="grid gap-3">
        <p className="text-sm text-slate-600">Quita la solicitud de la operación diaria sin borrar evidencia.</p><input name="documentId" type="hidden" value={documentId}/><label className="text-sm font-semibold">Razón<textarea className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="reason" required/></label><button className="btn-secondary justify-self-start" disabled={status === "draft" ? draftArchivePending : archivePending}>Archivar</button><Result state={status === "draft" ? draftArchiveState : archiveState}/>
      </form></ActionSection>}
      {actions.has("restore") && <ActionSection label="Restaurar"><form action={restore} className="grid gap-3">
        <p className="text-sm text-slate-600">Devuelve la solicitud a su vista operativa sin alterar su estado ni historial.</p><input name="documentId" type="hidden" value={documentId}/><input name="reason" type="hidden" value="Restaurado a la vista operativa por el administrador"/><button className="btn-secondary justify-self-start" disabled={restorePending}>Restaurar</button><Result state={restoreState}/>
      </form></ActionSection>}
      {actions.has("delete") && <ActionSection label="Eliminar definitivamente" danger><form action={deleteAction} className="grid gap-3">
        <p className="text-sm text-slate-600">Solo disponible para un borrador inerte sin participantes, accesos, entregas, valores, artefactos ni retención aplicable.</p><input name="documentId" type="hidden" value={documentId}/><label className="text-sm font-semibold">Razón<textarea className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="reason" required/></label><label className="text-sm font-semibold">Escribe ELIMINAR BORRADOR<input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="confirmationPhrase" required/></label><button className="signature-danger-button" disabled={deletePending}>Eliminar definitivamente</button><Result state={deleteState}/>
      </form></ActionSection>}
    </div>
  </details>;
}
