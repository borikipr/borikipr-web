"use client";

import { useActionState, useState } from "react";
import { GOVERNANCE_APPROVAL_PHRASE, RETENTION_ACTIVATION_PHRASE } from "@/lib/signatures/governance-constants";
import { INTERNAL_CANARY_CONFIRMATION_PHRASE, RISK_ACCEPTANCE_CONFIRMATION_PHRASE } from "@/lib/signatures/preflight-constants";
import { SIGNATURE_DOCUMENT_TYPES, type SignatureApprovalMode } from "@/lib/signatures/document-classification";
import { PUBLIC_LAUNCH_CONFIRMATION_PHRASE } from "@/lib/signatures/public-launch-constants";
import {
  activateRetentionAction, approveClassificationAction, approveConsentAction,
  approvePrivacyAction, approveRetentionAction, createClassificationAction,
  createConsentAction, createPrivacyAction, createRetentionAction,
  placeLegalHoldAction, releaseLegalHoldAction, submitClassificationAction,
  submitConsentAction, submitPrivacyAction, submitRetentionAction, acceptRecoveryRiskAction,
  authorizeInternalCanaryAction, authorizePublicLaunchAction, revokeInternalCanaryAction,
  type GovernanceActionState,
} from "./actions";

const initial: GovernanceActionState = { ok: false, message: "" };

function Submit({ children }: { children: React.ReactNode }) {
  return <button className="btn-primary justify-center text-center" type="submit">{children}</button>;
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
    <label className="flex items-start gap-2"><input name="immutableAcknowledged" type="checkbox" value="true" required /><span>Confirmo que la fuente indicada respalda esta decisión y que la versión aprobada no podrá editarse.</span></label>
    <label>Escriba <code>{GOVERNANCE_APPROVAL_PHRASE}</code><input name="confirmationPhrase" required /></label>
  </>;
}

type Option = { id: string; label: string; status?: string; reviewText?:string; reviewHash?:string };
type CanaryDocumentOption = Option & { documentType:string; participantEmails:readonly string[] };
type Drafts = {
  classifications: Option[];
  consents: Option[];
  privacy: Option[];
  retention: (Option & { status: string })[];
  documents: CanaryDocumentOption[];
  legalHolds: Option[];
  launchAuthorizations: Option[];
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
  const [riskAcceptance, riskAcceptanceAction] = useActionState(acceptRecoveryRiskAction, initial);
  const [canaryAuthorization, canaryAuthorizationAction] = useActionState(authorizeInternalCanaryAction, initial);
  const [canaryRevocation, canaryRevocationAction] = useActionState(revokeInternalCanaryAction, initial);
  const [publicAuthorization, publicAuthorizationAction] = useActionState(authorizePublicLaunchAction, initial);
  const select = (name: string, items: Option[]) => <select name={name} required><option value="">Seleccione</option>{items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>;

  const workflowGrid = "mt-4 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3";
  const formClass = "grid min-w-0 max-w-full content-start gap-3 rounded-2xl border border-slate-200 p-4";
  const managementSection = "border-t border-slate-200 pt-5 first:border-t-0 first:pt-0";

  return <section className="signature-governance min-w-0 max-w-full space-y-6" aria-labelledby="governance-management">
    <h2 id="governance-management" className="text-xl font-semibold">Gestión autenticada de versiones</h2>
    <p className="text-sm text-slate-600">La aprobación interna es la ruta normal para documentos ordinarios del corretaje. La revisión externa es opcional, salvo que el alcance específico exija otra formalidad. Guardar no equivale a aprobar.</p>

    <details className="surface-card min-w-0 max-w-full overflow-hidden"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden"><span>Versiones y políticas</span><span aria-hidden="true" className="text-lg text-slate-500">+</span></summary><div className="space-y-6 border-t border-slate-100 p-5"><p className="text-sm text-slate-600">Crea, revisa y aprueba versiones antes de que puedan usarse. Estas acciones conservan sus confirmaciones y controles de servidor.</p>
    <section className={managementSection}><h3 className="font-semibold">Clasificaciones de documentos</h3><div className={workflowGrid}>
      <form action={classificationCreateAction} className={formClass}><h3>1. Crear borrador</h3><label>Tipo<select name="documentType" required>{SIGNATURE_DOCUMENT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Nombre visible<input name="displayName" required /></label><label>Descripción<textarea name="description" required /></label><label>Uso permitido y condiciones<textarea name="permittedSigningUse" required /></label><Submit>Crear borrador</Submit><Result state={classificationCreate} /></form>
      <form action={classificationSubmitAction} className={formClass}><h3>2. Enviar a revisión</h3>{select("id", drafts.classifications.filter((item) => item.status === "draft"))}<Submit>Enviar a revisión</Submit><Result state={classificationSubmit} /></form>
      <form action={classificationApproveAction} className={formClass}><h3>3. Registrar decisión</h3>{select("id", drafts.classifications.filter((item) => item.status === "pending"))}<p className="rounded-lg bg-amber-50 p-3 text-sm">Revisa nombre, clasificación, uso permitido, exclusiones, versión y hash antes de aprobar. La aprobación interna autoriza uso operacional en Erickson Real Estate; no constituye asesoría legal, notarización ni autorización para documentos de cierre.</p><ApprovalFields allowOutOfScope includeOrganization /><label>Fecha de decisión<input name="approvalDate" type="date" required /></label><label>Notas internas opcionales<textarea name="notes" /></label><Submit>Registrar versión inmutable</Submit><Result state={classificationApprove} /></form>
    </div></section>

    <section className={managementSection}><h3 className="font-semibold">Consentimientos es-PR / en-US</h3><p className="mt-2 text-sm text-slate-600">Cree una versión por idioma. Un canary sólo en español exige es-PR; en-US se exige únicamente cuando participe una persona en inglés.</p><div className={workflowGrid}>
      <form action={consentCreateAction} className={formClass}><h3>1. Crear borrador</h3><label>Versión<input name="versionIdentifier" required pattern="[a-z0-9][a-z0-9._-]{0,99}" /></label><label>Idioma<select name="locale"><option>es-PR</option><option>en-US</option></select></label><label>Texto exacto<textarea name="text" minLength={20} required /></label><Submit>Crear borrador</Submit><Result state={consentCreate} /></form>
      <form action={consentSubmitAction} className={formClass}><h3>2. Enviar a revisión</h3>{select("id", drafts.consents.filter((item) => item.status === "draft"))}<Submit>Enviar</Submit><Result state={consentSubmit} /></form>
      <form action={consentApproveAction} className={formClass}><h3>3. Registrar aprobación</h3>{select("id", drafts.consents.filter((item) => item.status === "pending_review"))}<p className="text-sm text-slate-600">Revisa abajo el texto exacto, locale, versión y hash. El servidor vuelve a calcular el hash antes de aprobar.</p><ApprovalFields /><Submit>Registrar versión inmutable</Submit><Result state={consentApprove} /></form>
    </div></section>

    {drafts.consents.filter((item)=>item.status==="pending_review").map((item)=><article className={`${managementSection} rounded-xl bg-slate-50 p-4`} key={`consent-review-${item.id}`}><h3 className="font-semibold">Revisión pendiente: {item.label}</h3><p className="mt-3 whitespace-pre-wrap text-sm">{item.reviewText}</p><p className="mt-3 break-all font-mono text-xs">SHA-256: {item.reviewHash}</p></article>)}

    <section className={managementSection}><h3 className="font-semibold">Divulgación de privacidad bilingüe</h3><p className="mt-2 text-sm text-slate-600">El registro conserva ambos textos, hashes, referencia y fecha efectiva como un snapshot inmutable. Cada firmante ve el texto de su idioma y la evidencia queda ligada a esta versión exacta.</p><div className={workflowGrid}>
      <form action={privacyCreateAction} className={formClass}><h3>1. Crear borrador</h3><label>Versión<input name="versionIdentifier" required pattern="[a-z0-9][a-z0-9._-]{0,99}" /></label><label>Texto es-PR<textarea name="esPRText" minLength={20} required /></label><label>Texto en-US<textarea name="enUSText" minLength={20} required /></label><Submit>Crear borrador</Submit><Result state={privacyCreate} /></form>
      <form action={privacySubmitAction} className={formClass}><h3>2. Enviar a revisión</h3>{select("id", drafts.privacy.filter((item) => item.status === "draft"))}<Submit>Enviar</Submit><Result state={privacySubmit} /></form>
      <form action={privacyApproveAction} className={formClass}><h3>3. Registrar aprobación</h3>{select("id", drafts.privacy.filter((item) => item.status === "pending_review"))}<p className="text-sm text-slate-600">Revisa el texto bilingüe exacto y ambos hashes. El snapshot aprobado será inmutable y quedará ligado a la evidencia.</p><ApprovalFields /><Submit>Registrar versión inmutable</Submit><Result state={privacyApprove} /></form>
    </div></section>

    {drafts.privacy.filter((item)=>item.status==="pending_review").map((item)=><article className={`${managementSection} rounded-xl bg-slate-50 p-4`} key={`privacy-review-${item.id}`}><h3 className="font-semibold">Revisión pendiente: {item.label}</h3><p className="mt-3 whitespace-pre-wrap text-sm">{item.reviewText}</p><p className="mt-3 break-all font-mono text-xs">Hashes: {item.reviewHash}</p></article>)}

    <section className={managementSection}><h3 className="font-semibold">Política de retención</h3><p className="mt-2 text-sm text-slate-600">Defina valores revisados por el negocio, apruebe la versión y actívela en un paso separado. Sin política activa no se elimina evidencia; una retención legal siempre prevalece.</p><div className="mt-4 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
      <form action={retentionCreateAction} className={formClass}><h3>1. Crear borrador</h3><label>Versión<input name="versionIdentifier" required /></label><label>Referencia de decisión pendiente<input name="approvalReference" required /></label><label>Referencia de privacidad<input name="privacyReference" required /></label>{[
        ["sourcePdfDays","Documento fuente (días)","PDF original cargado antes de la firma."],
        ["completedPdfDays","PDF final (días)","Documento completado y firmado."],
        ["certificateDays","Certificado (días)","Certificado de evidencia generado al completar."],
        ["evidenceManifestDays","Manifest/evidencia (días)","Registro estructurado de integridad y evidencia."],
        ["tokenDays","Tokens/digests (días)","Evidencia no plaintext de credenciales de acceso."],
        ["sessionHours","Sesiones (horas)","Registros temporales de sesión del firmante."],
        ["networkEvidenceDays","Network digests (días)","Metadatos de red protegidos mediante digest."],
        ["failedCancelledDraftDays","Borradores abandonados (días)","Solicitudes no completadas, fallidas o canceladas."],
        ["auditEventDays","Eventos de auditoría (días)","Historial inmutable de firma y gobernanza."],
      ].map(([name,label,help]) => <label key={name}>{label}<span className="mt-1 block text-xs font-normal text-slate-500">{help}</span><input name={name} type="number" min="1" /></label>)}<label className="flex items-start gap-2"><input name="completedCleanupEnabled" type="checkbox" value="true" /> <span>Permitir limpieza de evidencia completada sólo según esta política</span></label><Submit>Crear sin activar</Submit><Result state={retentionCreate} /></form>
      <form action={retentionSubmitAction} className={formClass}><h3>2. Enviar a revisión</h3>{select("id", drafts.retention.filter((item) => item.status === "draft"))}<Submit>Enviar</Submit><Result state={retentionSubmit} /></form>
      <form action={retentionApproveAction} className={formClass}><h3>3. Registrar aprobación</h3>{select("id", drafts.retention.filter((item) => item.status === "pending_review"))}<ApprovalFields /><Submit>Aprobar sin activar</Submit><Result state={retentionApprove} /></form>
      <form action={retentionActivateAction} className={formClass}><h3>4. Activar por separado</h3>{select("id", drafts.retention.filter((item) => item.status === "approved"))}<p className="rounded-lg bg-amber-50 p-3 text-sm">La activación ejecuta preview, valida hash y retenciones legales. No ejecuta limpieza.</p><label className="flex items-start gap-2"><input name="immutableAcknowledged" type="checkbox" value="true" required /> <span>Confirmo que revisé la política exacta y su preview.</span></label><label>Escriba <code>{RETENTION_ACTIVATION_PHRASE}</code><input name="confirmationPhrase" required /></label><Submit>Activar explícitamente</Submit><Result state={retentionActivate} /></form>
    </div></section></div></details>

    <details className="surface-card min-w-0 max-w-full overflow-hidden"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden"><span>Acciones sensibles</span><span aria-hidden="true" className="text-lg text-slate-500">+</span></summary><div className="space-y-6 border-t border-slate-100 p-5"><p className="text-sm text-slate-600">Estas operaciones afectan autorizaciones, conservación o excepciones. Permanecen cerradas para evitar cambios accidentales.</p>
    <section className={managementSection}><h3 className="font-semibold">Decisiones de recuperación — aceptación acotada</h3><p className="mt-2 text-sm text-slate-600">Una aceptación sólo puede cubrir un canary interno, expira y nunca cuenta como prueba para lanzamiento público.</p><form action={riskAcceptanceAction} className={`${formClass} mt-4`}><label>Riesgo<select name="riskCode" required><option value="neon_restore_unproven">Neon recovery: NO PROBADO</option><option value="r2_independent_recovery_unproven">R2 independiente: NO PROBADO</option></select></label><label>Riesgo residual exacto<textarea name="residualRisk" minLength={20} required /></label><label>Evidencia o referencia<input name="evidenceReference" required /></label><label>Expira / revisar antes de<input name="expiresAt" type="datetime-local" required /></label><label className="flex items-start gap-2"><input name="explicitConfirmation" type="checkbox" value="true" required /><span>Acepto este riesgo solamente para un canary interno y por el plazo indicado.</span></label><label>Escriba <code>{RISK_ACCEPTANCE_CONFIRMATION_PHRASE}</code><input name="confirmationPhrase" required/></label><Submit>Registrar decisión inmutable</Submit><Result state={riskAcceptance} /></form></section>

    <section className={managementSection}><h3 className="font-semibold">Autorización — CANARY INTERNO</h3><p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold">Prueba interna controlada — NO disponible para clientes. Autorizar no activa el flag.</p><form action={canaryAuthorizationAction} className={`${formClass} mt-4`}><label>Documento preparado<select name="documentId" required><option value="">Seleccione</option>{drafts.documents.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Clasificación exacta<select name="documentType" required>{SIGNATURE_DOCUMENT_TYPES.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Locale exacto<select name="locale" required><option value="es-PR">es-PR</option><option value="en-US">en-US</option></select></label><label>Correos exactos separados por coma<textarea name="participantEmails" placeholder="persona-interna@example.test" required /></label><p className="text-xs text-slate-600">No se permiten comodines, dominios completos ni alcance implícito. El servidor compara exactamente contra el documento.</p><label>Expiración (máximo 24 horas)<input name="expiresAt" type="datetime-local" required /></label><label>Notas opcionales<textarea name="notes" /></label><label className="flex items-start gap-2"><input name="explicitConfirmation" type="checkbox" value="true" required /><span>Confirmo el documento, participantes, locale, expiración y readiness hash. READY no equivale a ENABLED.</span></label><label>Escriba <code>{INTERNAL_CANARY_CONFIRMATION_PHRASE}</code><input name="confirmationPhrase" required /></label><Submit>Autorizar canary interno</Submit><Result state={canaryAuthorization} /></form>{drafts.launchAuthorizations.length>0&&<form action={canaryRevocationAction} className={`${formClass} mt-4`}><h3>Revocar autorización</h3>{select("id",drafts.launchAuthorizations)}<label className="flex items-start gap-2"><input name="explicitConfirmation" type="checkbox" value="true" required /><span>Confirmo la revocación; la evidencia histórica permanecerá.</span></label><Submit>Revocar autorización</Submit><Result state={canaryRevocation} /></form>}<p className="mt-4 text-sm"><strong>Canary interno: Desactivado.</strong> La activación es una acción separada de configuración del despliegue.</p></section>

    <section className={managementSection}><h3 className="font-semibold">Autorización — LANZAMIENTO PÚBLICO</h3><p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">Registra un snapshot global de clasificaciones ordinarias, consentimiento es-PR, privacidad, retención, recuperación e integridad. Autorizar no activa la bandera pública.</p><form action={publicAuthorizationAction} className={`${formClass} mt-4`}><label>Notas de lanzamiento opcionales<textarea name="notes" /></label><label className="flex items-start gap-2"><input name="explicitConfirmation" type="checkbox" value="true" required /><span>Confirmo que revisé el readiness canónico y que esta acción no activa todavía la firma pública.</span></label><label>Escriba <code>{PUBLIC_LAUNCH_CONFIRMATION_PHRASE}</code><input name="confirmationPhrase" required /></label><Submit>Registrar autorización pública</Submit><Result state={publicAuthorization} /></form></section>

    <section className={managementSection}><h3 className="font-semibold">Retenciones legales persistentes</h3><p className="mt-3 text-sm text-slate-600">Una retención activa bloquea toda limpieza del documento. Liberarla requiere una acción separada y conserva el historial.</p><div className="mt-4 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
      <form action={holdPlaceAction} className={formClass}><h3>Colocar retención</h3>{select("documentId", drafts.documents)}<label>Razón o referencia<input name="reasonReference" required /></label><label>Referencia legal externa opcional<input name="externalLegalReference" /></label><Submit>Colocar retención</Submit><Result state={holdPlace} /></form>
      <form action={holdReleaseAction} className={formClass}><h3>Liberar retención</h3>{select("id", drafts.legalHolds)}<label>Referencia de liberación<input name="releaseReference" required /></label><label className="flex items-start gap-2"><input name="immutableAcknowledged" type="checkbox" value="true" required /> <span>Confirmo que la liberación es explícita, auditable y no borra el historial.</span></label><label>Escriba <code>LIBERAR RETENCION LEGAL</code><input name="confirmationPhrase" required /></label><Submit>Liberar explícitamente</Submit><Result state={holdRelease} /></form>
    </div></section></div></details>

  </section>;
}
