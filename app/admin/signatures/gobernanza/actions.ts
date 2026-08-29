"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin/auth";
import { requireSuperAdmin } from "@/lib/admin/access-context";
import { createSignatureDomainRuntime } from "@/lib/signatures/runtime";
import { createSignatureGovernanceWorkflow } from "@/lib/signatures/governance-workflow";
import { parseSignatureRetentionPolicy } from "@/lib/signatures/retention-policy";
import { createSignatureLegalHoldService, type SignatureEvidenceClass } from "@/lib/signatures/legal-holds";
import { SIGNATURE_APPROVAL_MODES, type SignatureApprovalMode } from "@/lib/signatures/document-classification";
import { createSignatureRiskAcceptanceService, SIGNATURE_RECOVERY_RISKS, type SignatureRecoveryRisk } from "@/lib/signatures/risk-acceptance";
import type { SignaturePreflightLocale } from "@/lib/signatures/preflight";
import {
  authorizeProductionPublicLaunch,
  PUBLIC_LAUNCH_CONFIRMATION_PHRASE,
} from "@/lib/signatures/public-launch";

export type GovernanceActionState = Readonly<{ ok: boolean; message: string }>;

function value(data: FormData, name: string) { return String(data.get(name) ?? "").trim(); }
function checked(data: FormData, name: string) { return data.getAll(name).map(String).includes("true"); }
function approvalMode(data: FormData, allowOutOfScope: true): SignatureApprovalMode;
function approvalMode(data: FormData, allowOutOfScope?: false): Exclude<SignatureApprovalMode,"out_of_scope">;
function approvalMode(data: FormData, allowOutOfScope = false): SignatureApprovalMode {
  const mode = value(data, "approvalMode") as SignatureApprovalMode;
  if (!SIGNATURE_APPROVAL_MODES.includes(mode) || (!allowOutOfScope && mode === "out_of_scope")) {
    throw new Error("signature_governance_approval_mode_invalid");
  }
  return mode;
}
function date(data: FormData, name: string) {
  const result = new Date(value(data, name));
  if (!Number.isFinite(result.getTime())) throw new Error("signature_governance_date_invalid");
  return result;
}
function numberOrNull(data: FormData, name: string) {
  const raw = value(data, name);
  if (!raw) return null;
  const result = Number(raw);
  if (!Number.isInteger(result)) throw new Error("signature_governance_number_invalid");
  return result;
}
async function context() {
  await requireSuperAdmin();
  const session = await getAdminSession();
  if (!session) throw new Error("signature_governance_unauthorized");
  return { session, workflow: createSignatureGovernanceWorkflow(createSignatureDomainRuntime().database) };
}
function refresh() { revalidatePath("/admin/signatures/gobernanza"); }
async function run(operation: () => Promise<unknown>, success: string): Promise<GovernanceActionState> {
  try { await operation(); refresh(); return { ok: true, message: success }; }
  catch (error) {
    const code = error instanceof Error ? error.message : "signature_governance_rejected";
    const messages: Record<string,string> = {
      signature_governance_confirmation_required: "Confirma la inmutabilidad y escribe la frase indicada.",
      signature_governance_approval_source_incomplete: "Indica el rol y la fuente de la aprobación.",
      signature_governance_external_approval_incomplete: "Completa el revisor y la evidencia de la revisión externa.",
      signature_governance_approval_mode_invalid: "Selecciona un modo de aprobación válido.",
      signature_governance_locale_invalid: "Selecciona un idioma permitido.",
      signature_governance_date_invalid: "Escribe una fecha válida.",
      signature_governance_number_invalid: "Revisa las duraciones de la política.",
      signature_high_formality_internal_approval_blocked: "Esta categoría no puede aprobarse por la vía interna ordinaria. Selecciona revisión externa o fuera de alcance.",
      signature_consent_hash_mismatch: "El texto del consentimiento cambió o su hash no coincide. Crea una nueva versión íntegra.",
      signature_privacy_hash_mismatch: "El texto de privacidad cambió o su hash no coincide. Crea una nueva versión íntegra.",
      signature_retention_hash_mismatch: "La política no coincide con su hash. Crea una nueva versión.",
      signature_risk_confirmation_required: "Confirma el alcance y escribe la frase exacta de aceptación de riesgo.",
      signature_risk_scope_invalid: "La decisión de riesgo necesita descripción, evidencia y expiración válida de hasta 90 días.",
      signature_production_canary_confirmation_required: "Marca la confirmación y escribe AUTORIZAR CANARY INTERNO.",
      signature_production_canary_scope_invalid: "El alcance del canary no es válido.",
      signature_public_launch_confirmation_required: `Marca la confirmación y escribe ${PUBLIC_LAUNCH_CONFIRMATION_PHRASE}.`,
      signature_public_launch_flag_must_be_off: "La firma pública debe permanecer apagada mientras se registra la autorización.",
      signature_public_launch_already_authorized: "Ya existe una autorización pública activa.",
    };
    if(code.startsWith("signature_preflight_blocked:")) {
      const blockers=code.slice(code.indexOf(":")+1).split(",");
      const guidance:Record<string,string>={classification_missing:"falta una clasificación aprobada; ve a Clasificaciones",privacy_missing:"falta privacidad aprobada; ve a Divulgación de privacidad",retention_missing:"falta una política activa; ve a Política de retención",neon_restore_unproven:"falta prueba o aceptación vigente del riesgo Neon",r2_independent_recovery_unproven:"falta prueba o aceptación vigente del riesgo R2",participant_scope_mismatch:"los correos no coinciden exactamente con el documento",locale_scope_invalid:"el locale no es válido",authorization_expiration_invalid:"la expiración debe ser futura y de hasta 24 horas"};
      return {ok:false,message:`No puedes autorizar este canary: ${blockers.map((blocker)=>guidance[blocker]??"hay un control obligatorio pendiente").join("; ")}.`};
    }
    if(code.startsWith("signature_public_launch_readiness_blocked:")) {
      const blockers=code.slice(code.indexOf(":")+1).split(",").filter(Boolean);
      return {ok:false,message:`El lanzamiento público permanece bloqueado: ${blockers.join(", ")}.`};
    }
    return { ok: false, message: messages[code] ?? "El cambio fue rechazado de forma segura. Revisa el estado y los datos." };
  }
}

export async function createClassificationAction(_: GovernanceActionState, data: FormData) {
  return run(async () => {
    const { session, workflow } = await context();
    await workflow.createClassificationDraft({ documentType: value(data,"documentType"), displayName: value(data,"displayName"),
      description: value(data,"description"), permittedSigningUse: value(data,"permittedSigningUse"),
      actorAdminId: session.id, idempotencyKey: randomUUID() });
  }, "Borrador de clasificación creado.");
}
export async function submitClassificationAction(_: GovernanceActionState, data: FormData) {
  return run(async () => { const { session, workflow } = await context(); await workflow.submitClassification({ id: value(data,"id"), actorAdminId: session.id, idempotencyKey: randomUUID() }); }, "Clasificación enviada a revisión interna o externa.");
}
export async function approveClassificationAction(_: GovernanceActionState, data: FormData) {
  return run(async () => {
    const { session, workflow } = await context();
    await workflow.approveClassification({ id: value(data,"id"), approvalMode: approvalMode(data, true),
      approverRole: value(data,"approverRole"), externalReviewerName: value(data,"externalReviewerName"),
      externalReviewerOrganization: value(data,"externalReviewerOrganization"), externalReviewerRole: value(data,"externalReviewerRole"),
      approvalReference: value(data,"approvalReference"), externalReviewerReference: value(data,"externalReviewerReference"), approvalDate: value(data,"approvalDate"),
      effectiveFrom: date(data,"effectiveFrom"), notes: value(data,"notes"), actorAdminId: session.id,
      confirmationPhrase: value(data,"confirmationPhrase"), immutableAcknowledged: checked(data,"immutableAcknowledged"), idempotencyKey: randomUUID() });
  }, "Decisión de clasificación registrada como versión inmutable.");
}
export async function createConsentAction(_: GovernanceActionState, data: FormData) {
  return run(async () => { const { session, workflow } = await context(); const locale=value(data,"locale");
    if (locale!=="es-PR" && locale!=="en-US") throw new Error("signature_governance_locale_invalid");
    await workflow.createConsentDraft({ versionIdentifier:value(data,"versionIdentifier"), locale, text:value(data,"text"), actorAdminId:session.id, idempotencyKey:randomUUID() });
  }, "Borrador de consentimiento creado.");
}
export async function submitConsentAction(_: GovernanceActionState, data: FormData) {
  return run(async () => { const {session,workflow}=await context(); await workflow.submitConsent({id:value(data,"id"),actorAdminId:session.id,idempotencyKey:randomUUID()}); }, "Consentimiento enviado a revisión.");
}
export async function approveConsentAction(_: GovernanceActionState, data: FormData) {
  return run(async () => { const {session,workflow}=await context(); await workflow.approveConsent({id:value(data,"id"),approvalMode:approvalMode(data),approverRole:value(data,"approverRole"),approvalReference:value(data,"approvalReference"),externalReviewerName:value(data,"externalReviewerName"),externalReviewerReference:value(data,"externalReviewerReference"),effectiveFrom:date(data,"effectiveFrom"),actorAdminId:session.id,confirmationPhrase:value(data,"confirmationPhrase"),immutableAcknowledged:checked(data,"immutableAcknowledged"),idempotencyKey:randomUUID()}); }, "Consentimiento aprobado registrado de forma inmutable.");
}
export async function createPrivacyAction(_: GovernanceActionState, data: FormData) {
  return run(async () => { const {session,workflow}=await context(); await workflow.createPrivacyDraft({versionIdentifier:value(data,"versionIdentifier"),esPRText:value(data,"esPRText"),enUSText:value(data,"enUSText"),actorAdminId:session.id,idempotencyKey:randomUUID()}); }, "Borrador bilingüe de privacidad creado.");
}
export async function submitPrivacyAction(_: GovernanceActionState, data: FormData) {
  return run(async () => { const {session,workflow}=await context(); await workflow.submitPrivacy({id:value(data,"id"),actorAdminId:session.id,idempotencyKey:randomUUID()}); }, "Divulgación enviada a revisión.");
}
export async function approvePrivacyAction(_: GovernanceActionState, data: FormData) {
  return run(async () => { const {session,workflow}=await context(); await workflow.approvePrivacy({id:value(data,"id"),approvalMode:approvalMode(data),approverRole:value(data,"approverRole"),approvalReference:value(data,"approvalReference"),externalReviewerName:value(data,"externalReviewerName"),externalReviewerReference:value(data,"externalReviewerReference"),effectiveFrom:date(data,"effectiveFrom"),actorAdminId:session.id,confirmationPhrase:value(data,"confirmationPhrase"),immutableAcknowledged:checked(data,"immutableAcknowledged"),idempotencyKey:randomUUID()}); }, "Divulgación aprobada registrada de forma inmutable.");
}
export async function createRetentionAction(_: GovernanceActionState, data: FormData) {
  return run(async () => {
    const {session,workflow}=await context();
    const version=value(data,"versionIdentifier");
    const approvalReference=value(data,"approvalReference");
    const privacyReference=value(data,"privacyReference");
    const policy=parseSignatureRetentionPolicy(JSON.stringify({version,approvalReference,privacyReference,
      sourcePdfDays:numberOrNull(data,"sourcePdfDays"),completedPdfDays:numberOrNull(data,"completedPdfDays"),
      certificateDays:numberOrNull(data,"certificateDays"),evidenceManifestDays:numberOrNull(data,"evidenceManifestDays"),
      tokenDays:numberOrNull(data,"tokenDays"),sessionHours:numberOrNull(data,"sessionHours"),
      networkEvidenceDays:numberOrNull(data,"networkEvidenceDays"),failedCancelledDraftDays:numberOrNull(data,"failedCancelledDraftDays"),
      auditEventDays:numberOrNull(data,"auditEventDays"),completedCleanupEnabled:checked(data,"completedCleanupEnabled")}));
    await workflow.createRetentionDraft({versionIdentifier:version,privacyReference,policy,actorAdminId:session.id,idempotencyKey:randomUUID()});
  }, "Borrador de retención creado; no se activó limpieza.");
}
export async function submitRetentionAction(_: GovernanceActionState, data: FormData) {
  return run(async () => { const {session,workflow}=await context(); await workflow.submitRetention({id:value(data,"id"),actorAdminId:session.id,idempotencyKey:randomUUID()}); }, "Política enviada a revisión.");
}
export async function approveRetentionAction(_: GovernanceActionState, data: FormData) {
  return run(async () => { const {session,workflow}=await context(); await workflow.approveRetention({id:value(data,"id"),approvalMode:approvalMode(data),approverRole:value(data,"approverRole"),approvalReference:value(data,"approvalReference"),externalReviewerName:value(data,"externalReviewerName"),externalReviewerReference:value(data,"externalReviewerReference"),actorAdminId:session.id,confirmationPhrase:value(data,"confirmationPhrase"),immutableAcknowledged:checked(data,"immutableAcknowledged"),idempotencyKey:randomUUID()}); }, "Política aprobada; todavía no activa.");
}
export async function activateRetentionAction(_: GovernanceActionState, data: FormData) {
  return run(async () => { const {session,workflow}=await context(); await workflow.activateRetention({id:value(data,"id"),actorAdminId:session.id,confirmationPhrase:value(data,"confirmationPhrase"),immutableAcknowledged:checked(data,"immutableAcknowledged"),idempotencyKey:randomUUID()}); }, "Política activada explícitamente.");
}
export async function placeLegalHoldAction(_: GovernanceActionState,data:FormData) {
  return run(async()=>{const {session}=await context();const runtime=createSignatureDomainRuntime();
    await createSignatureLegalHoldService(runtime.database).place({scopeType:"document",documentId:value(data,"documentId"),evidenceClasses:[] as SignatureEvidenceClass[],reasonReference:value(data,"reasonReference"),externalLegalReference:value(data,"externalLegalReference"),actorAdminId:session.id,idempotencyKey:randomUUID()});
  },"Retención legal activa registrada de forma auditable.");
}
export async function releaseLegalHoldAction(_:GovernanceActionState,data:FormData) {
  return run(async()=>{if(!checked(data,"immutableAcknowledged")||value(data,"confirmationPhrase")!=="LIBERAR RETENCION LEGAL") throw new Error("signature_legal_hold_release_confirmation_required");const {session}=await context();const runtime=createSignatureDomainRuntime();
    await createSignatureLegalHoldService(runtime.database).release({id:value(data,"id"),releaseReference:value(data,"releaseReference"),actorAdminId:session.id,idempotencyKey:randomUUID()});
  },"Liberación explícita registrada; el historial permanece inmutable.");
}

export async function acceptRecoveryRiskAction(_:GovernanceActionState,data:FormData) {
  return run(async()=>{const {session}=await context();const risk=value(data,"riskCode") as SignatureRecoveryRisk;
    if(!SIGNATURE_RECOVERY_RISKS.includes(risk)) throw new Error("signature_risk_scope_invalid");
    await createSignatureRiskAcceptanceService(createSignatureDomainRuntime().database).acceptForInternalCanary({
      riskCode:risk,residualRisk:value(data,"residualRisk"),evidenceReference:value(data,"evidenceReference"),
      expiresAt:date(data,"expiresAt"),actorAdminId:session.id,confirmationPhrase:value(data,"confirmationPhrase"),
      explicitConfirmation:checked(data,"explicitConfirmation"),idempotencyKey:randomUUID()});
  },"Aceptación de riesgo registrada únicamente para canary interno; no aplica al lanzamiento público.");
}

export async function authorizeInternalCanaryAction(_:GovernanceActionState,data:FormData) {
  return run(async()=>{const {session,workflow}=await context();const locale=value(data,"locale") as SignaturePreflightLocale;
    if(locale!=="es-PR"&&locale!=="en-US") throw new Error("signature_governance_locale_invalid");
    const emails=value(data,"participantEmails").split(",").map((email)=>email.trim()).filter(Boolean);
    await workflow.authorizeProductionCanary({documentId:value(data,"documentId"),participantEmails:emails,
      documentTypes:[value(data,"documentType")],locales:[locale],expiresAt:date(data,"expiresAt"),notes:value(data,"notes"),
      actorAdminId:session.id,explicitConfirmation:checked(data,"explicitConfirmation"),confirmationPhrase:value(data,"confirmationPhrase"),idempotencyKey:randomUUID()});
  },"Canary interno autorizado con alcance exacto; continúa desactivado hasta la acción separada de despliegue.");
}

export async function revokeInternalCanaryAction(_:GovernanceActionState,data:FormData) {
  return run(async()=>{const {session,workflow}=await context();await workflow.revokeProductionCanary({id:value(data,"id"),actorAdminId:session.id,explicitConfirmation:checked(data,"explicitConfirmation"),idempotencyKey:randomUUID()});},"Autorización revocada. La evidencia permanece inmutable.");
}

export async function authorizePublicLaunchAction(_:GovernanceActionState,data:FormData) {
  return run(async()=>{const {session}=await context();const runtime=createSignatureDomainRuntime();
    await authorizeProductionPublicLaunch({database:runtime.database,actorAdminId:session.id,
      explicitConfirmation:checked(data,"explicitConfirmation"),confirmationPhrase:value(data,"confirmationPhrase"),
      notes:value(data,"notes")});
  },"Autorización pública y snapshot canónico registrados. La bandera pública permanece desactivada.");
}
