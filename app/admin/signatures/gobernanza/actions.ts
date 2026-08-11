"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin/auth";
import { createSignatureDomainRuntime } from "@/lib/signatures/runtime";
import { createSignatureGovernanceWorkflow } from "@/lib/signatures/governance-workflow";
import { parseSignatureRetentionPolicy } from "@/lib/signatures/retention-policy";

export type GovernanceActionState = Readonly<{ ok: boolean; message: string }>;

function value(data: FormData, name: string) { return String(data.get(name) ?? "").trim(); }
function checked(data: FormData, name: string) { return data.getAll(name).map(String).includes("true"); }
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
  const session = await getAdminSession();
  if (!session) throw new Error("signature_governance_unauthorized");
  return { session, workflow: createSignatureGovernanceWorkflow(createSignatureDomainRuntime().database) };
}
function refresh() { revalidatePath("/admin/signatures/gobernanza"); }
async function run(operation: () => Promise<unknown>, success: string): Promise<GovernanceActionState> {
  try { await operation(); refresh(); return { ok: true, message: success }; }
  catch (error) {
    const code = error instanceof Error ? error.message : "signature_governance_rejected";
    return { ok: false, message: `Cambio rechazado de forma segura (${code}).` };
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
  return run(async () => { const { session, workflow } = await context(); await workflow.submitClassification({ id: value(data,"id"), actorAdminId: session.id, idempotencyKey: randomUUID() }); }, "Clasificación enviada a revisión externa.");
}
export async function approveClassificationAction(_: GovernanceActionState, data: FormData) {
  return run(async () => {
    const { session, workflow } = await context();
    await workflow.approveClassification({ id: value(data,"id"), counselName: value(data,"externalReviewerName"),
      counselLawFirm: value(data,"counselLawFirm"), approvalReference: value(data,"approvalReference"),
      sourceReference: value(data,"externalReviewerReference"), approvalDate: value(data,"approvalDate"),
      effectiveFrom: date(data,"effectiveFrom"), notes: value(data,"notes"), actorAdminId: session.id,
      confirmationPhrase: value(data,"confirmationPhrase"), immutableAcknowledged: checked(data,"immutableAcknowledged"), idempotencyKey: randomUUID() });
  }, "Aprobación externa registrada como versión inmutable.");
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
  return run(async () => { const {session,workflow}=await context(); await workflow.approveConsent({id:value(data,"id"),approvalReference:value(data,"approvalReference"),externalReviewerName:value(data,"externalReviewerName"),externalReviewerReference:value(data,"externalReviewerReference"),effectiveFrom:date(data,"effectiveFrom"),actorAdminId:session.id,confirmationPhrase:value(data,"confirmationPhrase"),immutableAcknowledged:checked(data,"immutableAcknowledged"),idempotencyKey:randomUUID()}); }, "Consentimiento aprobado registrado de forma inmutable.");
}
export async function createPrivacyAction(_: GovernanceActionState, data: FormData) {
  return run(async () => { const {session,workflow}=await context(); await workflow.createPrivacyDraft({versionIdentifier:value(data,"versionIdentifier"),esPRText:value(data,"esPRText"),enUSText:value(data,"enUSText"),actorAdminId:session.id,idempotencyKey:randomUUID()}); }, "Borrador bilingüe de privacidad creado.");
}
export async function submitPrivacyAction(_: GovernanceActionState, data: FormData) {
  return run(async () => { const {session,workflow}=await context(); await workflow.submitPrivacy({id:value(data,"id"),actorAdminId:session.id,idempotencyKey:randomUUID()}); }, "Divulgación enviada a revisión.");
}
export async function approvePrivacyAction(_: GovernanceActionState, data: FormData) {
  return run(async () => { const {session,workflow}=await context(); await workflow.approvePrivacy({id:value(data,"id"),approvalReference:value(data,"approvalReference"),externalReviewerName:value(data,"externalReviewerName"),externalReviewerReference:value(data,"externalReviewerReference"),effectiveFrom:date(data,"effectiveFrom"),actorAdminId:session.id,confirmationPhrase:value(data,"confirmationPhrase"),immutableAcknowledged:checked(data,"immutableAcknowledged"),idempotencyKey:randomUUID()}); }, "Divulgación aprobada registrada de forma inmutable.");
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
  return run(async () => { const {session,workflow}=await context(); await workflow.approveRetention({id:value(data,"id"),approvalReference:value(data,"approvalReference"),externalReviewerName:value(data,"externalReviewerName"),externalReviewerReference:value(data,"externalReviewerReference"),actorAdminId:session.id,confirmationPhrase:value(data,"confirmationPhrase"),immutableAcknowledged:checked(data,"immutableAcknowledged"),idempotencyKey:randomUUID()}); }, "Política aprobada; todavía no activa.");
}
export async function activateRetentionAction(_: GovernanceActionState, data: FormData) {
  return run(async () => { const {session,workflow}=await context(); await workflow.activateRetention({id:value(data,"id"),actorAdminId:session.id,confirmationPhrase:value(data,"confirmationPhrase"),immutableAcknowledged:checked(data,"immutableAcknowledged"),idempotencyKey:randomUUID()}); }, "Política activada explícitamente.");
}
