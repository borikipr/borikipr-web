import { hashSignatureFieldDefinition } from "./field-definition";
import type { SignatureQueryExecutor } from "./domain/types";

export type SignatureSendReadiness = Readonly<{
  eligible: boolean;
  reasons: readonly string[];
  documentId: string | null;
  documentVersionId: string | null;
  locale: "es-PR" | "en-US";
  approvalReference: string | null;
  consentVersion: string | null;
  consentTextSha256: string | null;
  currentFieldDefinitionSha256: string | null;
}>;

export async function evaluateSignatureSendReadiness(input: {
  database: SignatureQueryExecutor;
  documentId: string;
  locale: "es-PR" | "en-US";
  publicSigningEnabled: boolean;
  eventKeysConfigured: boolean;
  retentionPolicyConfigured: boolean;
  privacyDisclosureConfigured: boolean;
  now?: Date;
}): Promise<SignatureSendReadiness> {
  const now = input.now ?? new Date();
  const rows = await input.database.unsafe<{
    id: string; document_type: string; status: string; active_version_id: string | null;
    expires_at: string | Date | null; version_id: string | null; mime_type: string | null;
    byte_count: number | null; page_count: number | null; locked_at: string | Date | null;
    field_definition_sha256: string | null;
  }>(
    `SELECT d.id::text, d.document_type, d.status, d.active_version_id::text, d.expires_at,
            v.id::text AS version_id, v.mime_type, v.byte_count::integer, v.page_count,
            v.locked_at, v.field_definition_sha256
       FROM public.signature_documents d
       LEFT JOIN public.signature_document_versions v ON v.id=d.active_version_id
      WHERE d.id=$1::uuid`,
    [input.documentId]
  );
  const row = rows[0];
  const reasons: string[] = [];
  if (!row) reasons.push("document_not_found");
  if (row && row.status !== "draft") reasons.push("document_not_draft");
  if (row && !row.version_id) reasons.push("active_version_missing");
  if (row && (row.mime_type !== "application/pdf" || !row.byte_count || row.byte_count > 3_000_000 || !row.page_count || row.page_count > 25)) {
    reasons.push("source_pdf_incompatible");
  }
  if (row?.locked_at) reasons.push("version_already_locked");
  if (!row?.expires_at || new Date(row.expires_at).getTime() <= now.getTime()) reasons.push("expiration_invalid");
  if (!input.eventKeysConfigured) reasons.push("event_keys_unavailable");
  if (!input.retentionPolicyConfigured) reasons.push("retention_policy_missing");
  if (!input.privacyDisclosureConfigured) reasons.push("privacy_disclosure_missing");
  if (!input.publicSigningEnabled) reasons.push("public_signing_disabled");

  let approvalReference: string | null = null;
  let consentVersion: string | null = null;
  let consentTextSha256: string | null = null;
  let currentFieldDefinitionSha256: string | null = null;
  if (row) {
    const approvals = await input.database.unsafe<{ approval_reference: string }>(
      `SELECT approval_reference FROM public.signature_document_type_approvals
        WHERE document_type=$1 AND status='approved' AND revoked_at IS NULL
          AND effective_from <= $2::timestamptz
        ORDER BY effective_from DESC LIMIT 1`,
      [row.document_type, now.toISOString()]
    );
    approvalReference = approvals[0]?.approval_reference ?? null;
    if (!approvalReference) reasons.push("counsel_approval_missing");
    const consents = await input.database.unsafe<{ version_identifier: string; consent_text_sha256: string }>(
      `SELECT version_identifier, consent_text_sha256 FROM public.signature_consent_versions
        WHERE locale=$1 AND status='approved' AND effective_from <= $2::timestamptz
        ORDER BY effective_from DESC LIMIT 1`,
      [input.locale, now.toISOString()]
    );
    consentVersion = consents[0]?.version_identifier ?? null;
    consentTextSha256 = consents[0]?.consent_text_sha256 ?? null;
    if (!consentVersion) reasons.push("approved_consent_missing");
  }

  if (row?.version_id) {
    const participants = await input.database.unsafe<{ id: string; normalized_email: string }>(
      `SELECT id::text, normalized_email FROM public.signature_participants
        WHERE document_version_id=$1::uuid ORDER BY id`,
      [row.version_id]
    );
    if (participants.length < 1 || participants.length > 8) reasons.push("participant_count_invalid");
    if (participants.some((participant) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(participant.normalized_email))) {
      reasons.push("participant_email_invalid");
    }
    const fields = await input.database.unsafe<{
      participant_id: string; field_type: "signature" | "initials" | "date" | "text";
      page_index: number; normalized_x: string; normalized_y: string;
      normalized_width: string; normalized_height: string; required: boolean;
      tab_order: number; validation_limits: Record<string, number> | string;
    }>(
      `SELECT participant_id::text, field_type, page_index, normalized_x::text,
              normalized_y::text, normalized_width::text, normalized_height::text,
              required, tab_order, validation_limits
         FROM public.signature_fields WHERE document_version_id=$1::uuid
         ORDER BY tab_order, id`,
      [row.version_id]
    );
    if (fields.length < 1 || fields.length > 100) reasons.push("field_count_invalid");
    if (participants.some((participant) => !fields.some((field) => field.participant_id === participant.id && field.required))) {
      reasons.push("required_participant_field_missing");
    }
    if (fields.length > 0) {
      currentFieldDefinitionSha256 = hashSignatureFieldDefinition({
        documentVersionId: row.version_id,
        fields: fields.map((field) => ({
          participantId: field.participant_id,
          fieldType: field.field_type,
          pageIndex: field.page_index,
          normalizedX: Number(field.normalized_x), normalizedY: Number(field.normalized_y),
          normalizedWidth: Number(field.normalized_width), normalizedHeight: Number(field.normalized_height),
          required: field.required, tabOrder: field.tab_order,
          validationLimits: typeof field.validation_limits === "string" ? JSON.parse(field.validation_limits) : field.validation_limits,
        })),
      });
      if (row.field_definition_sha256 && row.field_definition_sha256 !== currentFieldDefinitionSha256) {
        reasons.push("field_definition_hash_stale");
      }
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
    documentId: row?.id ?? null,
    documentVersionId: row?.version_id ?? null,
    locale: input.locale,
    approvalReference,
    consentVersion,
    consentTextSha256,
    currentFieldDefinitionSha256,
  };
}
