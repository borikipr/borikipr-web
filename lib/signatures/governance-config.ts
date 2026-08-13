import { createHash } from "node:crypto";
import type { SignatureDatabase, SignatureQueryExecutor } from "./domain/types";
import type { SignatureRetentionPolicy } from "./retention-policy";
import { createSignatureGovernanceWorkflow } from "./governance-workflow";
import { GOVERNANCE_APPROVAL_PHRASE } from "./governance-constants";

function snapshot(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

async function event(database: SignatureQueryExecutor, input: { entityType: string; entityId: string; action: string; actorAdminId: string; value: unknown }) {
  await database.unsafe(
    `INSERT INTO public.signature_governance_events (entity_type,entity_id,action,actor_admin_id,snapshot_sha256)
     VALUES ($1,$2::uuid,$3,$4::uuid,$5)`,
    [input.entityType, input.entityId, input.action, input.actorAdminId, snapshot(input.value)]
  );
}

export async function loadActivePrivacyDisclosure(database: SignatureQueryExecutor, now = new Date()) {
  const rows = await database.unsafe<{
    id: string; version_identifier: string; approval_reference: string; effective_from: Date;
    es_pr_text: string; en_us_text: string; es_pr_sha256: string; en_us_sha256: string;
  }>(`SELECT id::text,version_identifier,approval_reference,effective_from,es_pr_text,en_us_text,es_pr_sha256,en_us_sha256
      FROM public.signature_privacy_disclosure_versions WHERE status='approved' AND effective_from <= $1::timestamptz LIMIT 1`, [now.toISOString()]);
  return rows[0] ?? null;
}

export async function loadActiveRetentionPolicy(database: SignatureQueryExecutor) {
  const rows = await database.unsafe<{
    version_identifier: string; approval_reference: string; privacy_reference: string;
    source_pdf_days: number; completed_pdf_days: number | null; certificate_days: number | null;
    evidence_manifest_days: number | null; token_days: number; session_hours: number;
    network_evidence_days: number; failed_cancelled_draft_days: number;
    audit_event_days: number | null; completed_cleanup_enabled: boolean;
  }>(
    `SELECT version_identifier,approval_reference,privacy_reference,source_pdf_days,completed_pdf_days,
      certificate_days,evidence_manifest_days,token_days,session_hours,network_evidence_days,
      failed_cancelled_draft_days,audit_event_days,completed_cleanup_enabled
      FROM public.signature_retention_policy_versions WHERE status='active' LIMIT 1`
  );
  const row = rows[0];
  return row ? {
    version: row.version_identifier, approvalReference: row.approval_reference,
    privacyReference: row.privacy_reference, sourcePdfDays: row.source_pdf_days,
    completedPdfDays: row.completed_pdf_days, certificateDays: row.certificate_days,
    evidenceManifestDays: row.evidence_manifest_days, tokenDays: row.token_days,
    sessionHours: row.session_hours, networkEvidenceDays: row.network_evidence_days,
    failedCancelledDraftDays: row.failed_cancelled_draft_days, auditEventDays: row.audit_event_days,
    completedCleanupEnabled: row.completed_cleanup_enabled,
  } satisfies SignatureRetentionPolicy : null;
}

export function createSignatureGovernanceConfigurationService(database: SignatureDatabase, clock = () => new Date()) {
  const workflow = createSignatureGovernanceWorkflow(database, clock);
  return {
    async createPrivacyDraft(input: { versionIdentifier: string; esPRText: string; enUSText: string; actorAdminId: string }) {
      const created = await workflow.createPrivacyDraft(input);
      return created.id;
    },
    async approvePrivacy(input: { id: string; approvalReference: string; approverRole: string; effectiveFrom: Date; actorAdminId: string }) {
      await workflow.submitPrivacy({ id: input.id, actorAdminId: input.actorAdminId });
      return workflow.approvePrivacy({ ...input, approvalMode: "internal_business",
        confirmationPhrase: GOVERNANCE_APPROVAL_PHRASE, immutableAcknowledged: true });
    },
    async createRetentionDraft(input: { versionIdentifier: string; privacyReference: string; policy: SignatureRetentionPolicy; actorAdminId: string }) {
      const created = await workflow.createRetentionDraft(input);
      return created.id;
    },
    async activateRetention(input: { id: string; approvalReference: string; approverRole: string; actorAdminId: string }) {
      await workflow.submitRetention({ id: input.id, actorAdminId: input.actorAdminId });
      await workflow.approveRetention({ ...input, approvalMode: "internal_business",
        confirmationPhrase: GOVERNANCE_APPROVAL_PHRASE, immutableAcknowledged: true });
      return workflow.activateRetention({ id: input.id, actorAdminId: input.actorAdminId,
        confirmationPhrase: GOVERNANCE_APPROVAL_PHRASE, immutableAcknowledged: true });
    },
    async authorize(input: { environment: "isolated"|"preview"|"production"; authorizationType: "internal_canary"|"production_public_launch"; readinessSnapshotSha256: string; notes?: string; expiresAt?: Date; actorAdminId: string; explicitConfirmation: boolean }) {
      if (!input.explicitConfirmation) throw new Error("signature_launch_confirmation_required");
      return database.begin(async (tx) => {
        const rows = await tx.unsafe<{ id: string }>(`INSERT INTO public.signature_launch_authorizations (environment,authorization_type,readiness_snapshot_sha256,notes,explicit_confirmation,authorized_by_admin_id,expires_at) VALUES ($1,$2,$3,$4,true,$5::uuid,$6::timestamptz) RETURNING id::text`, [input.environment,input.authorizationType,input.readinessSnapshotSha256,input.notes ?? null,input.actorAdminId,input.expiresAt?.toISOString() ?? null]);
        await event(tx, { entityType: "launch_authorization", entityId: rows[0].id, action: "authorized", actorAdminId: input.actorAdminId, value: { environment: input.environment, type: input.authorizationType, readiness: input.readinessSnapshotSha256 } });
        return rows[0].id;
      });
    },
  };
}
