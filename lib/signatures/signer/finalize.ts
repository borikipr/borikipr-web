import path from "node:path";
import { randomUUID } from "node:crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { SignatureDatabase } from "../domain/types";
import type { SignatureCompletedStorage } from "../storage";
import type { createSignatureDomainServices } from "../domain/service";
import { finalizePrototypePdf } from "../prototype/finalize";
import type { PdfPageGeometry, PrototypeField, PrototypeParticipant } from "../prototype/types";
import { hashSignatureFieldDefinition } from "../field-definition";
import { canonicalSignatureJson, sha256SignatureValue } from "../domain/crypto";
import { signatureCertificateR2Key, signatureFinalR2Key } from "../domain/r2-keys";

function parsed<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

async function createDetachedCertificate(input: {
  title: string; documentId: string; sourceSha256: string; finalSha256: string;
  fieldDefinitionSha256: string; verificationId: string;
  participants: readonly PrototypeParticipant[]; completedAt: string;
}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("BorikiPR - Synthetic completion certificate");
  pdf.setCreationDate(new Date(input.completedAt));
  pdf.setModificationDate(new Date(input.completedAt));
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawText("BORIKIPR — SYNTHETIC COMPLETION CERTIFICATE", { x: 48, y: 735, size: 14, font: bold });
  const lines = [
    "Phase 2D prototype — NOT LEGALLY APPROVED",
    `Document: ${input.title}`,
    `Document identifier: ${input.documentId}`,
    `Completed: ${input.completedAt}`,
    `Consent: phase2d-synthetic-v1`,
    `Verification: ${input.verificationId}`,
    `Source SHA-256: ${input.sourceSha256}`,
    `Final SHA-256: ${input.finalSha256}`,
    `Field definition SHA-256: ${input.fieldDefinitionSha256}`,
    "Event chain verified before finalization: yes",
    ...input.participants.map((participant) => `${participant.displayName} | ${participant.role} | ${participant.completedAt}`),
  ];
  let y = 705;
  for (const line of lines) { page.drawText(line, { x: 48, y, size: 8.5, font, maxWidth: 516 }); y -= 24; }
  return new Uint8Array(await pdf.save({ useObjectStreams: false }));
}

export async function finalizeCompletedSignatureDocument(
  documentId: string,
  suppliedRuntime?: {
    database: SignatureDatabase;
    domain: ReturnType<typeof createSignatureDomainServices>;
    storage: SignatureCompletedStorage;
  }
) {
  const runtime = suppliedRuntime ?? (await import("../runtime")).createSignatureRuntime();
  const rows = await runtime.database.unsafe<{
    document_id: string; title: string; status: string; version_id: string; version_number: number;
    source_r2_key: string; filename_snapshot: string; byte_count: number; page_count: number;
    source_sha256: string; page_geometry_manifest: unknown; field_definition_sha256: string;
    finalized_at: string | Date | null; final_r2_key: string | null; final_pdf_sha256: string | null;
  }>(
    `SELECT d.id::text AS document_id, d.title, d.status, v.id::text AS version_id,
            v.version_number, v.source_r2_key, v.filename_snapshot, v.byte_count::integer,
            v.page_count, v.source_sha256, v.page_geometry_manifest, v.field_definition_sha256,
            v.finalized_at, v.final_r2_key, v.final_pdf_sha256
       FROM public.signature_documents d JOIN public.signature_document_versions v ON v.id=d.active_version_id
      WHERE d.id=$1::uuid`, [documentId]
  );
  const document = rows[0];
  if (!document) throw new Error("signature_document_not_found");
  if (document.finalized_at) return { completed: true as const, finalSha256: document.final_pdf_sha256, existing: true as const };
  const participants = await runtime.database.unsafe<{
    id: string; name_snapshot: string; role: string; completed_at: string | Date | null; status: string;
  }>(`SELECT id::text, name_snapshot, role, completed_at, status FROM public.signature_participants WHERE document_version_id=$1::uuid ORDER BY id`, [document.version_id]);
  if (!participants.length || participants.some((participant) => participant.status !== "completed" || !participant.completed_at)) {
    throw new Error("signature_participants_incomplete");
  }
  const fieldRows = await runtime.database.unsafe<{
    id: string; participant_id: string; field_type: PrototypeField["type"]; page_index: number;
    normalized_x: string; normalized_y: string; normalized_width: string; normalized_height: string;
    required: boolean; tab_order: number; validation_limits: unknown; capture_method: string | null;
    sanitized_typed_value: string | null; sanitized_value_payload: unknown;
  }>(
    `SELECT f.id::text, f.participant_id::text, f.field_type, f.page_index,
            f.normalized_x::text, f.normalized_y::text, f.normalized_width::text, f.normalized_height::text,
            f.required, f.tab_order, f.validation_limits, fv.capture_method,
            fv.sanitized_typed_value, fv.sanitized_value_payload
       FROM public.signature_fields f LEFT JOIN public.signature_field_values fv ON fv.signature_field_id=f.id
      WHERE f.document_version_id=$1::uuid ORDER BY f.tab_order`, [document.version_id]
  );
  const layoutHash = hashSignatureFieldDefinition({
    documentVersionId: document.version_id,
    fields: fieldRows.map((field) => ({
      participantId: field.participant_id, fieldType: field.field_type, pageIndex: field.page_index,
      normalizedX: Number(field.normalized_x), normalizedY: Number(field.normalized_y),
      normalizedWidth: Number(field.normalized_width), normalizedHeight: Number(field.normalized_height),
      required: field.required, tabOrder: field.tab_order,
      validationLimits: parsed<Record<string, number>>(field.validation_limits),
    })),
  });
  if (layoutHash !== document.field_definition_sha256) throw new Error("signature_field_definition_hash_mismatch");
  const chain = await runtime.domain.verifyEventChain(documentId);
  if (!chain.valid) throw new Error("signature_event_chain_invalid");
  const sourceBytes = await runtime.storage.getSource({ key: document.source_r2_key, byteCount: document.byte_count, sourceSha256: document.source_sha256 });
  const completedAt = new Date(Math.max(...participants.map((participant) => new Date(participant.completed_at!).getTime()))).toISOString();
  const participantModels: PrototypeParticipant[] = participants.map((participant) => ({
    id: participant.id, displayName: participant.name_snapshot, role: participant.role,
    completedAt: new Date(participant.completed_at!).toISOString(),
  }));
  const fields: PrototypeField[] = fieldRows.filter((field) => field.capture_method !== null).map((field) => ({
    id: field.id, participantId: field.participant_id, type: field.field_type, pageIndex: field.page_index,
    rect: { x: Number(field.normalized_x), y: Number(field.normalized_y), width: Number(field.normalized_width), height: Number(field.normalized_height) },
    value: field.capture_method === "drawn_vector"
      ? { method: "drawn", strokes: parsed<{ strokes: PrototypeField["value"] extends { method: "drawn"; strokes: infer S } ? S : never }>(field.sanitized_value_payload).strokes }
      : field.capture_method === "system_date"
        ? { method: "date", value: field.sanitized_typed_value! }
        : field.capture_method === "text_entry"
          ? { method: "text", value: field.sanitized_typed_value! }
          : { method: "typed", value: field.sanitized_typed_value! },
  }));
  const verificationId = sha256SignatureValue(`${document.document_id}:${document.source_sha256}:${layoutHash}`).slice(0, 32);
  const finalized = await finalizePrototypePdf({
    sourceBytes, sourceTitle: document.title, sourceSha256: document.source_sha256,
    geometries: parsed<readonly PdfPageGeometry[]>(document.page_geometry_manifest), fields,
    participants: participantModels, requestId: document.document_id, verificationId,
    consentVersion: "phase2d-synthetic-v1", completedAt,
    typedSignatureFontPath: path.join(process.cwd(), "tests/fixtures/signatures/fonts/great-vibes/GreatVibes-Regular.ttf"),
  });
  const finalSha256 = sha256SignatureValue(finalized.finalBytes);
  const certificateBytes = await createDetachedCertificate({
    title: document.title, documentId, sourceSha256: document.source_sha256, finalSha256,
    fieldDefinitionSha256: layoutHash, verificationId, participants: participantModels, completedAt,
  });
  const certificateSha256 = sha256SignatureValue(certificateBytes);
  const finalKey = signatureFinalR2Key(documentId, document.version_number, finalSha256);
  const certificateKey = signatureCertificateR2Key(documentId, document.version_number, certificateSha256);
  await runtime.storage.putFinal({ key: finalKey, bytes: finalized.finalBytes, mimeType: "application/pdf", byteCount: finalized.finalBytes.byteLength, sha256: finalSha256 });
  await runtime.storage.putCertificate({ key: certificateKey, bytes: certificateBytes, mimeType: "application/pdf", byteCount: certificateBytes.byteLength, sha256: certificateSha256 });
  const evidenceManifest = {
    schemaVersion: "phase2d-evidence-v1", documentId, sourceSha256: document.source_sha256,
    finalPdfSha256: finalSha256, certificateSha256, fieldDefinitionSha256: layoutHash,
    verificationId, consentVersion: "phase2d-synthetic-v1", completedAt,
    eventChainVerified: true,
  };
  const updated = await runtime.database.unsafe<{ id: string }>(
    `UPDATE public.signature_document_versions SET finalized_at=$2::timestamptz,
       final_r2_key=$3, final_filename=$4, final_mime_type='application/pdf', final_byte_count=$5,
       final_page_count=page_count+1, final_pdf_metadata=$6::jsonb, final_pdf_sha256=$7,
       certificate_r2_key=$8, certificate_mime_type='application/pdf', certificate_byte_count=$9,
       certificate_metadata=$10::jsonb, certificate_sha256=$11
     WHERE id=$1::uuid AND finalized_at IS NULL RETURNING id::text`,
    [document.version_id, completedAt, finalKey, `completed-${document.filename_snapshot}`, finalized.finalBytes.byteLength,
      JSON.stringify({ verificationId, flattened: true }), finalSha256, certificateKey, certificateBytes.byteLength,
      canonicalSignatureJson(evidenceManifest), certificateSha256]
  );
  if (!updated[0]) return { completed: true as const, finalSha256, existing: true as const };
  for (const eventType of ["final_pdf_generated", "certificate_generated", "finalization_completed"] as const) {
    await runtime.domain.appendEvent({ documentId, documentVersionId: document.version_id, eventType,
      actorClass: "system", versionHash: document.source_sha256,
      controlledMetadata: { verification_id: verificationId }, idempotencyKey: randomUUID() });
  }
  await runtime.domain.transitionDocumentState({ documentId, targetStatus: "completed", actorClass: "system", idempotencyKey: randomUUID() });
  const finalChain = await runtime.domain.verifyEventChain(documentId);
  if (!finalChain.valid) throw new Error("signature_final_event_chain_invalid");
  return { completed: true as const, finalSha256, certificateSha256, existing: false as const };
}
