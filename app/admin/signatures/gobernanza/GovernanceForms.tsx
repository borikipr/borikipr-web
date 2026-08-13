"use client";

import { useActionState, useState } from "react";
import { GOVERNANCE_APPROVAL_PHRASE } from "@/lib/signatures/governance-constants";
import { SIGNATURE_DOCUMENT_TYPES, type SignatureApprovalMode } from "@/lib/signatures/document-classification";
import {
  activateRetentionAction, approveClassificationAction, approveConsentAction,
  approvePrivacyAction, approveRetentionAction, createClassificationAction,
  createConsentAction, createPrivacyAction, createRetentionAction,
  placeLegalHoldAction, releaseLegalHoldAction, submitClassificationAction,
  submitConsentAction, submitPrivacyAction, submitRetentionAction,
  type GovernanceActionState,
} from "./actions";

const initial: GovernanceActionState = { ok: false, message: "" };

function Submit({ children }: { children: React.ReactNode }) {
  return <button className="btn-primary" type="submit">{children}</button>;
}

function Result({ state }: { state: GovernanceActionState }) {
  return state.message ? <p aria-live="polite" className={state.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>{state.message}</p> : null;
}

function ApprovalFields({ allowOutOfScope = false, includeOrganization = false }: { allowOutOfScope?: boolean; includeOrganization?: boolean }) {
  const [mode, setMode] = useState<SignatureApprovalMode>("internal_business");
  return <>
    <label>Modo de aprobación
      <select name="approvalMode" value={mode} onChange={(event) => setMode(event.target.value as SignatureApprovalMode)} required>
        <option value="internal_business">Aprobación interna de Erickson Real Estate</option>
        <option value="external_review">Revisión externa opcional</option>
        {allowOutOfScope && <option value="out_of_scope">Fuera de alcance / formalidad externa requerida</option>}
      </select>
    </label>
    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
      {mode === "internal_business" && "Esta decisión aprueba el uso dentro del flujo de corretaje; no representa asesoría legal ni notarización."}
      {mode === "external_review" && "Registre la revisión externa que Erickson Real Estate obtuvo de forma independiente."}
      {mode === "out_of_scope" && "Esta versión quedará restringida y no podrá enviarse mediante Borikí Signing."}
    </p>
    <label>Rol de quien aprueba o registra la decisión<input name="approverRole" required placeholder="Ej. Corredora principal / Administrador autorizado" /></label>
    <label>Fuente o referencia de aprobación<input name="approvalReference" required /></label>
    {mode === "external_review" && <>
      <label>Nombre del revisor externo<input name="externalReviewerName" required /></label>
      {includeOrganization && <label>Organización o firma<input name="externalReviewerOrganization" required /></label>}
      {includeOrganization && <label>Rol del revisor externo<input name="externalReviewerRole" /></label>}
      <label>Referencia de evidencia externa<input name="externalReviewerReference" required /></label>
    </>}
    <label>Fecha efectiva<input name="effectiveFrom" type="datetime-local" required /></label>
    <label className="flex items-start gap-2"><input name="immutableAcknowledged" type="checkbox" value="true" required />Confirmo que la fuente indicada respalda esta decisión y que la versión aprobada no podrá editarse.</label>
    <label>Escriba <code>{GOVERNANCE_APPROVAL_PHRASE}</code><input name="confirmationPhrase" required /></label>
  </>;
}

type Option = { id: string; label: string; status?: string };
type Drafts = {
  classifications: Option[];
  consents: Option[];
  privacy: Option[];
  retention: (Option & { status: string })[];
  documents: Option[];
  legalHolds: Option[];
};

export function GovernanceForms({ drafts }: { drafts: Drafts }) {
  const [classificationCreate, classificationCreateAction] = useActionState(createClassificationAction, initial);
  const [classificationSubmit, classificationSubmitAction] = useActionState(submitClassificationAction, initial);
  const [classificationApprove, classificationApproveAction] = useActionState(approveClassificationAction, initial);
  const [consentCreate, consentCreateAction] = useActionState(createConsentAction, initial);
  const [consentSubmit, consentSubmitAction] = useActionState(submitConsentAction, initial);
  const [consentApprove, consentApproveAction] = useActionState(approveConsentAction, initial);
  const [privacyCreate, privacyCreateAction] = useActionState(createPrivacyAction, initial);
  const [privacySubmit, privacySubmitAction] = useActionState(submitPrivacyAction, initial);
  const [privacyApprove, privacyApproveAction] = useActionState(approvePrivacyAction, initial);
  const [retentionCreate, retentionCreateAction] = useActionState(createRetentionAction, initial);
  const [retentionSubmit, retentionSubmitAction] = useActionState(submitRetentionAction, initial);
  const [retentionApprove, retentionApproveAction] = useActionState(approveRetentionAction, initial);
  const [retentionActivate, retentionActivateAction] = useActionState(activateRetentionAction, initial);
  const [holdPlace, holdPlaceAction] = useActionState(placeLegalHoldAction, initial);
  const [holdRelease, holdReleaseAction] = useActionState(releaseLegalHoldAction, initial);
  const select = (name: string, items: Option[]) => <select name={name} required><option value="">Seleccione</option>{items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>;

  return <section className="space-y-6" aria-labelledby="governance-management">
    <h2 id="governance-management" className="text-xl font-semibold">Gestión autenticada de versiones</h2>
    <p className="text-sm text-slate-600">La aprobación interna es la ruta normal para documentos ordinarios del corretaje. La revisión externa es opcional, salvo que el alcance específico exija otra formalidad. Guardar no equivale a aprobar.</p>

    <details className="surface-card p-5"><summary className="font-semibold">Clasificaciones de documentos</summary><div className="mt-4 grid gap-5 lg:grid-cols-3">
      <form action={classificationCreateAction} className="grid gap-3"><h3>Crear borrador</h3><label>Tipo<select name="documentType" required>{SIGNATURE_DOCUMENT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Nombre visible<input name="displayName" required /></label><label>Descripción<textarea name="description" required /></label><label>Uso permitido y condiciones<textarea name="permittedSigningUse" required /></label><Submit>Crear borrador</Submit><Result state={classificationCreate} /></form>
      <form action={classificationSubmitAction} className="grid gap-3"><h3>Enviar a revisión</h3>{select("id", drafts.classifications.filter((item) => item.status === "draft"))}<Submit>Enviar a revisión</Submit><Result state={classificationSubmit} /></form>
      <form action={classificationApproveAction} className="grid gap-3"><h3>Registrar decisión</h3>{select("id", drafts.classifications.filter((item) => item.status === "pending"))}<ApprovalFields allowOutOfScope includeOrganization /><label>Fecha de decisión<input name="approvalDate" type="date" required /></label><label>Notas internas opcionales<textarea name="notes" /></label><Submit>Registrar versión inmutable</Submit><Result state={classificationApprove} /></form>
    </div></details>

    <details className="surface-card p-5"><summary className="font-semibold">Consentimientos es-PR / en-US</summary><div className="mt-4 grid gap-5 lg:grid-cols-3">
      <form action={consentCreateAction} className="grid gap-3"><h3>Crear borrador</h3><label>Versión<input name="versionIdentifier" required pattern="[a-z0-9][a-z0-9._-]{0,99}" /></label><label>Idioma<select name="locale"><option>es-PR</option><option>en-US</option></select></label><label>Texto exacto<textarea name="text" minLength={20} required /></label><Submit>Crear borrador</Submit><Result state={consentCreate} /></form>
      <form action={consentSubmitAction} className="grid gap-3"><h3>Enviar a revisión</h3>{select("id", drafts.consents.filter((item) => item.status === "draft"))}<Submit>Enviar</Submit><Result state={consentSubmit} /></form>
      <form action={consentApproveAction} className="grid gap-3"><h3>Registrar aprobación</h3>{select("id", drafts.consents.filter((item) => item.status === "pending_review"))}<ApprovalFields /><Submit>Registrar versión inmutable</Submit><Result state={consentApprove} /></form>
    </div></details>

    <details className="surface-card p-5"><summary className="font-semibold">Divulgación de privacidad bilingüe</summary><div className="mt-4 grid gap-5 lg:grid-cols-3">
      <form action={privacyCreateAction} className="grid gap-3"><h3>Crear borrador</h3><label>Versión<input name="versionIdentifier" required pattern="[a-z0-9][a-z0-9._-]{0,99}" /></label><label>Texto es-PR<textarea name="esPRText" minLength={20} required /></label><label>Texto en-US<textarea name="enUSText" minLength={20} required /></label><Submit>Crear borrador</Submit><Result state={privacyCreate} /></form>
      <form action={privacySubmitAction} className="grid gap-3"><h3>Enviar a revisión</h3>{select("id", drafts.privacy.filter((item) => item.status === "draft"))}<Submit>Enviar</Submit><Result state={privacySubmit} /></form>
      <form action={privacyApproveAction} className="grid gap-3"><h3>Registrar aprobación</h3>{select("id", drafts.privacy.filter((item) => item.status === "pending_review"))}<ApprovalFields /><Submit>Registrar versión inmutable</Submit><Result state={privacyApprove} /></form>
    </div></details>

    <details className="surface-card p-5"><summary className="font-semibold">Política de retención</summary><div className="mt-4 grid gap-5 lg:grid-cols-4">
      <form action={retentionCreateAction} className="grid gap-3"><h3>Crear borrador</h3><label>Versión<input name="versionIdentifier" required /></label><label>Referencia de decisión pendiente<input name="approvalReference" required /></label><label>Referencia de privacidad<input name="privacyReference" required /></label>{["sourcePdfDays","completedPdfDays","certificateDays","evidenceManifestDays","tokenDays","sessionHours","networkEvidenceDays","failedCancelledDraftDays","auditEventDays"].map((name) => <label key={name}>{name}<input name={name} type="number" min="1" /></label>)}<label><input name="completedCleanupEnabled" type="checkbox" value="true" /> Permitir limpieza de evidencia completada</label><Submit>Crear sin activar</Submit><Result state={retentionCreate} /></form>
      <form action={retentionSubmitAction} className="grid gap-3"><h3>Enviar a revisión</h3>{select("id", drafts.retention.filter((item) => item.status === "draft"))}<Submit>Enviar</Submit><Result state={retentionSubmit} /></form>
      <form action={retentionApproveAction} className="grid gap-3"><h3>Registrar aprobación</h3>{select("id", drafts.retention.filter((item) => item.status === "pending_review"))}<ApprovalFields /><Submit>Aprobar sin activar</Submit><Result state={retentionApprove} /></form>
      <form action={retentionActivateAction} className="grid gap-3"><h3>Activar por separado</h3>{select("id", drafts.retention.filter((item) => item.status === "approved"))}<label><input name="immutableAcknowledged" type="checkbox" value="true" required /> Confirmo activación separada.</label><label>Escriba <code>{GOVERNANCE_APPROVAL_PHRASE}</code><input name="confirmationPhrase" required /></label><Submit>Activar explícitamente</Submit><Result state={retentionActivate} /></form>
    </div></details>

    <details className="surface-card p-5"><summary className="font-semibold">Retenciones legales persistentes</summary><p className="mt-3 text-sm text-slate-600">Una retención activa bloquea toda limpieza del documento. Liberarla requiere una acción separada y conserva el historial.</p><div className="mt-4 grid gap-5 lg:grid-cols-2">
      <form action={holdPlaceAction} className="grid gap-3"><h3>Colocar retención</h3>{select("documentId", drafts.documents)}<label>Razón o referencia<input name="reasonReference" required /></label><label>Referencia legal externa opcional<input name="externalLegalReference" /></label><Submit>Colocar retención</Submit><Result state={holdPlace} /></form>
      <form action={holdReleaseAction} className="grid gap-3"><h3>Liberar retención</h3>{select("id", drafts.legalHolds)}<label>Referencia de liberación<input name="releaseReference" required /></label><label><input name="immutableAcknowledged" type="checkbox" value="true" required /> Confirmo que la liberación es explícita, auditable y no borra el historial.</label><label>Escriba <code>LIBERAR RETENCION LEGAL</code><input name="confirmationPhrase" required /></label><Submit>Liberar explícitamente</Submit><Result state={holdRelease} /></form>
    </div></details>
  </section>;
}
