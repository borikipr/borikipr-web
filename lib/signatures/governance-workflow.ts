import { randomUUID } from "node:crypto";
import type { SignatureDatabase, SignatureQueryExecutor } from "./domain/types";
import { sha256SignatureValue } from "./domain/crypto";
import { getSignatureDocumentTypeDefinition } from "./document-classification";
import { canonicalJson } from "./prototype/hash";
import type { SignatureRetentionPolicy } from "./retention-policy";
import { GOVERNANCE_APPROVAL_PHRASE } from "./governance-constants";

type AuditInput = Readonly<{
  entityType: "document_classification" | "consent_version" | "privacy_disclosure" | "retention_policy" | "launch_authorization" | "legal_hold";
  entityId: string;
  action: "created" | "submitted" | "approved" | "activated" | "retired" | "restricted" | "authorized" | "revoked";
  actorAdminId: string;
  previousState: string | null;
  newState: string | null;
  externalApprovalReference?: string | null;
  snapshot: unknown;
  idempotencyKey?: string;
}>;

async function audit(database: SignatureQueryExecutor, input: AuditInput) {
  await database.unsafe(
    `INSERT INTO public.signature_governance_events
      (entity_type,entity_id,action,actor_admin_id,snapshot_sha256,previous_state,new_state,
       external_approval_reference,idempotency_key)
     VALUES ($1,$2::uuid,$3,$4::uuid,$5,$6,$7,$8,$9::uuid)`,
    [input.entityType, input.entityId, input.action, input.actorAdminId,
      sha256SignatureValue(canonicalJson(input.snapshot)), input.previousState, input.newState,
      input.externalApprovalReference ?? null, input.idempotencyKey ?? randomUUID()]
  );
}

function requireApproval(input: {
  externalReviewerName: string;
  externalReviewerReference: string;
  approvalReference: string;
  confirmationPhrase: string;
  immutableAcknowledged: boolean;
}) {
  if (!input.immutableAcknowledged || input.confirmationPhrase.normalize("NFC").trim() !== GOVERNANCE_APPROVAL_PHRASE) {
    throw new Error("signature_governance_confirmation_required");
  }
  if (![input.externalReviewerName, input.externalReviewerReference, input.approvalReference].every((value) => value.trim().length > 0)) {
    throw new Error("signature_governance_external_approval_incomplete");
  }
}

export function hashRetentionPolicy(policy: SignatureRetentionPolicy) {
  return sha256SignatureValue(canonicalJson(policy));
}

export function createSignatureGovernanceWorkflow(database: SignatureDatabase, clock = () => new Date()) {
  return {
    async createClassificationDraft(input: {
      documentType: string; displayName: string; description: string; permittedSigningUse: string;
      actorAdminId: string; idempotencyKey?: string;
    }) {
      const definition = getSignatureDocumentTypeDefinition(input.documentType);
      if (!definition) throw new Error("signature_document_type_invalid");
      return database.begin(async (tx) => {
        const version = await tx.unsafe<{ version_number: number }>(
          `SELECT COALESCE(max(version_number),0)+1 AS version_number
             FROM public.signature_document_type_approvals WHERE document_type=$1`, [input.documentType]);
        const rows = await tx.unsafe<{ id: string; version_number: number }>(
          `INSERT INTO public.signature_document_type_approvals
            (document_type,status,version_number,display_name,description,permitted_signing_use,created_by_admin_id)
           VALUES ($1,'draft',$2,$3,$4,$5,$6::uuid) RETURNING id::text,version_number`,
          [input.documentType, version[0].version_number, input.displayName.trim(), input.description.trim(),
            input.permittedSigningUse.trim(), input.actorAdminId]);
        await audit(tx, { entityType: "document_classification", entityId: rows[0].id, action: "created",
          actorAdminId: input.actorAdminId, previousState: null, newState: "draft",
          snapshot: { documentType: input.documentType, version: rows[0].version_number, classification: definition.classification },
          idempotencyKey: input.idempotencyKey });
        return rows[0];
      });
    },
    async submitClassification(input: { id: string; actorAdminId: string; idempotencyKey?: string }) {
      return database.begin(async (tx) => {
        const rows = await tx.unsafe<{ id: string; document_type: string; version_number: number }>(
          `UPDATE public.signature_document_type_approvals SET status='pending',submitted_at=$2::timestamptz,
             updated_at=$2::timestamptz WHERE id=$1::uuid AND status='draft'
           RETURNING id::text,document_type,version_number`, [input.id, clock().toISOString()]);
        if (!rows[0]) throw new Error("signature_classification_submission_rejected");
        await audit(tx, { entityType: "document_classification", entityId: input.id, action: "submitted",
          actorAdminId: input.actorAdminId, previousState: "draft", newState: "pending", snapshot: rows[0], idempotencyKey: input.idempotencyKey });
        return rows[0];
      });
    },
    async approveClassification(input: {
      id: string; counselName: string; counselLawFirm: string; approvalReference: string;
      sourceReference: string; approvalDate: string; effectiveFrom: Date; notes?: string;
      actorAdminId: string; confirmationPhrase: string; immutableAcknowledged: boolean; idempotencyKey?: string;
    }) {
      requireApproval({ externalReviewerName: input.counselName, externalReviewerReference: input.sourceReference,
        approvalReference: input.approvalReference, confirmationPhrase: input.confirmationPhrase,
        immutableAcknowledged: input.immutableAcknowledged });
      return database.begin(async (tx) => {
        const now = clock().toISOString();
        const rows = await tx.unsafe<{ id: string; document_type: string; version_number: number }>(
          `UPDATE public.signature_document_type_approvals SET status='approved',approval_reference=$2,
             approval_date=$3::date,reviewed_by=$4,source_reference=$5,effective_from=$6::timestamptz,
             notes=$7,entered_by_admin_id=$8::uuid,counsel_name=$4,counsel_law_firm=$9,
             approved_at=$10::timestamptz,updated_at=$10::timestamptz
           WHERE id=$1::uuid AND status='pending' RETURNING id::text,document_type,version_number`,
          [input.id,input.approvalReference.trim(),input.approvalDate,input.counselName.trim(),
            input.sourceReference.trim(),input.effectiveFrom.toISOString(),input.notes?.trim() || null,
            input.actorAdminId,input.counselLawFirm.trim(),now]);
        if (!rows[0]) throw new Error("signature_classification_approval_rejected");
        await audit(tx, { entityType: "document_classification", entityId: input.id, action: "approved",
          actorAdminId: input.actorAdminId, previousState: "pending", newState: "approved",
          externalApprovalReference: input.approvalReference, snapshot: rows[0], idempotencyKey: input.idempotencyKey });
        return rows[0];
      });
    },
    async createConsentDraft(input: { versionIdentifier: string; locale: "es-PR" | "en-US"; text: string; actorAdminId: string; idempotencyKey?: string }) {
      const normalized = input.text.normalize("NFC").trim();
      const digest = sha256SignatureValue(normalized);
      return database.begin(async (tx) => {
        const rows = await tx.unsafe<{ id: string }>(`INSERT INTO public.signature_consent_versions
          (version_identifier,locale,consent_text,consent_text_sha256,created_by_admin_id)
          VALUES ($1,$2,$3,$4,$5::uuid) RETURNING id::text`,
          [input.versionIdentifier, input.locale, normalized, digest, input.actorAdminId]);
        await audit(tx, { entityType: "consent_version", entityId: rows[0].id, action: "created", actorAdminId: input.actorAdminId,
          previousState: null, newState: "draft", snapshot: { version: input.versionIdentifier, locale: input.locale, sha256: digest },
          idempotencyKey: input.idempotencyKey });
        return { id: rows[0].id, sha256: digest };
      });
    },
    async submitConsent(input: { id: string; actorAdminId: string; idempotencyKey?: string }) {
      return database.begin(async (tx) => {
        const rows = await tx.unsafe<{ id: string; locale: string; consent_text_sha256: string }>(
          `UPDATE public.signature_consent_versions SET status='pending_review',submitted_at=$2::timestamptz,
             updated_at=$2::timestamptz WHERE id=$1::uuid AND status='draft'
           RETURNING id::text,locale,consent_text_sha256`, [input.id, clock().toISOString()]);
        if (!rows[0]) throw new Error("signature_consent_submission_rejected");
        await audit(tx, { entityType: "consent_version", entityId: input.id, action: "submitted", actorAdminId: input.actorAdminId,
          previousState: "draft", newState: "pending_review", snapshot: rows[0], idempotencyKey: input.idempotencyKey });
        return rows[0];
      });
    },
    async approveConsent(input: {
      id: string; approvalReference: string; externalReviewerName: string; externalReviewerReference: string;
      effectiveFrom: Date; actorAdminId: string; confirmationPhrase: string; immutableAcknowledged: boolean; idempotencyKey?: string;
    }) {
      requireApproval({ ...input });
      return database.begin(async (tx) => {
        const now = clock().toISOString();
        const rows = await tx.unsafe<{ id: string; locale: string; consent_text_sha256: string }>(
          `UPDATE public.signature_consent_versions SET status='approved',approval_reference=$2,
             effective_from=$3::timestamptz,approved_at=$4::timestamptz,approved_by_admin_id=$5::uuid,
             external_reviewer_name=$6,external_reviewer_reference=$7,updated_at=$4::timestamptz
           WHERE id=$1::uuid AND status='pending_review' RETURNING id::text,locale,consent_text_sha256`,
          [input.id,input.approvalReference.trim(),input.effectiveFrom.toISOString(),now,input.actorAdminId,
            input.externalReviewerName.trim(),input.externalReviewerReference.trim()]);
        if (!rows[0]) throw new Error("signature_consent_approval_rejected");
        await audit(tx, { entityType: "consent_version", entityId: input.id, action: "approved", actorAdminId: input.actorAdminId,
          previousState: "pending_review", newState: "approved", externalApprovalReference: input.approvalReference,
          snapshot: rows[0], idempotencyKey: input.idempotencyKey });
        return rows[0];
      });
    },
    async createPrivacyDraft(input: { versionIdentifier: string; esPRText: string; enUSText: string; actorAdminId: string; idempotencyKey?: string }) {
      const es = input.esPRText.normalize("NFC").trim();
      const en = input.enUSText.normalize("NFC").trim();
      const esHash = sha256SignatureValue(es);
      const enHash = sha256SignatureValue(en);
      return database.begin(async (tx) => {
        const rows = await tx.unsafe<{ id: string }>(`INSERT INTO public.signature_privacy_disclosure_versions
          (version_identifier,es_pr_text,en_us_text,es_pr_sha256,en_us_sha256,created_by_admin_id)
          VALUES ($1,$2,$3,$4,$5,$6::uuid) RETURNING id::text`,
          [input.versionIdentifier,es,en,esHash,enHash,input.actorAdminId]);
        await audit(tx, { entityType: "privacy_disclosure", entityId: rows[0].id, action: "created", actorAdminId: input.actorAdminId,
          previousState: null, newState: "draft", snapshot: { version: input.versionIdentifier, esHash, enHash }, idempotencyKey: input.idempotencyKey });
        return { id: rows[0].id, esHash, enHash };
      });
    },
    async submitPrivacy(input: { id: string; actorAdminId: string; idempotencyKey?: string }) {
      return database.begin(async (tx) => {
        const rows = await tx.unsafe<{ id: string; es_pr_sha256: string; en_us_sha256: string }>(
          `UPDATE public.signature_privacy_disclosure_versions SET status='pending_review',submitted_at=$2::timestamptz,
             updated_at=$2::timestamptz WHERE id=$1::uuid AND status='draft'
           RETURNING id::text,es_pr_sha256,en_us_sha256`, [input.id, clock().toISOString()]);
        if (!rows[0]) throw new Error("signature_privacy_submission_rejected");
        await audit(tx, { entityType: "privacy_disclosure", entityId: input.id, action: "submitted", actorAdminId: input.actorAdminId,
          previousState: "draft", newState: "pending_review", snapshot: rows[0], idempotencyKey: input.idempotencyKey });
        return rows[0];
      });
    },
    async approvePrivacy(input: {
      id: string; approvalReference: string; externalReviewerName: string; externalReviewerReference: string;
      effectiveFrom: Date; actorAdminId: string; confirmationPhrase: string; immutableAcknowledged: boolean; idempotencyKey?: string;
    }) {
      requireApproval({ ...input });
      return database.begin(async (tx) => {
        const now = clock().toISOString();
        const rows = await tx.unsafe<{ id: string; es_pr_sha256: string; en_us_sha256: string }>(
          `UPDATE public.signature_privacy_disclosure_versions SET status='approved',approval_reference=$2,
             effective_from=$3::timestamptz,approved_at=$4::timestamptz,approved_by_admin_id=$5::uuid,
             external_reviewer_name=$6,external_reviewer_reference=$7,updated_at=$4::timestamptz
           WHERE id=$1::uuid AND status='pending_review' RETURNING id::text,es_pr_sha256,en_us_sha256`,
          [input.id,input.approvalReference.trim(),input.effectiveFrom.toISOString(),now,input.actorAdminId,
            input.externalReviewerName.trim(),input.externalReviewerReference.trim()]);
        if (!rows[0]) throw new Error("signature_privacy_approval_rejected");
        await audit(tx, { entityType: "privacy_disclosure", entityId: input.id, action: "approved", actorAdminId: input.actorAdminId,
          previousState: "pending_review", newState: "approved", externalApprovalReference: input.approvalReference,
          snapshot: rows[0], idempotencyKey: input.idempotencyKey });
        return rows[0];
      });
    },
    async createRetentionDraft(input: { versionIdentifier: string; privacyReference: string; policy: SignatureRetentionPolicy; actorAdminId: string; idempotencyKey?: string }) {
      const p = input.policy;
      const digest = hashRetentionPolicy(p);
      return database.begin(async (tx) => {
        const rows = await tx.unsafe<{ id: string }>(`INSERT INTO public.signature_retention_policy_versions
          (version_identifier,privacy_reference,source_pdf_days,completed_pdf_days,certificate_days,
           evidence_manifest_days,token_days,session_hours,network_evidence_days,failed_cancelled_draft_days,
           audit_event_days,completed_cleanup_enabled,policy_sha256,created_by_admin_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::uuid) RETURNING id::text`,
          [input.versionIdentifier,input.privacyReference,p.sourcePdfDays,p.completedPdfDays,p.certificateDays,
            p.evidenceManifestDays,p.tokenDays,p.sessionHours,p.networkEvidenceDays,p.failedCancelledDraftDays,
            p.auditEventDays,p.completedCleanupEnabled,digest,input.actorAdminId]);
        await audit(tx, { entityType: "retention_policy", entityId: rows[0].id, action: "created", actorAdminId: input.actorAdminId,
          previousState: null, newState: "draft", snapshot: { version: input.versionIdentifier, sha256: digest }, idempotencyKey: input.idempotencyKey });
        return { id: rows[0].id, sha256: digest };
      });
    },
    async submitRetention(input: { id: string; actorAdminId: string; idempotencyKey?: string }) {
      return database.begin(async (tx) => {
        const rows = await tx.unsafe<{ id: string; policy_sha256: string }>(
          `UPDATE public.signature_retention_policy_versions SET status='pending_review',submitted_at=$2::timestamptz,
             updated_at=$2::timestamptz WHERE id=$1::uuid AND status='draft'
           RETURNING id::text,policy_sha256`, [input.id, clock().toISOString()]);
        if (!rows[0]) throw new Error("signature_retention_submission_rejected");
        await audit(tx, { entityType: "retention_policy", entityId: input.id, action: "submitted", actorAdminId: input.actorAdminId,
          previousState: "draft", newState: "pending_review", snapshot: rows[0], idempotencyKey: input.idempotencyKey });
        return rows[0];
      });
    },
    async approveRetention(input: {
      id: string; approvalReference: string; externalReviewerName: string; externalReviewerReference: string;
      actorAdminId: string; confirmationPhrase: string; immutableAcknowledged: boolean; idempotencyKey?: string;
    }) {
      requireApproval({ ...input });
      return database.begin(async (tx) => {
        const now = clock().toISOString();
        const rows = await tx.unsafe<{ id: string; policy_sha256: string }>(
          `UPDATE public.signature_retention_policy_versions SET status='approved',approval_reference=$2,
             approved_at=$3::timestamptz,approved_by_admin_id=$4::uuid,external_reviewer_name=$5,
             external_reviewer_reference=$6,updated_at=$3::timestamptz
           WHERE id=$1::uuid AND status='pending_review' AND policy_sha256 ~ '^[0-9a-f]{64}$'
           RETURNING id::text,policy_sha256`,
          [input.id,input.approvalReference.trim(),now,input.actorAdminId,input.externalReviewerName.trim(),input.externalReviewerReference.trim()]);
        if (!rows[0]) throw new Error("signature_retention_approval_rejected");
        await audit(tx, { entityType: "retention_policy", entityId: input.id, action: "approved", actorAdminId: input.actorAdminId,
          previousState: "pending_review", newState: "approved", externalApprovalReference: input.approvalReference,
          snapshot: rows[0], idempotencyKey: input.idempotencyKey });
        return rows[0];
      });
    },
    async activateRetention(input: { id: string; actorAdminId: string; confirmationPhrase: string; immutableAcknowledged: boolean; idempotencyKey?: string }) {
      if (!input.immutableAcknowledged || input.confirmationPhrase.normalize("NFC").trim() !== GOVERNANCE_APPROVAL_PHRASE) {
        throw new Error("signature_governance_confirmation_required");
      }
      return database.begin(async (tx) => {
        const now = clock().toISOString();
        const rows = await tx.unsafe<{ id: string; policy_sha256: string }>(
          `UPDATE public.signature_retention_policy_versions SET status='active',activated_at=$2::timestamptz,
             activated_by_admin_id=$3::uuid,updated_at=$2::timestamptz WHERE id=$1::uuid AND status='approved'
           RETURNING id::text,policy_sha256`, [input.id,now,input.actorAdminId]);
        if (!rows[0]) throw new Error("signature_retention_activation_rejected");
        await audit(tx, { entityType: "retention_policy", entityId: input.id, action: "activated", actorAdminId: input.actorAdminId,
          previousState: "approved", newState: "active", snapshot: rows[0], idempotencyKey: input.idempotencyKey });
        return rows[0];
      });
    },
    async authorizeProductionCanary(input: { readinessSnapshotSha256: string; participantScope: readonly string[]; documentTypes: readonly string[]; expiresAt: Date; notes?: string; actorAdminId: string; explicitConfirmation: boolean; idempotencyKey?: string }) {
      if (!input.explicitConfirmation || input.participantScope.length < 1 || input.participantScope.length > 8 || input.documentTypes.length < 1 || input.expiresAt <= clock()) {
        throw new Error("signature_production_canary_scope_required");
      }
      if (!input.readinessSnapshotSha256.match(/^[0-9a-f]{64}$/) || input.documentTypes.some((value) => !getSignatureDocumentTypeDefinition(value))) {
        throw new Error("signature_production_canary_scope_invalid");
      }
      return database.begin(async (tx) => {
        const rows=await tx.unsafe<{id:string}>(`INSERT INTO signature_launch_authorizations
          (environment,authorization_type,readiness_snapshot_sha256,notes,explicit_confirmation,
           authorized_by_admin_id,expires_at,authorized_participant_scope,authorized_document_types)
          VALUES ('production','internal_canary',$1,$2,true,$3::uuid,$4::timestamptz,$5::jsonb,$6::text[])
          RETURNING id::text`,[input.readinessSnapshotSha256,input.notes?.trim()||null,input.actorAdminId,
            input.expiresAt.toISOString(),JSON.stringify(input.participantScope),[...input.documentTypes]]);
        await audit(tx,{entityType:"launch_authorization",entityId:rows[0].id,action:"authorized",actorAdminId:input.actorAdminId,
          previousState:null,newState:"active",snapshot:{environment:"production",type:"internal_canary",readiness:input.readinessSnapshotSha256,
            participantScopeCount:input.participantScope.length,documentTypes:[...input.documentTypes],expiresAt:input.expiresAt.toISOString()},idempotencyKey:input.idempotencyKey});
        return rows[0];
      });
    },
    async revokeProductionCanary(input: { id: string; actorAdminId: string; explicitConfirmation: boolean; idempotencyKey?: string }) {
      if (!input.explicitConfirmation) throw new Error("signature_production_canary_revoke_confirmation_required");
      return database.begin(async (tx) => {
        const now = clock().toISOString();
        const rows = await tx.unsafe<{id:string;readiness_snapshot_sha256:string}>(`UPDATE signature_launch_authorizations
          SET status='revoked',revoked_at=$2::timestamptz
          WHERE id=$1::uuid AND environment='production' AND authorization_type='internal_canary' AND status='active'
          RETURNING id::text,readiness_snapshot_sha256`,[input.id,now]);
        if (!rows[0]) throw new Error("signature_production_canary_revoke_rejected");
        await audit(tx,{entityType:"launch_authorization",entityId:rows[0].id,action:"revoked",actorAdminId:input.actorAdminId,
          previousState:"active",newState:"revoked",snapshot:{environment:"production",type:"internal_canary",readiness:rows[0].readiness_snapshot_sha256,revokedAt:now},idempotencyKey:input.idempotencyKey});
        return rows[0];
      });
    },
  };
}

export async function getSignatureRetentionPreview(database: SignatureQueryExecutor, now = new Date()) {
  const rows = await database.unsafe<{
    drafts: number; sessions: number; tokens: number; completed: number; legal_holds: number;
  }>(`SELECT
    (SELECT count(*)::int FROM signature_documents WHERE status='draft') drafts,
    (SELECT count(*)::int FROM signature_sessions WHERE completed_at IS NULL AND revoked_at IS NULL) sessions,
    (SELECT count(*)::int FROM signature_signing_tokens WHERE revoked_at IS NULL AND superseded_at IS NULL) tokens,
    (SELECT count(*)::int FROM signature_documents WHERE status='completed') completed,
    (SELECT count(*)::int FROM signature_legal_holds WHERE status='active') legal_holds`);
  return Object.freeze({ asOf: now.toISOString(), ...rows[0], destructiveActionPerformed: false as const });
}
