import { randomUUID } from "node:crypto";
import type { SignatureDatabase, SignatureQueryExecutor } from "./domain/types";
import { sha256SignatureValue } from "./domain/crypto";
import { getSignatureDocumentTypeDefinition, type SignatureApprovalMode } from "./document-classification";
import { canonicalJson } from "./prototype/hash";
import type { SignatureRetentionPolicy } from "./retention-policy";
import { GOVERNANCE_APPROVAL_PHRASE, RETENTION_ACTIVATION_PHRASE } from "./governance-constants";
import { evaluateSignaturePreflight, INTERNAL_CANARY_CONFIRMATION_PHRASE, persistSignatureReadinessSnapshot, type SignaturePreflightLocale } from "./preflight";

type AuditInput = Readonly<{
  entityType: "document_classification" | "consent_version" | "privacy_disclosure" | "retention_policy" | "launch_authorization" | "legal_hold" | "readiness_snapshot";
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
  approvalMode: Exclude<SignatureApprovalMode, "out_of_scope">;
  approverRole: string;
  externalReviewerName?: string;
  externalReviewerReference?: string;
  approvalReference: string;
  confirmationPhrase: string;
  immutableAcknowledged: boolean;
}) {
  if (!input.immutableAcknowledged || input.confirmationPhrase.normalize("NFC").trim() !== GOVERNANCE_APPROVAL_PHRASE) {
    throw new Error("signature_governance_confirmation_required");
  }
  if (!input.approvalReference.trim() || !input.approverRole.trim()) {
    throw new Error("signature_governance_approval_source_incomplete");
  }
  if (input.approvalMode === "external_review" &&
      ![input.externalReviewerName, input.externalReviewerReference].every((value) => value?.trim().length)) {
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
          snapshot: { documentType: input.documentType, version: rows[0].version_number, scope: definition.scope },
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
      id: string; approvalMode: SignatureApprovalMode; approvalReference: string; approverRole: string;
      externalReviewerName?: string; externalReviewerOrganization?: string; externalReviewerRole?: string;
      externalReviewerReference?: string; approvalDate: string; effectiveFrom: Date; notes?: string;
      actorAdminId: string; confirmationPhrase: string; immutableAcknowledged: boolean; idempotencyKey?: string;
    }) {
      if (input.approvalMode !== "out_of_scope") {
        requireApproval({ approvalMode: input.approvalMode, approverRole: input.approverRole,
          externalReviewerName: input.externalReviewerName, externalReviewerReference: input.externalReviewerReference,
          approvalReference: input.approvalReference, confirmationPhrase: input.confirmationPhrase,
          immutableAcknowledged: input.immutableAcknowledged });
      } else if (!input.immutableAcknowledged || input.confirmationPhrase.normalize("NFC").trim() !== GOVERNANCE_APPROVAL_PHRASE || !input.approvalReference.trim() || !input.approverRole.trim()) {
        throw new Error("signature_governance_confirmation_required");
      }
      return database.begin(async (tx) => {
        const now = clock().toISOString();
        const pending = await tx.unsafe<{ document_type:string;version_number:number;display_name:string;description:string;permitted_signing_use:string }>(
          `SELECT document_type,version_number,display_name,description,permitted_signing_use
             FROM public.signature_document_type_approvals WHERE id=$1::uuid AND status='pending' FOR UPDATE`, [input.id]);
        if (!pending[0]) throw new Error("signature_classification_approval_rejected");
        const definition=getSignatureDocumentTypeDefinition(pending[0].document_type);
        if(definition?.scope!=="ordinary_brokerage" && input.approvalMode==="internal_business") throw new Error("signature_high_formality_internal_approval_blocked");
        const snapshot = { ...pending[0], approvalMode: input.approvalMode,
          approvalReference: input.approvalReference.trim(), approverRole: input.approverRole.trim(),
          externalReviewerName: input.externalReviewerName?.trim() || null,
          externalReviewerOrganization: input.externalReviewerOrganization?.trim() || null,
          externalReviewerRole: input.externalReviewerRole?.trim() || null,
          externalReviewerReference: input.externalReviewerReference?.trim() || null,
          approvalDate: input.approvalDate, effectiveFrom: input.effectiveFrom.toISOString() };
        const snapshotSha256 = sha256SignatureValue(canonicalJson(snapshot));
        const targetStatus = input.approvalMode === "out_of_scope" ? "restricted" : "approved";
        const rows = await tx.unsafe<{ id: string; document_type: string; version_number: number }>(
          `UPDATE public.signature_document_type_approvals SET status=$2,approval_mode=$3,approval_reference=$4,
             approval_date=$5::date,reviewed_by=$6,source_reference=$7,effective_from=$8::timestamptz,
             notes=$9,entered_by_admin_id=$10::uuid,approved_by_admin_id=$10::uuid,approver_role=$11,
             counsel_name=$12,counsel_law_firm=$13,external_reviewer_role=$14,
             approval_snapshot_sha256=$15,approved_at=$16::timestamptz,updated_at=$16::timestamptz
           WHERE id=$1::uuid AND status='pending' RETURNING id::text,document_type,version_number`,
          [input.id,targetStatus,input.approvalMode,input.approvalReference.trim(),input.approvalDate,
            input.approvalMode === "external_review" ? input.externalReviewerName?.trim() : "Erickson Real Estate",
            input.approvalMode === "external_review" ? input.externalReviewerReference?.trim() : input.approvalReference.trim(),
            input.effectiveFrom.toISOString(),input.notes?.trim() || null,input.actorAdminId,input.approverRole.trim(),
            input.approvalMode === "external_review" ? input.externalReviewerName?.trim() : null,
            input.approvalMode === "external_review" ? input.externalReviewerOrganization?.trim() : null,
            input.approvalMode === "external_review" ? input.externalReviewerRole?.trim() || null : null,
            snapshotSha256,now]);
        if (!rows[0]) throw new Error("signature_classification_approval_rejected");
        await audit(tx, { entityType: "document_classification", entityId: input.id,
          action: input.approvalMode === "out_of_scope" ? "restricted" : "approved",
          actorAdminId: input.actorAdminId, previousState: "pending", newState: targetStatus,
          externalApprovalReference: input.approvalMode === "external_review" ? input.approvalReference : null,
          snapshot: { ...rows[0], approvalMode: input.approvalMode, snapshotSha256 }, idempotencyKey: input.idempotencyKey });
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
      id: string; approvalMode: Exclude<SignatureApprovalMode,"out_of_scope">; approvalReference: string; approverRole: string;
      externalReviewerName?: string; externalReviewerReference?: string;
      effectiveFrom: Date; actorAdminId: string; confirmationPhrase: string; immutableAcknowledged: boolean; idempotencyKey?: string;
    }) {
      requireApproval({ ...input });
      return database.begin(async (tx) => {
        const [pending]=await tx.unsafe<{consent_text:string;consent_text_sha256:string}>(`SELECT consent_text,consent_text_sha256 FROM signature_consent_versions WHERE id=$1::uuid AND status='pending_review' FOR UPDATE`,[input.id]);
        if(!pending || sha256SignatureValue(pending.consent_text.normalize("NFC").trim())!==pending.consent_text_sha256) throw new Error("signature_consent_hash_mismatch");
        const now = clock().toISOString();
        const rows = await tx.unsafe<{ id: string; locale: string; consent_text_sha256: string }>(
          `UPDATE public.signature_consent_versions SET status='approved',approval_mode=$2,approval_reference=$3,
             effective_from=$4::timestamptz,approved_at=$5::timestamptz,approved_by_admin_id=$6::uuid,
             approver_role=$7,external_reviewer_name=$8,external_reviewer_reference=$9,updated_at=$5::timestamptz
           WHERE id=$1::uuid AND status='pending_review' RETURNING id::text,locale,consent_text_sha256`,
          [input.id,input.approvalMode,input.approvalReference.trim(),input.effectiveFrom.toISOString(),now,input.actorAdminId,
            input.approverRole.trim(),input.approvalMode === "external_review" ? input.externalReviewerName?.trim() : null,
            input.approvalMode === "external_review" ? input.externalReviewerReference?.trim() : null]);
        if (!rows[0]) throw new Error("signature_consent_approval_rejected");
        await audit(tx, { entityType: "consent_version", entityId: input.id, action: "approved", actorAdminId: input.actorAdminId,
          previousState: "pending_review", newState: "approved", externalApprovalReference: input.approvalMode === "external_review" ? input.approvalReference : null,
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
      id: string; approvalMode: Exclude<SignatureApprovalMode,"out_of_scope">; approvalReference: string; approverRole: string;
      externalReviewerName?: string; externalReviewerReference?: string;
      effectiveFrom: Date; actorAdminId: string; confirmationPhrase: string; immutableAcknowledged: boolean; idempotencyKey?: string;
    }) {
      requireApproval({ ...input });
      return database.begin(async (tx) => {
        const [pending]=await tx.unsafe<{es_pr_text:string;en_us_text:string;es_pr_sha256:string;en_us_sha256:string}>(`SELECT es_pr_text,en_us_text,es_pr_sha256,en_us_sha256 FROM signature_privacy_disclosure_versions WHERE id=$1::uuid AND status='pending_review' FOR UPDATE`,[input.id]);
        if(!pending || sha256SignatureValue(pending.es_pr_text.normalize("NFC").trim())!==pending.es_pr_sha256 || sha256SignatureValue(pending.en_us_text.normalize("NFC").trim())!==pending.en_us_sha256) throw new Error("signature_privacy_hash_mismatch");
        const now = clock().toISOString();
        const rows = await tx.unsafe<{ id: string; es_pr_sha256: string; en_us_sha256: string }>(
          `UPDATE public.signature_privacy_disclosure_versions SET status='approved',approval_mode=$2,approval_reference=$3,
             effective_from=$4::timestamptz,approved_at=$5::timestamptz,approved_by_admin_id=$6::uuid,
             approver_role=$7,external_reviewer_name=$8,external_reviewer_reference=$9,updated_at=$5::timestamptz
           WHERE id=$1::uuid AND status='pending_review' RETURNING id::text,es_pr_sha256,en_us_sha256`,
          [input.id,input.approvalMode,input.approvalReference.trim(),input.effectiveFrom.toISOString(),now,input.actorAdminId,
            input.approverRole.trim(),input.approvalMode === "external_review" ? input.externalReviewerName?.trim() : null,
            input.approvalMode === "external_review" ? input.externalReviewerReference?.trim() : null]);
        if (!rows[0]) throw new Error("signature_privacy_approval_rejected");
        await audit(tx, { entityType: "privacy_disclosure", entityId: input.id, action: "approved", actorAdminId: input.actorAdminId,
          previousState: "pending_review", newState: "approved", externalApprovalReference: input.approvalMode === "external_review" ? input.approvalReference : null,
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
      id: string; approvalMode: Exclude<SignatureApprovalMode,"out_of_scope">; approvalReference: string; approverRole: string;
      externalReviewerName?: string; externalReviewerReference?: string;
      actorAdminId: string; confirmationPhrase: string; immutableAcknowledged: boolean; idempotencyKey?: string;
    }) {
      requireApproval({ ...input });
      return database.begin(async (tx) => {
        const now = clock().toISOString();
        const [pending]=await tx.unsafe<{version_identifier:string;privacy_reference:string;source_pdf_days:number;completed_pdf_days:number|null;certificate_days:number|null;evidence_manifest_days:number|null;token_days:number;session_hours:number;network_evidence_days:number;failed_cancelled_draft_days:number;audit_event_days:number|null;completed_cleanup_enabled:boolean}>(`SELECT version_identifier,privacy_reference,source_pdf_days,completed_pdf_days,certificate_days,evidence_manifest_days,token_days,session_hours,network_evidence_days,failed_cancelled_draft_days,audit_event_days,completed_cleanup_enabled FROM signature_retention_policy_versions WHERE id=$1::uuid AND status='pending_review' FOR UPDATE`,[input.id]);
        if(!pending) throw new Error("signature_retention_approval_rejected");
        const approvedHash=hashRetentionPolicy({version:pending.version_identifier,approvalReference:input.approvalReference.trim(),privacyReference:pending.privacy_reference,sourcePdfDays:pending.source_pdf_days,completedPdfDays:pending.completed_pdf_days,certificateDays:pending.certificate_days,evidenceManifestDays:pending.evidence_manifest_days,tokenDays:pending.token_days,sessionHours:pending.session_hours,networkEvidenceDays:pending.network_evidence_days,failedCancelledDraftDays:pending.failed_cancelled_draft_days,auditEventDays:pending.audit_event_days,completedCleanupEnabled:pending.completed_cleanup_enabled});
        const rows = await tx.unsafe<{ id: string; policy_sha256: string }>(
          `UPDATE public.signature_retention_policy_versions SET status='approved',approval_mode=$2,approval_reference=$3,
             approved_at=$4::timestamptz,approved_by_admin_id=$5::uuid,approver_role=$6,external_reviewer_name=$7,
             external_reviewer_reference=$8,policy_sha256=$9,updated_at=$4::timestamptz
           WHERE id=$1::uuid AND status='pending_review' AND policy_sha256 ~ '^[0-9a-f]{64}$'
           RETURNING id::text,policy_sha256`,
          [input.id,input.approvalMode,input.approvalReference.trim(),now,input.actorAdminId,input.approverRole.trim(),
            input.approvalMode === "external_review" ? input.externalReviewerName?.trim() : null,
            input.approvalMode === "external_review" ? input.externalReviewerReference?.trim() : null,approvedHash]);
        if (!rows[0]) throw new Error("signature_retention_approval_rejected");
        await audit(tx, { entityType: "retention_policy", entityId: input.id, action: "approved", actorAdminId: input.actorAdminId,
          previousState: "pending_review", newState: "approved", externalApprovalReference: input.approvalMode === "external_review" ? input.approvalReference : null,
          snapshot: rows[0], idempotencyKey: input.idempotencyKey });
        return rows[0];
      });
    },
    async activateRetention(input: { id: string; actorAdminId: string; confirmationPhrase: string; immutableAcknowledged: boolean; idempotencyKey?: string }) {
      if (!input.immutableAcknowledged || input.confirmationPhrase.normalize("NFC").trim() !== RETENTION_ACTIVATION_PHRASE) {
        throw new Error("signature_governance_confirmation_required");
      }
      return database.begin(async (tx) => {
        const [policy]=await tx.unsafe<{version_identifier:string;approval_reference:string;privacy_reference:string;source_pdf_days:number;completed_pdf_days:number|null;certificate_days:number|null;evidence_manifest_days:number|null;token_days:number;session_hours:number;network_evidence_days:number;failed_cancelled_draft_days:number;audit_event_days:number|null;completed_cleanup_enabled:boolean;policy_sha256:string}>(`SELECT version_identifier,approval_reference,privacy_reference,source_pdf_days,completed_pdf_days,certificate_days,evidence_manifest_days,token_days,session_hours,network_evidence_days,failed_cancelled_draft_days,audit_event_days,completed_cleanup_enabled,policy_sha256 FROM signature_retention_policy_versions WHERE id=$1::uuid AND status='approved' FOR UPDATE`,[input.id]);
        if(!policy) throw new Error("signature_retention_activation_rejected");
        const computed=hashRetentionPolicy({version:policy.version_identifier,approvalReference:policy.approval_reference,privacyReference:policy.privacy_reference,sourcePdfDays:policy.source_pdf_days,completedPdfDays:policy.completed_pdf_days,certificateDays:policy.certificate_days,evidenceManifestDays:policy.evidence_manifest_days,tokenDays:policy.token_days,sessionHours:policy.session_hours,networkEvidenceDays:policy.network_evidence_days,failedCancelledDraftDays:policy.failed_cancelled_draft_days,auditEventDays:policy.audit_event_days,completedCleanupEnabled:policy.completed_cleanup_enabled});
        if(computed!==policy.policy_sha256) throw new Error("signature_retention_hash_mismatch");
        await getSignatureRetentionPreview(tx,clock());
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
    async authorizeProductionCanary(input: { documentId:string; participantEmails:readonly string[]; documentTypes:readonly string[]; locales:readonly SignaturePreflightLocale[]; expiresAt:Date; notes?:string; actorAdminId:string; explicitConfirmation:boolean; confirmationPhrase:string; environmentVariables?:Readonly<Record<string,string|undefined>>; idempotencyKey?:string }) {
      if(!input.explicitConfirmation || input.confirmationPhrase?.normalize("NFC").trim()!==INTERNAL_CANARY_CONFIRMATION_PHRASE) throw new Error("signature_production_canary_confirmation_required");
      if(input.documentTypes.some((value)=>!getSignatureDocumentTypeDefinition(value))) throw new Error("signature_production_canary_scope_invalid");
      return database.begin(async(tx)=>{
        const preflight=await evaluateSignaturePreflight({database:tx,documentId:input.documentId,participantEmails:input.participantEmails,
          documentTypes:input.documentTypes,locales:input.locales,environment:"production",authorizationType:"internal_canary",
          authorizationExpiresAt:input.expiresAt,environmentVariables:input.environmentVariables,now:clock()});
        if(preflight.overallStatus!=="pass") throw new Error(`signature_preflight_blocked:${preflight.blockingItems.map((entry)=>entry.code).join(",")}`);
        const snapshot=await persistSignatureReadinessSnapshot({database:tx,result:preflight,actorAdminId:input.actorAdminId});
        const [row]=await tx.unsafe<{id:string}>(`INSERT INTO signature_launch_authorizations
          (environment,authorization_type,readiness_snapshot_sha256,readiness_snapshot_id,notes,explicit_confirmation,
           authorized_by_admin_id,authorized_at,expires_at,authorized_participant_scope,authorized_participant_emails,authorized_document_types,authorized_locales,phase2o_legacy)
          VALUES ('production','internal_canary',$1,$2::uuid,$3,true,$4::uuid,$5::timestamptz,$6::timestamptz,$7::jsonb,$8::text[],$9::text[],$10::text[],false)
          RETURNING id::text`,[preflight.readinessHash,snapshot.id,input.notes?.trim()||null,input.actorAdminId,preflight.evaluatedAt,
            input.expiresAt.toISOString(),JSON.stringify(preflight.participantIds),[...preflight.participantEmails],[...preflight.documentTypes],[...preflight.locales]]);
        await audit(tx,{entityType:"readiness_snapshot",entityId:snapshot.id,action:"created",actorAdminId:input.actorAdminId,
          previousState:null,newState:"pass",snapshot:{readiness:preflight.readinessHash,documentId:input.documentId},idempotencyKey:randomUUID()});
        await audit(tx,{entityType:"launch_authorization",entityId:row.id,action:"authorized",actorAdminId:input.actorAdminId,
          previousState:null,newState:"active",snapshot:{environment:"production",type:"internal_canary",readiness:preflight.readinessHash,
            participantScopeCount:preflight.participantIds.length,documentTypes:[...preflight.documentTypes],locales:[...preflight.locales],expiresAt:input.expiresAt.toISOString()},idempotencyKey:input.idempotencyKey});
        return {...row,readinessHash:preflight.readinessHash,snapshotId:snapshot.id};
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
