"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { Archive, Ban, Copy, Eye, FilePenLine, History, RotateCcw, Settings2, Trash2 } from "lucide-react";
import {
  archiveSignatureDraftAction, correctSignatureRequestAction, deleteSignatureDraftAction,
  duplicateSignatureRequestAction, removeSignatureRequestAction, restoreSignatureRequestAction,
  voidSignatureDocumentAction, type SignatureAdminActionState,
} from "@/app/admin/signatures/actions";
import { signatureActionPolicy, type SignatureActionKey } from "@/lib/signatures/action-policy";
import { SignatureActionDialog, SignatureActionsMenu, SignatureMenuItem } from "./SignatureActionsMenu";

const INITIAL: SignatureAdminActionState = { ok: false, message: "" };
type DialogName = "duplicate" | "correct" | "cancel" | "archive" | "restore" | "delete" | null;
function Result({ state }: { state: SignatureAdminActionState }) { return state.message ? <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`} aria-live="polite">{state.message}</p> : null; }
function FormShell({ children }: { children: ReactNode }) { return <div className="grid gap-4">{children}</div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1.5 text-sm font-semibold text-slate-800"><span>{label}</span>{children}</label>; }

export default function SignatureDocumentActions({ documentId, title, status, operationallyHidden, sourceAvailable, deletionEligible, deletionMode }: {
  documentId: string; title: string; status: string; operationallyHidden: boolean; sourceAvailable: boolean;
  deletionEligible: boolean; deletionMode: "inert_draft" | "internal_test_record" | null;
}) {
  const [dialog, setDialog] = useState<DialogName>(null);
  const [duplicateState, duplicate, duplicatePending] = useActionState(duplicateSignatureRequestAction, INITIAL);
  const [correctState, correct, correctPending] = useActionState(correctSignatureRequestAction, INITIAL);
  const [voidState, voidAction, voidPending] = useActionState(voidSignatureDocumentAction, INITIAL);
  const [archiveState, archive, archivePending] = useActionState(removeSignatureRequestAction, INITIAL);
  const [draftArchiveState, draftArchive, draftArchivePending] = useActionState(archiveSignatureDraftAction, INITIAL);
  const [restoreState, restore, restorePending] = useActionState(restoreSignatureRequestAction, INITIAL);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteSignatureDraftAction, INITIAL);
  const actions = new Set<SignatureActionKey>(signatureActionPolicy({ status, operationallyHidden, sourceAvailable, deletionEligible }));
  const confirmationPhrase = deletionMode === "internal_test_record" ? "ELIMINAR PRUEBA" : "ELIMINAR BORRADOR";

  return <section id="acciones" aria-label="Acciones de la solicitud" className="flex justify-end">
    <SignatureActionsMenu>
      <Link role="menuitem" data-close-menu="true" className="signature-actions-item" href={actions.has("edit") ? "#preparacion" : "#resumen"}><Eye aria-hidden="true" size={17}/><span>{actions.has("edit") ? "Editar" : "Ver"}</span></Link>
      {(actions.has("resend") || actions.has("remind")) && <Link role="menuitem" data-close-menu="true" className="signature-actions-item" href="#destinatarios"><RotateCcw aria-hidden="true" size={17}/><span>Reenviar o recordar</span></Link>}
      {actions.has("history") && <Link role="menuitem" data-close-menu="true" className="signature-actions-item" href="#historial"><History aria-hidden="true" size={17}/><span>Ver historial</span></Link>}
      {actions.has("advanced") && <Link role="menuitem" data-close-menu="true" className="signature-actions-item" href="#detalles-avanzados"><Settings2 aria-hidden="true" size={17}/><span>Detalles avanzados</span></Link>}
      {actions.has("duplicate") && <SignatureMenuItem icon={<Copy size={17}/>} onSelect={() => setDialog("duplicate")}>Duplicar</SignatureMenuItem>}
      {actions.has("correct") && <SignatureMenuItem icon={<FilePenLine size={17}/>} onSelect={() => setDialog("correct")}>Corregir</SignatureMenuItem>}
      {actions.has("archive") && <SignatureMenuItem icon={<Archive size={17}/>} onSelect={() => setDialog("archive")}>Archivar</SignatureMenuItem>}
      {actions.has("restore") && <SignatureMenuItem icon={<RotateCcw size={17}/>} onSelect={() => setDialog("restore")}>Restaurar</SignatureMenuItem>}
      {actions.has("cancel") && <div className="signature-actions-separator"><SignatureMenuItem danger icon={<Ban size={17}/>} onSelect={() => setDialog("cancel")}>Cancelar solicitud</SignatureMenuItem></div>}
      {actions.has("delete") && <div className="signature-actions-separator"><SignatureMenuItem danger icon={<Trash2 size={17}/>} onSelect={() => setDialog("delete")}>Eliminar definitivamente</SignatureMenuItem></div>}
    </SignatureActionsMenu>

    <SignatureActionDialog open={dialog === "duplicate"} onClose={() => setDialog(null)} title="Duplicar solicitud" description="Copia PDF, roles, campos y ruta; nunca firmas, valores, tokens ni sesiones."><form action={duplicate}><FormShell><input name="documentId" type="hidden" value={documentId}/><Field label="Título"><input className="input-premium" name="title" defaultValue={`Copia de ${title}`} required/></Field><Field label="Expira"><input className="input-premium" name="expiresOn" type="date" required/></Field><button className="btn-primary justify-self-start" disabled={duplicatePending}>Duplicar solicitud</button><Result state={duplicateState}/></FormShell></form></SignatureActionDialog>
    <SignatureActionDialog open={dialog === "correct"} onClose={() => setDialog(null)} title="Corregir solicitud" description="Crea un borrador vinculado; la solicitud original conserva su evidencia y auditoría."><form action={correct}><FormShell><input name="documentId" type="hidden" value={documentId}/><input name="title" type="hidden" value={`Corrección — ${title}`}/><Field label="Expira"><input className="input-premium" name="expiresOn" type="date" required/></Field><button className="btn-primary justify-self-start" disabled={correctPending}>Preparar corrección</button><Result state={correctState}/></FormShell></form></SignatureActionDialog>
    <SignatureActionDialog open={dialog === "cancel"} onClose={() => setDialog(null)} danger title="Cancelar solicitud" description="Anula accesos pendientes y conserva toda la evidencia existente."><form action={voidAction}><FormShell><input name="documentId" type="hidden" value={documentId}/><Field label="Razón"><textarea className="input-premium min-h-24" name="reason" required/></Field><button className="signature-danger-button" disabled={voidPending}>Cancelar solicitud</button><Result state={voidState}/></FormShell></form></SignatureActionDialog>
    <SignatureActionDialog open={dialog === "archive"} onClose={() => setDialog(null)} title="Archivar" description="Quita la solicitud de la operación diaria sin borrar evidencia."><form action={status === "draft" ? draftArchive : archive}><FormShell><input name="documentId" type="hidden" value={documentId}/><Field label="Razón"><textarea className="input-premium min-h-24" name="reason" required/></Field><button className="btn-primary justify-self-start" disabled={status === "draft" ? draftArchivePending : archivePending}>Archivar</button><Result state={status === "draft" ? draftArchiveState : archiveState}/></FormShell></form></SignatureActionDialog>
    <SignatureActionDialog open={dialog === "restore"} onClose={() => setDialog(null)} title="Restaurar" description="Devuelve la solicitud a su vista operativa sin alterar su estado ni historial."><form action={restore}><FormShell><input name="documentId" type="hidden" value={documentId}/><input name="reason" type="hidden" value="Restaurado a la vista operativa por el administrador"/><button className="btn-primary justify-self-start" disabled={restorePending}>Restaurar solicitud</button><Result state={restoreState}/></FormShell></form></SignatureActionDialog>
    <SignatureActionDialog open={dialog === "delete"} onClose={() => setDialog(null)} danger title="Eliminar definitivamente" description={deletionMode === "internal_test_record" ? "Esta acción eliminará permanentemente esta prueba y sus artefactos asociados. No se puede deshacer." : "Esta acción eliminará permanentemente este borrador inerte y su PDF fuente. No se puede deshacer."}><form action={deleteAction}><FormShell><input name="documentId" type="hidden" value={documentId}/><Field label="Razón"><textarea className="input-premium min-h-24" name="reason" required/></Field><Field label={`Escribe ${confirmationPhrase}`}><input className="input-premium" name="confirmationPhrase" autoComplete="off" required/></Field><button className="signature-danger-button" disabled={deletePending}>Eliminar definitivamente</button><Result state={deleteState}/></FormShell></form></SignatureActionDialog>
  </section>;
}
