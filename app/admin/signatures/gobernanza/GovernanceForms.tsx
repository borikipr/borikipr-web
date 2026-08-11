"use client";

import { useActionState } from "react";
import { SIGNATURE_DOCUMENT_TYPES } from "@/lib/signatures/document-classification";
import { GOVERNANCE_APPROVAL_PHRASE } from "@/lib/signatures/governance-constants";
import type { GovernanceActionState } from "./actions";
import { approveClassificationAction, approveConsentAction, approvePrivacyAction, approveRetentionAction,
  activateRetentionAction, createClassificationAction, createConsentAction, createPrivacyAction, createRetentionAction,
  submitClassificationAction, submitConsentAction, submitPrivacyAction, submitRetentionAction } from "./actions";
import { placeLegalHoldAction, releaseLegalHoldAction } from "./actions";

const initial: GovernanceActionState={ok:false,message:""};
function Result({state}:{state:GovernanceActionState}) { return state.message ? <p className={`text-sm ${state.ok?"text-green-700":"text-red-700"}`} role="status">{state.message}</p>:null; }
function Submit({children}:{children:React.ReactNode}) { return <button className="btn-primary" type="submit">{children}</button>; }
function ApprovalFields({includeFirm=false}:{includeFirm?:boolean}) { return <>
  <label>Nombre del revisor legal externo<input name="externalReviewerName" required /></label>
  {includeFirm&&<label>Bufete u organización<input name="counselLawFirm" required /></label>}
  <label>Referencia de aprobación<input name="approvalReference" required /></label>
  <label>Referencia de evidencia externa<input name="externalReviewerReference" required /></label>
  <label>Vigente desde<input name="effectiveFrom" type="datetime-local" required /></label>
  <label className="flex items-start gap-2"><input name="immutableAcknowledged" type="checkbox" value="true" required />Confirmo que la revisión externa ocurrió y que esta versión no podrá editarse.</label>
  <label>Escriba <code>{GOVERNANCE_APPROVAL_PHRASE}</code><input name="confirmationPhrase" required /></label>
  </>; }

export function GovernanceForms({drafts}:{drafts:{classifications:{id:string;label:string}[];consents:{id:string;label:string}[];privacy:{id:string;label:string}[];retention:{id:string;label:string;status:string}[];documents:{id:string;label:string}[];legalHolds:{id:string;label:string}[]}}) {
  const [classificationCreate,classificationCreateAction]=useActionState(createClassificationAction,initial);
  const [classificationSubmit,classificationSubmitAction]=useActionState(submitClassificationAction,initial);
  const [classificationApprove,classificationApproveAction]=useActionState(approveClassificationAction,initial);
  const [consentCreate,consentCreateAction]=useActionState(createConsentAction,initial);
  const [consentSubmit,consentSubmitAction]=useActionState(submitConsentAction,initial);
  const [consentApprove,consentApproveAction]=useActionState(approveConsentAction,initial);
  const [privacyCreate,privacyCreateAction]=useActionState(createPrivacyAction,initial);
  const [privacySubmit,privacySubmitAction]=useActionState(submitPrivacyAction,initial);
  const [privacyApprove,privacyApproveAction]=useActionState(approvePrivacyAction,initial);
  const [retentionCreate,retentionCreateAction]=useActionState(createRetentionAction,initial);
  const [retentionSubmit,retentionSubmitAction]=useActionState(submitRetentionAction,initial);
  const [retentionApprove,retentionApproveAction]=useActionState(approveRetentionAction,initial);
  const [retentionActivate,retentionActivateAction]=useActionState(activateRetentionAction,initial);
  const [holdPlace,holdPlaceAction]=useActionState(placeLegalHoldAction,initial);
  const [holdRelease,holdReleaseAction]=useActionState(releaseLegalHoldAction,initial);
  const select=(name:string,items:{id:string;label:string}[])=><select name={name} required><option value="">Seleccione</option>{items.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select>;
  return <section className="space-y-6" aria-labelledby="governance-management"><h2 id="governance-management" className="text-xl font-semibold">Gestión autenticada de versiones</h2>
    <p className="text-sm text-slate-600">El operador registra evidencia externa; el sistema no representa al operador como abogado. Guardar no equivale a aprobar.</p>
    <details className="surface-card p-5"><summary className="font-semibold">Clasificaciones documentales</summary><div className="mt-4 grid gap-5 lg:grid-cols-3">
      <form action={classificationCreateAction} className="grid gap-3"><h3>Crear borrador</h3><label>Tipo<select name="documentType" required>{SIGNATURE_DOCUMENT_TYPES.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label><label>Nombre visible<input name="displayName" required /></label><label>Descripción<textarea name="description" required /></label><label>Uso permitido/condiciones<textarea name="permittedSigningUse" required /></label><Submit>Crear borrador</Submit><Result state={classificationCreate}/></form>
      <form action={classificationSubmitAction} className="grid gap-3"><h3>Enviar a revisión</h3>{select("id",drafts.classifications)}<Submit>Enviar a revisión</Submit><Result state={classificationSubmit}/></form>
      <form action={classificationApproveAction} className="grid gap-3"><h3>Registrar aprobación externa</h3>{select("id",drafts.classifications)}<ApprovalFields includeFirm/><label>Fecha de aprobación<input name="approvalDate" type="date" required /></label><label>Notas privadas<textarea name="notes" /></label><Submit>Registrar versión inmutable</Submit><Result state={classificationApprove}/></form>
    </div></details>
    <details className="surface-card p-5"><summary className="font-semibold">Consentimientos es-PR / en-US</summary><div className="mt-4 grid gap-5 lg:grid-cols-3">
      <form action={consentCreateAction} className="grid gap-3"><h3>Crear borrador</h3><label>Versión<input name="versionIdentifier" required pattern="[a-z0-9][a-z0-9._-]{0,99}" /></label><label>Idioma<select name="locale"><option>es-PR</option><option>en-US</option></select></label><label>Texto exacto<textarea name="text" minLength={20} required /></label><Submit>Crear borrador</Submit><Result state={consentCreate}/></form>
      <form action={consentSubmitAction} className="grid gap-3"><h3>Enviar a revisión</h3>{select("id",drafts.consents)}<Submit>Enviar</Submit><Result state={consentSubmit}/></form>
      <form action={consentApproveAction} className="grid gap-3"><h3>Registrar aprobación</h3>{select("id",drafts.consents)}<ApprovalFields/><Submit>Registrar versión inmutable</Submit><Result state={consentApprove}/></form>
    </div></details>
    <details className="surface-card p-5"><summary className="font-semibold">Divulgación de privacidad bilingüe</summary><div className="mt-4 grid gap-5 lg:grid-cols-3">
      <form action={privacyCreateAction} className="grid gap-3"><h3>Crear borrador</h3><label>Versión<input name="versionIdentifier" required pattern="[a-z0-9][a-z0-9._-]{0,99}" /></label><label>Texto es-PR<textarea name="esPRText" minLength={20} required /></label><label>Texto en-US<textarea name="enUSText" minLength={20} required /></label><Submit>Crear borrador</Submit><Result state={privacyCreate}/></form>
      <form action={privacySubmitAction} className="grid gap-3"><h3>Enviar a revisión</h3>{select("id",drafts.privacy)}<Submit>Enviar</Submit><Result state={privacySubmit}/></form>
      <form action={privacyApproveAction} className="grid gap-3"><h3>Registrar aprobación</h3>{select("id",drafts.privacy)}<ApprovalFields/><Submit>Registrar versión inmutable</Submit><Result state={privacyApprove}/></form>
    </div></details>
    <details className="surface-card p-5"><summary className="font-semibold">Política de retención</summary><div className="mt-4 grid gap-5 lg:grid-cols-4">
      <form action={retentionCreateAction} className="grid gap-3"><h3>Crear borrador</h3><label>Versión<input name="versionIdentifier" required /></label><label>Referencia de decisión pendiente<input name="approvalReference" required /></label><label>Referencia de privacidad<input name="privacyReference" required /></label>{["sourcePdfDays","completedPdfDays","certificateDays","evidenceManifestDays","tokenDays","sessionHours","networkEvidenceDays","failedCancelledDraftDays","auditEventDays"].map(name=><label key={name}>{name}<input name={name} type="number" min="1" /></label>)}<label><input name="completedCleanupEnabled" type="checkbox" value="true" /> Permitir limpieza de evidencia completada</label><Submit>Crear sin activar</Submit><Result state={retentionCreate}/></form>
      <form action={retentionSubmitAction} className="grid gap-3"><h3>Enviar a revisión</h3>{select("id",drafts.retention.filter(x=>x.status==="draft"))}<Submit>Enviar</Submit><Result state={retentionSubmit}/></form>
      <form action={retentionApproveAction} className="grid gap-3"><h3>Registrar aprobación</h3>{select("id",drafts.retention.filter(x=>x.status==="pending_review"))}<ApprovalFields/><Submit>Aprobar sin activar</Submit><Result state={retentionApprove}/></form>
      <form action={retentionActivateAction} className="grid gap-3"><h3>Activar por separado</h3>{select("id",drafts.retention.filter(x=>x.status==="approved"))}<label><input name="immutableAcknowledged" type="checkbox" value="true" required /> Confirmo activación separada.</label><label>Escriba <code>{GOVERNANCE_APPROVAL_PHRASE}</code><input name="confirmationPhrase" required /></label><Submit>Activar explícitamente</Submit><Result state={retentionActivate}/></form>
    </div></details>
    <details className="surface-card p-5"><summary className="font-semibold">Retenciones legales persistentes</summary><p className="mt-3 text-sm text-slate-600">Una retención activa bloquea toda limpieza del documento. Liberarla requiere una acción separada y conserva el historial.</p><div className="mt-4 grid gap-5 lg:grid-cols-2">
      <form action={holdPlaceAction} className="grid gap-3"><h3>Colocar retención</h3>{select("documentId",drafts.documents)}<label>Razón o referencia<input name="reasonReference" required /></label><label>Referencia legal externa opcional<input name="externalLegalReference" /></label><Submit>Colocar retención</Submit><Result state={holdPlace}/></form>
      <form action={holdReleaseAction} className="grid gap-3"><h3>Liberar retención</h3>{select("id",drafts.legalHolds)}<label>Referencia de liberación<input name="releaseReference" required /></label><label><input name="immutableAcknowledged" type="checkbox" value="true" required /> Confirmo que la liberación es explícita, auditable y no borra el historial.</label><label>Escriba <code>LIBERAR RETENCION LEGAL</code><input name="confirmationPhrase" required /></label><Submit>Liberar explícitamente</Submit><Result state={holdRelease}/></form>
    </div></details>
  </section>;
}
