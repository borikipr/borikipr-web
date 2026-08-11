import { createHash } from "node:crypto";
import type { SignatureDatabase, SignatureQueryExecutor } from "./domain/types";
import { sha256SignatureValue } from "./domain/crypto";
import type { SignatureRetentionPolicy } from "./retention-policy";

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
  return {
    async createPrivacyDraft(input: { versionIdentifier: string; esPRText: string; enUSText: string; actorAdminId: string }) {
      const es = input.esPRText.normalize("NFC").trim();
      const en = input.enUSText.normalize("NFC").trim();
      const rows = await database.unsafe<{ id: string }>(`INSERT INTO public.signature_privacy_disclosure_versions
        (version_identifier,es_pr_text,en_us_text,es_pr_sha256,en_us_sha256,created_by_admin_id)
        VALUES ($1,$2,$3,$4,$5,$6::uuid) RETURNING id::text`,
        [input.versionIdentifier, es, en, sha256SignatureValue(es), sha256SignatureValue(en), input.actorAdminId]);
      await event(database, { entityType: "privacy_disclosure", entityId: rows[0].id, action: "created", actorAdminId: input.actorAdminId, value: { versionIdentifier: input.versionIdentifier, es: sha256SignatureValue(es), en: sha256SignatureValue(en) } });
      return rows[0].id;
    },
    async approvePrivacy(input: { id: string; approvalReference: string; effectiveFrom: Date; actorAdminId: string }) {
      return database.begin(async (tx) => {
        const now = clock().toISOString();
        const rows = await tx.unsafe<{ id: string; es_pr_sha256: string; en_us_sha256: string }>(`UPDATE public.signature_privacy_disclosure_versions SET status='approved',approval_reference=$2,effective_from=$3::timestamptz,approved_at=$4::timestamptz,approved_by_admin_id=$5::uuid,updated_at=$4::timestamptz WHERE id=$1::uuid AND status='draft' RETURNING id::text,es_pr_sha256,en_us_sha256`, [input.id, input.approvalReference, input.effectiveFrom.toISOString(), now, input.actorAdminId]);
        if (!rows[0]) throw new Error("signature_privacy_approval_rejected");
        await event(tx, { entityType: "privacy_disclosure", entityId: input.id, action: "approved", actorAdminId: input.actorAdminId, value: rows[0] });
        return rows[0];
      });
    },
    async createRetentionDraft(input: { versionIdentifier: string; approvalReference: string; privacyReference: string; policy: SignatureRetentionPolicy; actorAdminId: string }) {
      const p = input.policy;
      const rows = await database.unsafe<{ id: string }>(`INSERT INTO public.signature_retention_policy_versions
        (version_identifier,approval_reference,privacy_reference,source_pdf_days,completed_pdf_days,certificate_days,evidence_manifest_days,token_days,session_hours,network_evidence_days,failed_cancelled_draft_days,audit_event_days,completed_cleanup_enabled,created_by_admin_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::uuid) RETURNING id::text`, [input.versionIdentifier,input.approvalReference,input.privacyReference,p.sourcePdfDays,p.completedPdfDays,p.certificateDays,p.evidenceManifestDays,p.tokenDays,p.sessionHours,p.networkEvidenceDays,p.failedCancelledDraftDays,p.auditEventDays,p.completedCleanupEnabled,input.actorAdminId]);
      await event(database, { entityType: "retention_policy", entityId: rows[0].id, action: "created", actorAdminId: input.actorAdminId, value: p });
      return rows[0].id;
    },
    async activateRetention(input: { id: string; actorAdminId: string }) {
      return database.begin(async (tx) => {
        const now = clock().toISOString();
        const rows = await tx.unsafe<{ id: string }>(`UPDATE public.signature_retention_policy_versions SET status='active',activated_at=$2::timestamptz,activated_by_admin_id=$3::uuid,updated_at=$2::timestamptz WHERE id=$1::uuid AND status='draft' AND approval_reference IS NOT NULL AND privacy_reference IS NOT NULL RETURNING id::text`, [input.id, now, input.actorAdminId]);
        if (!rows[0]) throw new Error("signature_retention_activation_rejected");
        await event(tx, { entityType: "retention_policy", entityId: input.id, action: "activated", actorAdminId: input.actorAdminId, value: rows[0] });
        return rows[0];
      });
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
