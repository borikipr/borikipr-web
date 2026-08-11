"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin/auth";
import {
  createSignatureAdminRepository,
  type SignatureDraftDetail,
} from "@/lib/signatures/admin-repository";
import { createSignatureDeliveryRuntime, createSignatureDomainRuntime } from "@/lib/signatures/runtime";
import { isPublicSigningEnabled } from "@/lib/signatures/public-config";
import { evaluateSignatureSendReadiness } from "@/lib/signatures/send-readiness";
import { getSignatureSecurityConfig } from "@/lib/signatures/config";
import { inspectSignatureRetentionPolicy } from "@/lib/signatures/retention-policy";
import { inspectSignaturePrivacyDisclosure } from "@/lib/signatures/privacy-disclosure";
import { loadActivePrivacyDisclosure, loadActiveRetentionPolicy } from "@/lib/signatures/governance-config";

export type SignatureAdminActionState = Readonly<{
  ok: boolean;
  message: string;
}>;

const INITIAL_ERROR = "No se pudo guardar el cambio.";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numberValue(formData: FormData, key: string) {
  const parsed = Number(value(formData, key));
  if (!Number.isFinite(parsed)) throw new Error("signature_number_invalid");
  return parsed;
}

async function context(documentId: string) {
  const session = await getAdminSession();
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
    await current.runtime.domain.addParticipant({
      documentVersionId: current.detail.version.id,
      canonicalLeadId: value(formData, "canonicalLeadId") || null,
      nameSnapshot: value(formData, "name"),
      emailSnapshot: value(formData, "email"),
      role: value(formData, "role"),
      routingOrder: value(formData, "routingOrder")
        ? numberValue(formData, "routingOrder")
        : null,
      actorAdminId: current.session.id,
      idempotencyKey: randomUUID(),
    });
    refresh(documentId);
    return { ok: true, message: "Participante añadido." };
  } catch {
    return { ok: false, message: "No se pudo añadir el participante. Verifica límites y correo duplicado." };
  }
}

function fieldInput(formData: FormData, detail: SignatureDraftDetail) {
  const fieldType = value(formData, "fieldType");
  if (!(["signature", "initials", "date", "text"] as const).includes(fieldType as never)) {
    throw new Error("signature_field_type_invalid");
  }
  const pageIndex = numberValue(formData, "pageIndex");
  const geometry = detail.version.pageGeometry[pageIndex];
  if (!geometry) throw new Error("signature_page_invalid");
  const maxLength = fieldType === "text"
    ? Math.min(Math.max(numberValue(formData, "maxLength") || 1, 1), 500)
    : undefined;
  return {
    participantId: value(formData, "participantId"),
    fieldType: fieldType as "signature" | "initials" | "date" | "text",
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
    validationLimits: maxLength ? { maxLength } : undefined,
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
  const session = await getAdminSession();
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
    const readiness = await evaluateSignatureSendReadiness({
      database: runtime.database,
      documentId,
      locale: "es-PR",
      publicSigningEnabled: isPublicSigningEnabled(),
      eventKeysConfigured: Boolean(getSignatureSecurityConfig()),
      retentionPolicyConfigured: Boolean(durableRetention) || inspectSignatureRetentionPolicy().configured,
      privacyDisclosureConfigured: privacy.configured,
    });
    if (!readiness.eligible) {
      return {
        ok: false,
        message: `El envío permanece bloqueado: ${readiness.reasons.join(", ")}`,
      };
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
    for (const participant of detail.participants) {
      await runtime.delivery.createIntent({
        participantId: participant.id,
        documentVersionId: detail.version.id,
        locale: "es-PR",
        actorAdminId: session.id,
        idempotencyKey: randomUUID(),
      });
    }
    refresh(documentId);
    return { ok: true, message: "Preparación completada; invitaciones en cola." };
  } catch {
    return { ok: false, message: INITIAL_ERROR };
  }
}

export async function resendSignatureInvitationAction(
  _state: SignatureAdminActionState,
  formData: FormData
): Promise<SignatureAdminActionState> {
  const session = await getAdminSession();
  if (!session || !isPublicSigningEnabled()) return { ok: false, message: "El reenvío permanece desactivado." };
  const documentId = value(formData, "documentId");
  try {
    const runtime = createSignatureDeliveryRuntime();
    const detail = await createSignatureAdminRepository(runtime.database).detail(documentId);
    const participant = detail?.participants.find((item) => item.id === value(formData, "participantId"));
    if (!detail || !participant) throw new Error("signature_participant_not_found");
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
  const session = await getAdminSession();
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
  const session = await getAdminSession();
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
