"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/auth";
import { requireModuleAccess } from "@/lib/admin/access-context";
import {
  createSignatureAdminRepository,
  type SignatureDraftDetail,
} from "@/lib/signatures/admin-repository";
import { createSignatureDeliveryRuntime, createSignatureDomainRuntime, createSignatureDraftRuntime, createSignatureRuntime } from "@/lib/signatures/runtime";
import {
  isInternalCanarySigningEnabled,
  isPublicSigningEnabled,
  isSignerRuntimeEnabled,
} from "@/lib/signatures/public-config";
import { isSignerAccessAuthorized } from "@/lib/signatures/canary-gate";
import { inspectProductionPublicLaunchGate } from "@/lib/signatures/public-launch";
import { evaluateSignatureSendReadiness } from "@/lib/signatures/send-readiness";
import { getSignatureSecurityConfig } from "@/lib/signatures/config";
import { inspectSignatureRetentionPolicy } from "@/lib/signatures/retention-policy";
import { inspectSignaturePrivacyDisclosure } from "@/lib/signatures/privacy-disclosure";
import { loadActivePrivacyDisclosure, loadActiveRetentionPolicy } from "@/lib/signatures/governance-config";
import { parseSignatureParticipantDraft, SignatureParticipantAdminValidationError } from "@/lib/signatures/admin-participant";
import { createSignatureDraftLifecycleService } from "@/lib/signatures/draft-lifecycle";
import { buildTemplateBlueprint,createSignatureProductRepository } from "@/lib/signatures/productization";
import { evaluateSignatureVisualPreflight } from "@/lib/signatures/visual-preflight";
import { parseChoiceOptionsText } from "@/lib/signatures/field-options";
import { SIGNATURE_FIELD_TYPES, type SignatureFieldType, type SignatureFieldValidationLimits } from "@/lib/signatures/domain/types";

export type SignatureAdminActionState = Readonly<{
  ok: boolean;
  message: string;
}>;

const INITIAL_ERROR = "No se pudo guardar el cambio.";
const SEND_BLOCKER_MESSAGES: Record<string,string> = {
  document_not_draft: "El documento ya no está en borrador.",
  active_version_missing: "Falta la versión activa del documento.",
  source_pdf_incompatible: "El PDF fuente no pasó la validación.",
  version_already_locked: "La versión ya fue bloqueada para envío.",
  expiration_invalid: "Selecciona una fecha de expiración válida.",
  event_keys_unavailable: "La configuración de evidencia no está disponible.",
  public_signing_disabled: "La activación de firma permanece deshabilitada.",
  document_classification_approval_missing: "Este tipo de documento todavía no ha sido aprobado para firma electrónica.",
  approved_consent_missing: "Falta una versión de consentimiento aprobada.",
  retention_policy_missing: "Falta configurar y activar la política de retención.",
  privacy_disclosure_missing: "Falta una divulgación de privacidad aprobada.",
  participant_count_invalid: "Añade al menos un participante, sin exceder el máximo permitido.",
  participant_email_invalid: "Revisa los correos de los participantes.",
  field_count_invalid: "Añade los campos requeridos al documento.",
  required_participant_field_missing: "Cada participante necesita al menos un campo requerido.",
  field_definition_hash_stale: "La definición de campos cambió y debe volver a validarse.",
};

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}
function checked(formData:FormData,key:string){return formData.getAll(key).map(String).includes("true");}

function numberValue(formData: FormData, key: string) {
  const parsed = Number(value(formData, key));
  if (!Number.isFinite(parsed)) throw new Error("signature_number_invalid");
  return parsed;
}
function optionalNumberValue(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error("signature_number_invalid");
  return parsed;
}

async function requireSignatureManager() {
  await requireModuleAccess("signatures", "manage");
  return getAdminSession();
}

async function context(documentId: string) {
  const session = await requireSignatureManager();
  if (!session) return null;
  const runtime = createSignatureDomainRuntime();
  const repository = createSignatureAdminRepository(runtime.database);
  const detail = await repository.detail(documentId);
  if (!detail || detail.status !== "draft" || detail.version.locked) return null;
  return { session, runtime, detail };
}

function refresh(documentId: string) {
  revalidatePath(`/admin/signatures/${documentId}`);
  revalidatePath("/admin/signatures");
}

export async function addSignatureParticipantAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const documentId = value(formData, "documentId");
  const current = await context(documentId);
  if (!current) return { ok: false, message: "Borrador no disponible." };
  try {
    const participant = parseSignatureParticipantDraft({ name: value(formData,"name"), email: value(formData,"email"),
      role: value(formData,"role"), routingOrder: value(formData,"routingOrder") });
    const counts = await current.runtime.database.unsafe<{ total:number; duplicate:number }>(
      `SELECT count(*)::int total, count(*) FILTER (WHERE normalized_email=$2)::int duplicate
         FROM signature_participants WHERE document_version_id=$1::uuid AND removed_at IS NULL`,
      [current.detail.version.id, participant.email]);
    if ((counts[0]?.total ?? 0) >= 8) return { ok:false, message:"Se alcanzó el máximo de 8 participantes." };
    if ((counts[0]?.duplicate ?? 0) > 0) return { ok:false, message:"Este correo ya pertenece a otro participante." };
    await current.runtime.domain.addParticipant({
      documentVersionId: current.detail.version.id,
      canonicalLeadId: value(formData, "canonicalLeadId") || null,
      nameSnapshot: participant.name,
      emailSnapshot: participant.email,
      role: participant.role,
      routingOrder: participant.routingOrder,
      actorAdminId: current.session.id,
      idempotencyKey: randomUUID(),
    });
    refresh(documentId);
    return { ok: true, message: "Participante añadido." };
  } catch (error) {
    if (error instanceof SignatureParticipantAdminValidationError) return { ok:false, message:error.userMessage };
    const code = error instanceof Error ? error.message : "";
    if (/unique|duplicate/i.test(code)) return { ok:false, message:"Este correo ya pertenece a otro participante." };
    if (/limit exceeded/i.test(code)) return { ok:false, message:"Se alcanzó el máximo de 8 participantes." };
    return { ok: false, message: "No se pudo guardar el participante. Intenta nuevamente." };
  }
}

export async function updateSignatureParticipantAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const documentId=value(formData,"documentId");
  const current=await context(documentId);
  if(!current) return {ok:false,message:"Borrador no disponible."};
  const participant=current.detail.participants.find((item)=>item.id===value(formData,"participantId"));
  if(!participant) return {ok:false,message:"Destinatario no encontrado."};
  if(participant.isBrokerFinalSigner) return {ok:false,message:"El corredor(a) asignado firma al final y no puede editarse desde este borrador."};
  try {
    const parsed=parseSignatureParticipantDraft({name:value(formData,"name"),email:value(formData,"email"),role:value(formData,"role"),routingOrder:value(formData,"routingOrder")});
    await current.runtime.domain.updateParticipant({participantId:participant.id,nameSnapshot:parsed.name,emailSnapshot:parsed.email,
      role:parsed.role,routingOrder:parsed.routingOrder,actorAdminId:current.session.id,idempotencyKey:randomUUID()});
    refresh(documentId);
    return {ok:true,message:"Destinatario actualizado."};
  } catch(error) {
    if(error instanceof SignatureParticipantAdminValidationError) return {ok:false,message:error.userMessage};
    if(error instanceof Error && /unique|duplicate/i.test(error.message)) return {ok:false,message:"Este correo ya pertenece a otro destinatario."};
    return {ok:false,message:"No pudimos actualizar el destinatario. Intenta nuevamente."};
  }
}

export async function removeSignatureParticipantAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const documentId=value(formData,"documentId");
  const current=await context(documentId);
  if(!current) return {ok:false,message:"Borrador no disponible."};
  const participantId=value(formData,"participantId");
  const participant=current.detail.participants.find((item)=>item.id===participantId);
  if(participant?.isBrokerFinalSigner) return {ok:false,message:"El corredor(a) asignado no puede eliminarse de un documento que requiere su firma final."};
  const reason=value(formData,"reason") || "Eliminado durante la preparación";
  try {
    await current.runtime.database.begin(async(tx)=>{
      const [row]=await tx.unsafe<{id:string}>(`UPDATE signature_participants p SET removed_at=now(),removed_by_admin_id=$3::uuid,removal_reason=$4
        FROM signature_document_versions v,signature_documents d
        WHERE p.id=$1::uuid AND p.document_version_id=$2::uuid AND v.id=p.document_version_id AND d.active_version_id=v.id
          AND d.id=$5::uuid AND d.status='draft' AND v.locked_at IS NULL AND p.removed_at IS NULL
          AND NOT EXISTS(SELECT 1 FROM signature_fields f WHERE f.participant_id=p.id)
        RETURNING p.id::text`,[participantId,current.detail.version.id,current.session.id,reason,documentId]);
      if(!row) throw new Error("signature_participant_remove_blocked");
      const snapshot=createHash("sha256").update(JSON.stringify({documentId,participantId,reason})).digest("hex");
      await tx.unsafe(`INSERT INTO signature_governance_events(entity_type,entity_id,action,actor_admin_id,snapshot_sha256,previous_state,new_state,idempotency_key)
        VALUES('signing_request',$1::uuid,'recipient_removed',$2::uuid,$3,'active_recipient','removed_recipient',$4::uuid)`,
        [documentId,current.session.id,snapshot,randomUUID()]);
    });
    refresh(documentId);
    return {ok:true,message:"Destinatario eliminado del borrador. El historial permanece preservado."};
  } catch {
    return {ok:false,message:"No se puede eliminar: primero quita los campos asignados a este destinatario."};
  }
}

function fieldInput(formData: FormData, detail: SignatureDraftDetail) {
  const fieldType = value(formData, "fieldType");
  if (!SIGNATURE_FIELD_TYPES.includes(fieldType as SignatureFieldType)) {
    throw new Error("signature_field_type_invalid");
  }
  const pageIndex = numberValue(formData, "pageIndex");
  const geometry = detail.version.pageGeometry[pageIndex];
  if (!geometry) throw new Error("signature_page_invalid");
  const maxLength = fieldType === "text"
    ? Math.min(Math.max(numberValue(formData, "maxLength") || 1, 1), 500)
    : undefined;
  const validationLimits: Record<string, unknown> = {};
  if (maxLength) validationLimits.maxLength = maxLength;
  if (fieldType === "radio" || fieldType === "dropdown") {
    const options = parseChoiceOptionsText(value(formData, "options"));
    if (options.length < 2) throw new Error("signature_choice_options_invalid");
    validationLimits.options = options;
  }
  if (fieldType === "number") {
    validationLimits.allowDecimals = checked(formData, "allowDecimals");
    const min = optionalNumberValue(formData, "min");
    const max = optionalNumberValue(formData, "max");
    if (min !== undefined) validationLimits.min = min;
    if (max !== undefined) validationLimits.max = max;
    if (min !== undefined && max !== undefined && min > max) throw new Error("signature_number_range_invalid");
  }
  return {
    participantId: value(formData, "participantId"),
    fieldType: fieldType as SignatureFieldType,
    pageIndex,
    rect: {
      x: numberValue(formData, "x"),
      y: numberValue(formData, "y"),
      width: numberValue(formData, "width"),
      height: numberValue(formData, "height"),
    },
    pageGeometryReference: geometry,
    label: value(formData, "label") || fieldType,
    required: formData.getAll("required").map(String).includes("true"),
    validationLimits: validationLimits as SignatureFieldValidationLimits,
  };
}

export async function addSignatureFieldAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const documentId = value(formData, "documentId");
  const current = await context(documentId);
  if (!current) return { ok: false, message: "Borrador no disponible." };
  try {
    const input = fieldInput(formData, current.detail);
    const tabOrder = current.detail.fields.reduce(
      (maximum, field) => Math.max(maximum, field.tabOrder),
      0
    ) + 1;
    await current.runtime.domain.addField({
      documentVersionId: current.detail.version.id,
      ...input,
      tabOrder,
      actorAdminId: current.session.id,
      idempotencyKey: randomUUID(),
    });
    refresh(documentId);
    return { ok: true, message: "Campo añadido." };
  } catch {
    return { ok: false, message: "No se pudo añadir el campo. Verifica su posición y límites." };
  }
}

export async function updateSignatureFieldAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const documentId = value(formData, "documentId");
  const current = await context(documentId);
  if (!current) return { ok: false, message: "Borrador no disponible." };
  const existing = current.detail.fields.find((field) => field.id === value(formData, "fieldId"));
  if (!existing) return { ok: false, message: "Campo no encontrado." };
  try {
    await current.runtime.domain.updateField({
      fieldId: existing.id,
      ...fieldInput(formData, current.detail),
      tabOrder: existing.tabOrder,
      actorAdminId: current.session.id,
      idempotencyKey: randomUUID(),
    });
    refresh(documentId);
    return { ok: true, message: "Campo actualizado." };
  } catch {
    return { ok: false, message: "No se pudo actualizar el campo." };
  }
}

export async function removeSignatureFieldAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const documentId = value(formData, "documentId");
  const current = await context(documentId);
  if (!current) return { ok: false, message: "Borrador no disponible." };
  try {
    await current.runtime.domain.removeField({
      fieldId: value(formData, "fieldId"),
      actorAdminId: current.session.id,
      idempotencyKey: randomUUID(),
    });
    refresh(documentId);
    return { ok: true, message: "Campo eliminado." };
  } catch {
    return { ok: false, message: "No se pudo eliminar el campo." };
  }
}

export async function prepareSignatureSendAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const documentId = value(formData, "documentId");
  const session = await requireSignatureManager();
  if (!session) return { ok: false, message: "Sesión expirada." };
  try {
    const runtime = createSignatureDeliveryRuntime();
    const durablePrivacy = await loadActivePrivacyDisclosure(runtime.database);
    const privacy = durablePrivacy ? { configured: true as const, disclosure: {
      version: durablePrivacy.version_identifier, approvalReference: durablePrivacy.approval_reference,
      effectiveFrom: new Date(durablePrivacy.effective_from).toISOString(), locales: {
        "es-PR": { text: durablePrivacy.es_pr_text, sha256: durablePrivacy.es_pr_sha256 },
        "en-US": { text: durablePrivacy.en_us_text, sha256: durablePrivacy.en_us_sha256 },
      },
    } } : inspectSignaturePrivacyDisclosure();
    const durableRetention = await loadActiveRetentionPolicy(runtime.database);
    const authorizationDetail = await createSignatureAdminRepository(runtime.database).detail(documentId);
    if (!authorizationDetail) return { ok:false, message:"Documento no disponible." };
    const visualPreflight = evaluateSignatureVisualPreflight(
      authorizationDetail.fields,
      authorizationDetail.version.pageGeometry,
    );
    if (visualPreflight.sendBlocked) {
      return { ok:false, message:`Corrige la colocación de campos antes de enviar: ${visualPreflight.criticalCount} ${visualPreflight.criticalCount===1?"problema crítico":"problemas críticos"}.` };
    }
    const publicEnabled = isPublicSigningEnabled();
    const isolatedEnabled = isInternalCanarySigningEnabled();
    const publicLaunchGate = publicEnabled
      ? await inspectProductionPublicLaunchGate(runtime.database)
      : null;
    const scopedProductionCanaryEnabled = !publicEnabled && Boolean(authorizationDetail.participants.length) &&
      Boolean(authorizationDetail.version.id) &&
      (await Promise.all(authorizationDetail.participants.map((participant) =>
        isSignerAccessAuthorized(runtime.database, {
          participantId: participant.id,
          documentVersionId: authorizationDetail!.version.id,
        })
      ))).every(Boolean);
    const readiness = await evaluateSignatureSendReadiness({
      database: runtime.database,
      documentId,
      locale: "es-PR",
      publicSigningEnabled: Boolean(publicLaunchGate?.allowed) || isolatedEnabled || scopedProductionCanaryEnabled,
      eventKeysConfigured: Boolean(getSignatureSecurityConfig()),
      retentionPolicyConfigured: Boolean(durableRetention) || inspectSignatureRetentionPolicy().configured,
      privacyDisclosureConfigured: privacy.configured,
    });
    if (!readiness.eligible) {
      return {
        ok: false,
        message: `El envío permanece bloqueado: ${readiness.reasons.map((reason) => SEND_BLOCKER_MESSAGES[reason] ?? "Hay un control pendiente que requiere revisión.").join(" ")}`,
      };
    }
    const sendMode=publicEnabled&&publicLaunchGate?.allowed?"public":scopedProductionCanaryEnabled||isolatedEnabled?"internal_canary":"disabled";
    const expectedPhrase=sendMode==="public"?"CONFIRMAR ENVIO PUBLICO":"CONFIRMAR ENVIO CANARY INTERNO";
    if(sendMode==="disabled" || !checked(formData,"sendAcknowledged") || value(formData,"sendConfirmationPhrase")!==expectedPhrase) {
      return {ok:false,message:`El envío requiere confirmación explícita del modo ${sendMode==="public"?"FIRMA PÚBLICA":"CANARY INTERNO"}.`};
    }
    if (!privacy.configured || !privacy.disclosure) {
      return { ok: false, message: "Falta la divulgación de privacidad aprobada." };
    }
    await runtime.domain.prepareDocumentForSend({
      documentId,
      actorAdminId: session.id,
      idempotencyKey: randomUUID(),
      locale: "es-PR",
      publicSigningEnabled: true,
      privacyDisclosure: {
        version: privacy.disclosure.version,
        approvalReference: privacy.disclosure.approvalReference,
        effectiveFrom: privacy.disclosure.effectiveFrom,
        esPRSha256: privacy.disclosure.locales["es-PR"].sha256,
        enUSSha256: privacy.disclosure.locales["en-US"].sha256,
        esPRText: privacy.disclosure.locales["es-PR"].text,
        enUSText: privacy.disclosure.locales["en-US"].text,
      },
    });
    const detail = await createSignatureAdminRepository(runtime.database).detail(documentId);
    if (!detail) throw new Error("signature_document_not_found");
    await runtime.delivery.releaseNextRoutingGroup({ documentVersionId:detail.version.id,locale:"es-PR" });
    refresh(documentId);
    return { ok: true, message: `${sendMode==="public"?"FIRMA PÚBLICA":"CANARY INTERNO"}: preparación completada; invitaciones en cola con revalidación server-side.` };
  } catch {
    return { ok: false, message: INITIAL_ERROR };
  }
}

export async function resendSignatureInvitationAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const session = await requireSignatureManager();
  if (!session || !isSignerRuntimeEnabled()) return { ok: false, message: "El reenvío permanece desactivado." };
  const documentId = value(formData, "documentId");
  try {
    const runtime = createSignatureDeliveryRuntime();
    const detail = await createSignatureAdminRepository(runtime.database).detail(documentId);
    const participant = detail?.participants.find((item) => item.id === value(formData, "participantId"));
    if (!detail || !participant) throw new Error("signature_participant_not_found");
    if (!(await isSignerAccessAuthorized(runtime.database, {
      participantId: participant.id,
      documentVersionId: detail.version.id,
    }))) throw new Error("signature_participant_not_authorized");
    const counts = await runtime.database.unsafe<{ count: number }>(
      `SELECT count(*)::integer AS count FROM public.signature_delivery_intents
        WHERE participant_id=$1::uuid AND delivery_kind='invitation'`, [participant.id]
    );
    const digest = createHash("sha256").update(`resend:${participant.id}:${counts[0]?.count ?? 0}`).digest("hex");
    const idempotencyKey = `${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-8${digest.slice(17,20)}-${digest.slice(20,32)}`;
    await runtime.delivery.reissueInvitation({ participantId: participant.id,
      documentVersionId: detail.version.id, locale: "es-PR", actorAdminId: session.id,
      idempotencyKey });
    refresh(documentId);
    return { ok: true, message: "Reenvío puesto en cola." };
  } catch { return { ok: false, message: "No se puede reenviar en el estado actual." }; }
}

export async function expireSignatureDocumentAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const session = await requireSignatureManager();
  if (!session) return { ok: false, message: "Sesión expirada." };
  const documentId = value(formData, "documentId");
  try {
    await createSignatureDomainRuntime().domain.expireSignatureDocument({
      documentId, idempotencyKey: value(formData, "idempotencyKey") || randomUUID(),
    });
    refresh(documentId);
    return { ok: true, message: "Solicitud expirada." };
  } catch { return { ok: false, message: "La solicitud todavía no es elegible para expirar." }; }
}

export async function voidSignatureDocumentAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const session = await requireSignatureManager();
  if (!session) return { ok: false, message: "Sesión expirada." };
  const documentId = value(formData, "documentId");
  try {
    await createSignatureDomainRuntime().domain.voidSignatureDocument({
      documentId,
      actorAdminId: session.id,
      reason: value(formData, "reason"),
      idempotencyKey: value(formData, "idempotencyKey") || randomUUID(),
    });
    refresh(documentId);
    return { ok: true, message: "Solicitud anulada." };
  } catch { return { ok: false, message: "No se puede anular en el estado actual." }; }
}

export async function deleteSignatureDraftAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const session = await requireSignatureManager();
  if (!session) return { ok:false, message:"Sesión expirada." };
  const documentId = value(formData,"documentId");
  try {
    const runtime = createSignatureRuntime();
    const result = await createSignatureDraftLifecycleService(runtime.database,runtime.storage).deleteEligibleRecord({
      documentId,actorAdminId:session.id,reason:value(formData,"reason"),
      confirmationPhrase:value(formData,"confirmationPhrase"),idempotencyKey:randomUUID(),
    });
    refresh(documentId);
    return { ok:true, message:result.status === "deleted"
      ? "Prueba eliminada permanentemente junto con sus artefactos exclusivos. Se conservó solo el registro administrativo mínimo."
      : "Borrador eliminado de la vista operativa y PDF fuente privado removido; la evidencia de auditoría se conservó." };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code.includes("test_delete_confirmation")) return { ok:false, message:"Escribe ELIMINAR PRUEBA para confirmar." };
    if (code.includes("draft_delete_confirmation")) return { ok:false, message:"Escribe ELIMINAR BORRADOR para confirmar." };
    if (code.includes("blocked")) return { ok:false, message:"Este registro contiene evidencia protegida o dependencias y no puede eliminarse. Usa Archivar." };
    return { ok:false, message:"No se pudo eliminar de forma segura. No se afirmó una eliminación incompleta." };
  }
}

export async function archiveSignatureDraftAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const session = await requireSignatureManager();
  if (!session) return { ok:false, message:"Sesión expirada." };
  const documentId = value(formData,"documentId");
  try {
    const runtime = createSignatureRuntime();
    await createSignatureDraftLifecycleService(runtime.database,runtime.storage).hideFromOperationalWorkflow({
      documentId,actorAdminId:session.id,reason:value(formData,"reason"),idempotencyKey:randomUUID(),
    });
    refresh(documentId);
    return { ok:true, message:"Borrador archivado de la vista operativa. Puede restaurarse y su evidencia permanece preservada." };
  } catch {
    return { ok:false, message:"No se pudo archivar el borrador en su estado actual." };
  }
}

export async function removeSignatureRequestAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const session=await requireSignatureManager();
  if(!session) return {ok:false,message:"Sesión expirada."};
  const documentId=value(formData,"documentId");
  const reason=value(formData,"reason");
  if(!reason) return {ok:false,message:"Escribe una razón para continuar."};
  try {
    const runtime=createSignatureRuntime();
    const lifecycle=createSignatureDraftLifecycleService(runtime.database,runtime.storage);
    const detail=await createSignatureAdminRepository(runtime.database).detail(documentId);
    if(!detail) return {ok:false,message:"Solicitud no encontrada."};
    if(detail.status==="archived" || detail.operationallyHiddenAt) return {ok:true,message:"La solicitud ya está fuera de la lista activa."};
    const eligibility=await lifecycle.inspectDeletion(documentId);
    if(eligibility.eligible) {
      await lifecycle.deleteInertDraft({documentId,actorAdminId:session.id,reason,
        confirmationPhrase:value(formData,"confirmationPhrase"),idempotencyKey:randomUUID()});
      refresh(documentId);
      return {ok:true,message:"Borrador eliminado de la lista y PDF fuente privado removido. La auditoría se conservó."};
    }
    if(detail.status==="draft") {
      await lifecycle.archiveDraft({documentId,actorAdminId:session.id,reason,idempotencyKey:randomUUID()});
      refresh(documentId);
      return {ok:true,message:"La solicitud se quitó de la lista activa. Borikí conservó la evidencia necesaria."};
    }
    if(["sent","viewed","partially_signed"].includes(detail.status)) {
      await createSignatureDomainRuntime().domain.voidSignatureDocument({documentId,actorAdminId:session.id,reason,idempotencyKey:randomUUID()});
    }
    await lifecycle.hideFromOperationalWorkflow({documentId,actorAdminId:session.id,reason,idempotencyKey:randomUUID()});
    refresh(documentId);
    return {ok:true,message:"La solicitud se quitó de la lista activa. La evidencia protegida permanece disponible en Archivados."};
  } catch(error) {
    if(error instanceof Error && error.message.includes("confirmation")) return {ok:false,message:"Escribe ELIMINAR BORRADOR para eliminar un borrador completamente inerte."};
    return {ok:false,message:"No pudimos quitar la solicitud de forma segura. No se destruyó evidencia."};
  }
}

export async function restoreSignatureRequestAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const session = await requireSignatureManager();
  if (!session) return { ok:false, message:"Sesión expirada." };
  const documentId = value(formData,"documentId");
  try {
    const runtime = createSignatureRuntime();
    await createSignatureDraftLifecycleService(runtime.database,runtime.storage).restoreToOperationalWorkflow({
      documentId,
      actorAdminId: session.id,
      reason: value(formData,"reason") || "Restaurado a la vista operativa por el administrador",
      idempotencyKey: randomUUID(),
    });
    refresh(documentId);
    return { ok:true, message:"Solicitud restaurada a la vista operativa. Su historial permanece intacto." };
  } catch {
    return { ok:false, message:"Esta solicitud no puede restaurarse sin alterar evidencia protegida." };
  }
}

export async function saveSignatureTemplateAction(
  _state:SignatureAdminActionState,formData:FormData
):Promise<SignatureAdminActionState>{
  const session=await requireSignatureManager();if(!session)return{ok:false,message:"Sesión expirada."};
  const documentId=value(formData,"documentId");
  try{
    const runtime=createSignatureRuntime();const detail=await createSignatureAdminRepository(runtime.database).detail(documentId);
    if(!detail||detail.version.sourceDeleted||!detail.participants.length||!detail.fields.length)throw new Error("template_source_invalid");
    const name=value(formData,"name").trim();if(!name||name.length>200)throw new Error("template_name_invalid");
    const optionalParticipantIds=new Set(formData.getAll("optionalParticipantId").map(String));
    if([...optionalParticipantIds].some((id)=>!detail.participants.some((participant)=>participant.id===id&&!participant.isBrokerFinalSigner)))throw new Error("template_optional_role_invalid");
    const blueprint=buildTemplateBlueprint(detail,{optionalParticipantIds});
    await createSignatureProductRepository(runtime.database).createTemplate({name,description:value(formData,"description")||null,
      documentType:detail.documentType,sourceDocumentVersionId:detail.version.id,locale:"es-PR",routingMode:detail.routingMode,
      requiresBrokerSignature:detail.requiresBrokerSignature,roles:blueprint.roles,fields:blueprint.fields,actorAdminId:session.id});
    revalidatePath("/admin/signatures/plantillas");return{ok:true,message:"Plantilla guardada sin firmas, valores ni accesos anteriores."};
  }catch{return{ok:false,message:"No se pudo guardar la plantilla. Revisa que el borrador tenga roles y campos."};}
}

function puertoRicoExpiry(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error("expiration_invalid");const date=new Date(`${value}T23:59:59-04:00`);if(date.getTime()<=Date.now())throw new Error("expiration_invalid");return date;}

async function cloneSignatureRequest(formData:FormData,mode:"duplicate"|"correct"){
  const session=await requireSignatureManager();if(!session)throw new Error("unauthorized");
  const sourceId=value(formData,"documentId");const runtime=createSignatureRuntime();const repository=createSignatureAdminRepository(runtime.database);
  const detail=await repository.detail(sourceId);const descriptor=await repository.sourceDescriptor(sourceId);
  if(!detail||!descriptor||detail.version.sourceDeleted)throw new Error("signature_source_unavailable");
  if(mode==="correct"&&!['sent','viewed','partially_signed'].includes(detail.status))throw new Error("signature_correction_not_available");
  const bytes=await runtime.storage.getSource({key:descriptor.key,byteCount:descriptor.byteCount,sourceSha256:descriptor.sourceSha256});
  const draftRuntime=createSignatureDraftRuntime();
  const created=await draftRuntime.drafts.createDraft({title:value(formData,"title"),documentType:detail.documentType,
    createdByAdminId:session.id,canonicalLeadId:detail.canonicalLeadId,leadGroupId:detail.leadGroupId,
    expiresAt:puertoRicoExpiry(value(formData,"expiresOn")),filename:descriptor.filename,mimeType:"application/pdf",bytes,
    routingMode:detail.routingMode,requiresBrokerSignature:detail.requiresBrokerSignature});
  if(mode==="correct")await runtime.database.unsafe(`UPDATE signature_documents SET corrects_document_id=$2::uuid WHERE id=$1::uuid AND status='draft'`,[created.documentId,sourceId]);
  const ids=new Map<string,string>();
  for(const participant of detail.participants.filter((item)=>!item.isBrokerFinalSigner)){
    const added=await runtime.domain.addParticipant({documentVersionId:created.documentVersionId,nameSnapshot:participant.name,
      emailSnapshot:participant.email,role:participant.role,routingOrder:participant.routingOrder,actorAdminId:session.id,idempotencyKey:randomUUID()});
    ids.set(participant.id,added.participantId);
  }
  const cloned=await repository.detail(created.documentId);const oldBroker=detail.participants.find((item)=>item.isBrokerFinalSigner);
  const newBroker=cloned?.participants.find((item)=>item.isBrokerFinalSigner);if(oldBroker&&newBroker)ids.set(oldBroker.id,newBroker.id);
  for(const field of detail.fields){const participantId=ids.get(field.participantId);if(!participantId)throw new Error("signature_clone_participant_missing");
    await runtime.domain.addField({documentVersionId:created.documentVersionId,participantId,fieldType:field.fieldType,pageIndex:field.pageIndex,
      rect:{x:field.normalizedX,y:field.normalizedY,width:field.normalizedWidth,height:field.normalizedHeight},
      pageGeometryReference:field.pageGeometryReference,label:field.label,required:field.required,tabOrder:field.tabOrder,
      validationLimits:field.validationLimits,actorAdminId:session.id,idempotencyKey:randomUUID()});}
  const cloneSnapshot=createHash("sha256").update(JSON.stringify({sourceDocumentId:sourceId,targetDocumentId:created.documentId,mode})).digest("hex");
  await runtime.database.unsafe(`INSERT INTO signature_governance_events(entity_type,entity_id,action,actor_admin_id,snapshot_sha256,previous_state,new_state,idempotency_key)
    VALUES('signing_request',$1::uuid,$2,$3::uuid,$4,$5,'draft',$6::uuid)`,
    [created.documentId,mode==="correct"?"corrected":"duplicated",session.id,cloneSnapshot,sourceId,randomUUID()]);
  redirect(`/admin/signatures/${created.documentId}`);
}

export async function duplicateSignatureRequestAction(_state:SignatureAdminActionState,formData:FormData):Promise<SignatureAdminActionState>{
  try{await cloneSignatureRequest(formData,"duplicate");return{ok:true,message:"Copia creada."};}
  catch(error){if((error as {digest?:string})?.digest)throw error;return{ok:false,message:"No se pudo duplicar la solicitud."};}
}

export async function correctSignatureRequestAction(_state:SignatureAdminActionState,formData:FormData):Promise<SignatureAdminActionState>{
  try{await cloneSignatureRequest(formData,"correct");return{ok:true,message:"Corrección preparada."};}
  catch(error){if((error as {digest?:string})?.digest)throw error;return{ok:false,message:"Solo las solicitudes activas pueden prepararse para corrección."};}
}
