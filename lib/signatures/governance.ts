import { sha256SignatureValue } from "./domain/crypto";
import type { SignatureDatabase } from "./domain/types";
import { getSignatureDocumentTypeDefinition } from "./document-classification";

export function createSignatureGovernanceService(database: SignatureDatabase, clock: () => Date = () => new Date()) {
  return {
    async createPendingApproval(input: { documentType: string; notes?: string | null }) {
      if (!getSignatureDocumentTypeDefinition(input.documentType)) throw new Error("signature_document_type_invalid");
      const rows = await database.unsafe<{ id: string }>(
        `INSERT INTO public.signature_document_type_approvals (document_type, status, notes)
         VALUES ($1,'pending',$2) RETURNING id::text`, [input.documentType, input.notes ?? null]
      );
      return { approvalId: rows[0].id, status: "pending" as const };
    },
    async recordCounselDecision(input: {
      approvalId: string; status: "approved" | "restricted";
      approvalReference: string; approvalDate: string; reviewedBy: string;
      sourceReference: string; effectiveFrom: Date; notes?: string | null;
    }) {
      if (!input.approvalReference.trim() || !input.reviewedBy.trim() || !input.sourceReference.trim()) {
        throw new Error("signature_counsel_evidence_incomplete");
      }
      const rows = await database.unsafe<{ id: string }>(
        `UPDATE public.signature_document_type_approvals SET status=$2,
          approval_reference=$3, approval_date=$4::date, reviewed_by=$5,
          source_reference=$6, effective_from=$7::timestamptz, notes=$8,
          updated_at=$9::timestamptz WHERE id=$1::uuid AND status='pending'
          RETURNING id::text`, [input.approvalId, input.status, input.approvalReference,
          input.approvalDate, input.reviewedBy, input.sourceReference,
          input.effectiveFrom.toISOString(), input.notes ?? null, clock().toISOString()]
      );
      if (!rows[0]) throw new Error("signature_counsel_decision_rejected");
      return { approvalId: rows[0].id, status: input.status };
    },
    async revokeApproval(input: { approvalId: string }) {
      const now = clock().toISOString();
      const rows = await database.unsafe<{ id: string }>(
        `UPDATE public.signature_document_type_approvals SET status='revoked', revoked_at=$2::timestamptz,
          updated_at=$2::timestamptz WHERE id=$1::uuid AND status='approved' RETURNING id::text`,
        [input.approvalId, now]
      );
      if (!rows[0]) throw new Error("signature_approval_revocation_rejected");
      return { revoked: true as const };
    },
    async createConsentDraft(input: {
      versionIdentifier: string; locale: "es-PR" | "en-US"; consentText: string;
      createdByAdminId: string;
    }) {
      const normalized = input.consentText.normalize("NFC");
      const digest = sha256SignatureValue(normalized);
      const rows = await database.unsafe<{ id: string }>(
        `INSERT INTO public.signature_consent_versions (
          version_identifier, locale, consent_text, consent_text_sha256, created_by_admin_id
        ) VALUES ($1,$2,$3,$4,$5::uuid) RETURNING id::text`,
        [input.versionIdentifier, input.locale, normalized, digest, input.createdByAdminId]
      );
      return { consentVersionId: rows[0].id, consentTextSha256: digest, status: "draft" as const };
    },
    async approveConsent(input: { consentVersionId: string; approvalReference: string; effectiveFrom: Date }) {
      const rows = await database.unsafe<{ id: string }>(
        `UPDATE public.signature_consent_versions SET status='approved', approval_reference=$2,
          effective_from=$3::timestamptz, updated_at=$4::timestamptz
          WHERE id=$1::uuid AND status='draft' RETURNING id::text`,
        [input.consentVersionId, input.approvalReference, input.effectiveFrom.toISOString(), clock().toISOString()]
      );
      if (!rows[0]) throw new Error("signature_consent_approval_rejected");
      return { approved: true as const };
    },
    async retireConsent(input: { consentVersionId: string }) {
      const rows = await database.unsafe<{ id: string }>(
        `UPDATE public.signature_consent_versions SET status='retired', updated_at=$2::timestamptz
          WHERE id=$1::uuid AND status='approved' RETURNING id::text`,
        [input.consentVersionId, clock().toISOString()]
      );
      if (!rows[0]) throw new Error("signature_consent_retirement_rejected");
      return { retired: true as const };
    },
  };
}
