"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin/auth";
import {
  createSignatureAdminRepository,
  type SignatureDraftDetail,
} from "@/lib/signatures/admin-repository";
import {
  getSignatureDocumentTypeDefinition,
  isSignatureDocumentTypeApproved,
} from "@/lib/signatures/document-classification";
import { createSignatureDomainRuntime } from "@/lib/signatures/runtime";

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
  const documentType = value(formData, "documentType");
  const definition = getSignatureDocumentTypeDefinition(documentType);
  if (!definition || !isSignatureDocumentTypeApproved(definition)) {
    return {
      ok: false,
      message: "Este tipo de documento todavía no está autorizado para firma electrónica.",
    };
  }
  try {
    const runtime = createSignatureDomainRuntime();
    await runtime.domain.prepareDocumentForSend({
      documentId,
      actorAdminId: session.id,
      idempotencyKey: randomUUID(),
    });
    refresh(documentId);
    return { ok: true, message: "Preparación completada." };
  } catch {
    return { ok: false, message: INITIAL_ERROR };
  }
}
