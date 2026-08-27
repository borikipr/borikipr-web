import { randomUUID } from "node:crypto";
import type { SignatureDatabase, SignatureQueryExecutor } from "./domain/types";
import { sha256SignatureValue } from "./domain/crypto";
import { canonicalJson } from "./prototype/hash";
import type { SignatureCompletedStorage } from "./storage";

type EligibilityRow = Readonly<{
  document_id: string; version_id: string; title: string; status: string;
  document_type_approval_reference: string | null;
  source_r2_key: string; byte_count: number | bigint; source_sha256: string;
  final_r2_key: string | null; final_byte_count: number | bigint | null; final_pdf_sha256: string | null;
  certificate_r2_key: string | null; certificate_byte_count: number | bigint | null; certificate_sha256: string | null;
  participants: number; values_count: number; sessions: number; tokens: number; deliveries: number;
  active_sessions: number; usable_tokens: number; pending_deliveries: number; fields_count: number; events_count: number;
  versions_count: number; finalized: boolean; final_artifacts: boolean; legal_holds: number;
  linked_leads: number; correction_dependencies: number;
  template_source_dependencies: number; template_instance_dependencies: number;
  document_business_links: number;
  internal_canary_authorization_id: string | null;
  active_internal_canary_authorizations: number;
  operationally_hidden_at: string | Date | null; operationally_restored_at: string | Date | null;
  source_deleted_at: string | Date | null;
}>;

export type SignatureDraftDeletionEligibility = Readonly<{
  eligible: boolean;
  reasons: readonly string[];
  title: string | null;
  sourceWillBeRemoved: boolean;
  mode: "inert_draft" | "internal_test_record" | null;
}>;

async function row(database: SignatureQueryExecutor, documentId: string) {
  const rows = await database.unsafe<EligibilityRow>(`SELECT d.id::text document_id,v.id::text version_id,d.title,d.status,d.document_type_approval_reference,
      v.source_r2_key,v.byte_count,v.source_sha256,v.source_deleted_at,v.final_r2_key,v.final_byte_count,
      v.final_pdf_sha256,v.certificate_r2_key,v.certificate_byte_count,v.certificate_sha256,
      d.operationally_hidden_at,d.operationally_restored_at,
      (SELECT count(*)::int FROM signature_participants p WHERE p.document_version_id=v.id) participants,
      (SELECT count(*)::int FROM signature_fields f WHERE f.document_version_id=v.id) fields_count,
      (SELECT count(*)::int FROM signature_field_values fv JOIN signature_fields f ON f.id=fv.signature_field_id WHERE f.document_version_id=v.id) values_count,
      (SELECT count(*)::int FROM signature_sessions s WHERE s.document_version_id=v.id) sessions,
      (SELECT count(*)::int FROM signature_signing_tokens t WHERE t.document_version_id=v.id) tokens,
      (SELECT count(*)::int FROM signature_delivery_intents di WHERE di.document_version_id=v.id) deliveries,
      (SELECT count(*)::int FROM signature_sessions s WHERE s.document_version_id=v.id AND s.revoked_at IS NULL AND s.completed_at IS NULL AND s.expires_at>now() AND s.idle_expires_at>now()) active_sessions,
      (SELECT count(*)::int FROM signature_signing_tokens t WHERE t.document_version_id=v.id AND t.consumed_at IS NULL AND t.revoked_at IS NULL AND t.superseded_at IS NULL AND t.expires_at>now()) usable_tokens,
      (SELECT count(*)::int FROM signature_delivery_intents di WHERE di.document_version_id=v.id AND di.status IN ('pending','processing')) pending_deliveries,
      (SELECT count(*)::int FROM signature_events e WHERE e.document_version_id=v.id) events_count,
      (SELECT count(*)::int FROM signature_document_versions vx WHERE vx.document_id=d.id) versions_count,
      (v.finalized_at IS NOT NULL) finalized,
      (v.final_r2_key IS NOT NULL OR v.certificate_r2_key IS NOT NULL) final_artifacts,
      (SELECT count(*)::int FROM signature_legal_holds h WHERE h.document_id=d.id OR h.document_version_id=v.id
        OR (h.scope_type='evidence_class' AND h.status='active')) legal_holds,
      (SELECT count(*)::int FROM signature_participants p WHERE p.document_version_id=v.id AND p.canonical_lead_id IS NOT NULL) linked_leads,
      (CASE WHEN d.canonical_lead_id IS NOT NULL OR d.lead_group_id IS NOT NULL THEN 1 ELSE 0 END)::int document_business_links,
      ((SELECT count(*) FROM signature_documents child WHERE child.corrects_document_id=d.id)
        + CASE WHEN d.corrects_document_id IS NULL THEN 0 ELSE 1 END)::int correction_dependencies,
      (SELECT count(*)::int FROM signature_templates t WHERE t.source_document_version_id=v.id) template_source_dependencies,
      (SELECT count(*)::int FROM signature_documents child WHERE child.source_template_id IN
        (SELECT t.id FROM signature_templates t WHERE t.source_document_version_id=v.id)) template_instance_dependencies,
      (SELECT a.id::text FROM signature_launch_authorizations a
        JOIN signature_readiness_snapshots rs ON rs.id=a.readiness_snapshot_id
       WHERE a.environment='production' AND a.authorization_type='internal_canary'
         AND a.explicit_confirmation AND NOT a.phase2o_legacy AND rs.overall_status='pass'
         AND a.readiness_snapshot_sha256=rs.snapshot_sha256
         AND rs.snapshot#>>'{document,id}'=d.id::text
         AND rs.snapshot#>>'{document,versionId}'=v.id::text
         AND rs.snapshot#>>'{document,sourceSha256}'=v.source_sha256
       ORDER BY a.authorized_at DESC LIMIT 1) internal_canary_authorization_id
      ,(SELECT count(*)::int FROM signature_launch_authorizations a
        JOIN signature_readiness_snapshots rs ON rs.id=a.readiness_snapshot_id
       WHERE a.environment='production' AND a.authorization_type='internal_canary' AND a.status='active'
         AND (a.expires_at IS NULL OR a.expires_at>now())
         AND rs.snapshot#>>'{document,id}'=d.id::text
         AND rs.snapshot#>>'{document,versionId}'=v.id::text) active_internal_canary_authorizations
    FROM signature_documents d JOIN signature_document_versions v ON v.id=d.active_version_id
    WHERE d.id=$1::uuid`, [documentId]);
  return rows[0] ?? null;
}

function reasons(item: EligibilityRow | null) {
  if (!item) return ["document_not_found"];
  return [
    ...(item.status === "draft" ? [] : ["document_not_draft"]),
    ...(item.participants === 0 ? [] : ["participants_exist"]),
    ...(item.values_count === 0 ? [] : ["field_values_exist"]),
    ...(item.sessions === 0 ? [] : ["sessions_exist"]),
    ...(item.tokens === 0 ? [] : ["tokens_exist"]),
    ...(item.deliveries === 0 ? [] : ["deliveries_exist"]),
    ...(!item.finalized && !item.final_artifacts ? [] : ["final_artifacts_exist"]),
    ...(item.legal_holds === 0 ? [] : ["legal_hold_active"]),
  ];
}

function internalTestReasons(item: EligibilityRow | null) {
  if (!item) return ["document_not_found"];
  const legacySynthetic = ["completed", "voided", "expired", "archived"].includes(item.status)
    && item.document_type_approval_reference === null
    && item.linked_leads === 0 && item.document_business_links === 0;
  return [
    ...(item.internal_canary_authorization_id || legacySynthetic ? [] : ["internal_canary_lineage_missing"]),
    ...(item.active_internal_canary_authorizations === 0 ? [] : ["internal_canary_authorization_active"]),
    ...(item.versions_count === 1 ? [] : ["multiple_versions_exist"]),
    ...(item.active_sessions === 0 ? [] : ["active_sessions_exist"]),
    ...(item.usable_tokens === 0 ? [] : ["usable_tokens_exist"]),
    ...(item.pending_deliveries === 0 ? [] : ["pending_deliveries_exist"]),
    ...(item.legal_holds === 0 ? [] : ["legal_hold_exists"]),
    ...(item.linked_leads === 0 ? [] : ["canonical_lead_link_exists"]),
    ...(item.document_business_links === 0 ? [] : ["document_business_link_exists"]),
    ...(item.correction_dependencies === 0 ? [] : ["correction_dependency_exists"]),
    ...(item.template_instance_dependencies === 0 ? [] : ["template_instances_exist"]),
    ...(item.status !== "completed" || (item.finalized && item.final_r2_key && item.final_pdf_sha256 && item.certificate_r2_key && item.certificate_sha256) ? [] : ["artifact_descriptor_incomplete"]),
  ];
}

/**
 * The only eligibility decision for permanent signing-record cleanup.
 * It intentionally does not use the current list tab or lifecycle label as
 * an input: the server checks the actual record, security state, lineage and
 * dependencies every time it is rendered or deleted.
 */
export async function inspectSignatureDeletionEligibility(
  database: SignatureQueryExecutor,
  documentId: string,
): Promise<SignatureDraftDeletionEligibility> {
  const item = await row(database, documentId);
  const draftBlockers = reasons(item);
  const testBlockers = internalTestReasons(item);
  const mode = draftBlockers.length === 0
    ? "inert_draft"
    : testBlockers.length === 0
      ? "internal_test_record"
      : null;
  const blockers = mode ? [] : item?.status === "draft" ? draftBlockers : testBlockers;
  return {
    eligible: Boolean(mode),
    reasons: Object.freeze(blockers),
    title: item?.title ?? null,
    sourceWillBeRemoved: Boolean(item && !item.source_deleted_at),
    mode,
  };
}

export function createSignatureDraftLifecycleService(database: SignatureDatabase, storage: SignatureCompletedStorage, clock = () => new Date()) {
  return {
    async inspectDeletion(documentId: string): Promise<SignatureDraftDeletionEligibility> {
      return inspectSignatureDeletionEligibility(database, documentId);
    },

    async deleteInertDraft(input: { documentId:string; actorAdminId:string; reason:string; confirmationPhrase:string; idempotencyKey?:string }) {
      if (input.confirmationPhrase.normalize("NFC").trim() !== "ELIMINAR BORRADOR") throw new Error("signature_draft_delete_confirmation_required");
      const reason = input.reason.normalize("NFC").trim();
      if (!reason || reason.length > 500) throw new Error("signature_draft_delete_reason_invalid");
      const item = await row(database, input.documentId);
      const blockers = reasons(item);
      if (!item || blockers.length) throw new Error(`signature_draft_delete_blocked:${blockers.join("|")}`);
      const descriptor = { key:item.source_r2_key, byteCount:Number(item.byte_count), sourceSha256:item.source_sha256 };
      const bytes = await storage.getSource(descriptor);
      if (!(await storage.deleteSourceIfExact(descriptor))) throw new Error("signature_draft_source_delete_failed");
      try {
        return await database.begin(async (tx) => {
          const now = clock().toISOString();
          const updated = await tx.unsafe<{id:string}>(`UPDATE signature_documents d SET status='archived',archived_at=$2::timestamptz,
              archived_by_admin_id=$3::uuid,archive_reason=$4,deleted_at=$2::timestamptz,deleted_by_admin_id=$3::uuid
            WHERE d.id=$1::uuid AND d.status='draft'
              AND NOT EXISTS (SELECT 1 FROM signature_participants p WHERE p.document_version_id=d.active_version_id)
              AND NOT EXISTS (SELECT 1 FROM signature_sessions s WHERE s.document_version_id=d.active_version_id)
              AND NOT EXISTS (SELECT 1 FROM signature_signing_tokens t WHERE t.document_version_id=d.active_version_id)
              AND NOT EXISTS (SELECT 1 FROM signature_delivery_intents di WHERE di.document_version_id=d.active_version_id)
              AND NOT EXISTS (SELECT 1 FROM signature_field_values fv JOIN signature_fields f ON f.id=fv.signature_field_id WHERE f.document_version_id=d.active_version_id)
              AND NOT EXISTS (SELECT 1 FROM signature_legal_holds h WHERE h.status='active' AND (h.document_id=d.id OR h.document_version_id=d.active_version_id OR (h.scope_type='evidence_class' AND 'source_pdf'=ANY(h.evidence_classes))))
            RETURNING id::text`, [input.documentId,now,input.actorAdminId,reason]);
          if (!updated[0]) throw new Error("signature_draft_delete_race_rejected");
          await tx.unsafe(`UPDATE signature_document_versions SET source_deleted_at=$2::timestamptz WHERE id=$1::uuid AND finalized_at IS NULL`, [item.version_id,now]);
          await tx.unsafe(`INSERT INTO signature_governance_events(entity_type,entity_id,action,actor_admin_id,snapshot_sha256,previous_state,new_state,idempotency_key)
            VALUES ('signing_draft',$1::uuid,'deleted',$2::uuid,$3,'draft','archived',$4::uuid)`,
            [input.documentId,input.actorAdminId,sha256SignatureValue(canonicalJson({documentId:input.documentId,sourceSha256:item.source_sha256,deletedAt:now,reason})),input.idempotencyKey ?? randomUUID()]);
          return { status:"archived" as const, sourceDeleted:true as const };
        });
      } catch (error) {
        await storage.putSource({ ...descriptor, bytes, mimeType:"application/pdf" }).catch(() => "existing");
        throw error;
      }
    },

    async deleteEligibleRecord(input: { documentId:string; actorAdminId:string; reason:string; confirmationPhrase:string; idempotencyKey?:string }) {
      const reason = input.reason.normalize("NFC").trim();
      if (!reason || reason.length > 500) throw new Error("signature_delete_reason_invalid");
      const item = await row(database, input.documentId);
      const draftBlockers = reasons(item);
      if (item && draftBlockers.length === 0) return createSignatureDraftLifecycleService(database, storage, clock).deleteInertDraft(input);
      const blockers = internalTestReasons(item);
      if (!item || blockers.length) throw new Error(`signature_test_delete_blocked:${blockers.join("|")}`);
      if (input.confirmationPhrase.normalize("NFC").trim() !== "ELIMINAR PRUEBA") throw new Error("signature_test_delete_confirmation_required");

      // Historical inert drafts can already have their source removed by the
      // archive path.  That persisted marker is authoritative: never try to
      // fetch or delete an object that the database says is already gone.
      const source = item.source_deleted_at ? null : {
        key:item.source_r2_key, byteCount:Number(item.byte_count), sourceSha256:item.source_sha256,
      };
      const final = item.final_r2_key && item.final_pdf_sha256 && item.final_byte_count
        ? { key:item.final_r2_key, byteCount:Number(item.final_byte_count), sha256:item.final_pdf_sha256 } : null;
      const certificate = item.certificate_r2_key && item.certificate_sha256 && item.certificate_byte_count
        ? { key:item.certificate_r2_key, byteCount:Number(item.certificate_byte_count), sha256:item.certificate_sha256 } : null;
      const sourceBytes = source ? await storage.getSource(source) : null;
      const finalBytes = final ? await storage.getFinal(final) : null;
      const certificateBytes = certificate ? await storage.getCertificate(certificate) : null;
      const deleted: ("source"|"final"|"certificate")[] = [];
      const restore = async () => {
        if (source && sourceBytes && deleted.includes("source")) await storage.putSource({ ...source, bytes:sourceBytes, mimeType:"application/pdf" });
        if (final && finalBytes && deleted.includes("final")) await storage.putFinal({ ...final, bytes:finalBytes, mimeType:"application/pdf" });
        if (certificate && certificateBytes && deleted.includes("certificate")) await storage.putCertificate({ ...certificate, bytes:certificateBytes, mimeType:"application/pdf" });
      };
      try {
        if (source) {
          if (!(await storage.deleteSourceIfExact(source))) throw new Error("signature_test_source_delete_failed");
          deleted.push("source");
        }
        if (final) { if (!(await storage.deleteFinalIfExact(final))) throw new Error("signature_test_final_delete_failed"); deleted.push("final"); }
        if (certificate) { if (!(await storage.deleteCertificateIfExact(certificate))) throw new Error("signature_test_certificate_delete_failed"); deleted.push("certificate"); }
        return await database.begin(async (tx) => {
          const current = await row(tx, input.documentId);
          const raceBlockers = internalTestReasons(current);
          if (!current || raceBlockers.length || current.internal_canary_authorization_id !== item.internal_canary_authorization_id) throw new Error("signature_test_delete_race_rejected");
          const counts = { participants:item.participants, fields:item.fields_count, values:item.values_count, sessions:item.sessions, tokens:item.tokens, deliveries:item.deliveries, events:item.events_count, versions:item.versions_count, templateSources:item.template_source_dependencies };
          const eligibilitySnapshot = canonicalJson({ documentId:item.document_id, versionId:item.version_id, authorizationId:item.internal_canary_authorization_id, legacySynthetic:item.document_type_approval_reference===null, sourceAlreadyDeleted:Boolean(item.source_deleted_at), status:item.status, sourceSha256:item.source_sha256, finalSha256:item.final_pdf_sha256, certificateSha256:item.certificate_sha256, counts });
          await tx.unsafe(`INSERT INTO signature_test_cleanup_events(document_id,document_version_id,internal_canary_authorization_id,actor_admin_id,reason,title_sha256,source_sha256,final_pdf_sha256,certificate_sha256,eligibility_snapshot_sha256,removed_row_counts,removed_artifact_count,deleted_at)
            VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10,($11::text)::jsonb,$12,$13::timestamptz)`,
            [item.document_id,item.version_id,item.internal_canary_authorization_id,input.actorAdminId,reason,sha256SignatureValue(item.title),item.source_sha256,item.final_pdf_sha256,item.certificate_sha256,sha256SignatureValue(eligibilitySnapshot),JSON.stringify(counts),deleted.length + (item.source_deleted_at ? 1 : 0),clock().toISOString()]);
          await tx.unsafe(`DELETE FROM signature_templates WHERE source_document_version_id=$1::uuid`,[item.version_id]);
          await tx.unsafe(`DELETE FROM signature_delivery_intents WHERE document_version_id=$1::uuid`,[item.version_id]);
          await tx.unsafe(`DELETE FROM signature_field_values WHERE signature_field_id IN (SELECT id FROM signature_fields WHERE document_version_id=$1::uuid)`,[item.version_id]);
          await tx.unsafe(`DELETE FROM signature_events WHERE document_version_id=$1::uuid`,[item.version_id]);
          await tx.unsafe(`DELETE FROM signature_sessions WHERE document_version_id=$1::uuid`,[item.version_id]);
          await tx.unsafe(`DELETE FROM signature_signing_tokens WHERE document_version_id=$1::uuid`,[item.version_id]);
          await tx.unsafe(`DELETE FROM signature_fields WHERE document_version_id=$1::uuid`,[item.version_id]);
          await tx.unsafe(`DELETE FROM signature_participants WHERE document_version_id=$1::uuid`,[item.version_id]);
          await tx.unsafe(`SET CONSTRAINTS signature_documents_active_version_fk DEFERRED`);
          await tx.unsafe(`DELETE FROM signature_document_versions WHERE id=$1::uuid`,[item.version_id]);
          const removed = await tx.unsafe<{id:string}>(`DELETE FROM signature_documents WHERE id=$1::uuid RETURNING id::text`,[item.document_id]);
          if (!removed[0]) throw new Error("signature_test_delete_race_rejected");
          return { status:"deleted" as const, sourceDeleted:true as const, auditRetained:true as const };
        });
      } catch (error) {
        await restore().catch(() => undefined);
        throw error;
      }
    },

    async archiveDraft(input: { documentId:string; actorAdminId:string; reason:string; idempotencyKey?:string }) {
      const reason = input.reason.normalize("NFC").trim();
      if (!reason || reason.length > 500) throw new Error("signature_draft_archive_reason_invalid");
      return database.begin(async (tx) => {
        const now = clock().toISOString();
        const rows = await tx.unsafe<{id:string}>(`UPDATE signature_documents SET status='archived',archived_at=$2::timestamptz,
            archived_by_admin_id=$3::uuid,archive_reason=$4 WHERE id=$1::uuid AND status='draft'
            AND NOT EXISTS (SELECT 1 FROM signature_signing_tokens t WHERE t.document_version_id=active_version_id)
            AND NOT EXISTS (SELECT 1 FROM signature_sessions s WHERE s.document_version_id=active_version_id)
            AND NOT EXISTS (SELECT 1 FROM signature_delivery_intents di WHERE di.document_version_id=active_version_id)
            RETURNING id::text`,
          [input.documentId,now,input.actorAdminId,reason]);
        if (!rows[0]) throw new Error("signature_draft_archive_rejected");
        await tx.unsafe(`INSERT INTO signature_governance_events(entity_type,entity_id,action,actor_admin_id,snapshot_sha256,previous_state,new_state,idempotency_key)
          VALUES ('signing_draft',$1::uuid,'archived',$2::uuid,$3,'draft','archived',$4::uuid)`,
          [input.documentId,input.actorAdminId,sha256SignatureValue(canonicalJson({documentId:input.documentId,archivedAt:now,reason})),input.idempotencyKey ?? randomUUID()]);
        return { status:"archived" as const, sourceDeleted:false as const };
      });
    },

    async hideFromOperationalWorkflow(input: { documentId:string; actorAdminId:string; reason:string; idempotencyKey?:string }) {
      const reason = input.reason.normalize("NFC").trim();
      if (!reason || reason.length > 500) throw new Error("signature_request_hide_reason_invalid");
      return database.begin(async (tx) => {
        const now = clock().toISOString();
        const rows = await tx.unsafe<{id:string;status:string}>(`UPDATE signature_documents
          SET operationally_hidden_at=$2::timestamptz,operationally_hidden_by_admin_id=$3::uuid,
              operationally_hidden_reason=$4
          WHERE id=$1::uuid AND status<>'archived' AND operationally_hidden_at IS NULL
          RETURNING id::text,status`, [input.documentId,now,input.actorAdminId,reason]);
        if (!rows[0]) throw new Error("signature_request_hide_rejected");
        await tx.unsafe(`INSERT INTO signature_governance_events(entity_type,entity_id,action,actor_admin_id,
          snapshot_sha256,previous_state,new_state,idempotency_key)
          VALUES ('signing_request',$1::uuid,'workflow_hidden',$2::uuid,$3,$4,$4,$5::uuid)`,
          [input.documentId,input.actorAdminId,sha256SignatureValue(canonicalJson({documentId:input.documentId,status:rows[0].status,hiddenAt:now,reason})),rows[0].status,input.idempotencyKey ?? randomUUID()]);
        return { status:rows[0].status, hidden:true as const };
      });
    },

    async restoreToOperationalWorkflow(input: { documentId:string; actorAdminId:string; reason:string; idempotencyKey?:string }) {
      const reason = input.reason.normalize("NFC").trim();
      if (!reason || reason.length > 500) throw new Error("signature_request_restore_reason_invalid");
      const item = await row(database, input.documentId);
      if (!item || !item.operationally_hidden_at || item.operationally_restored_at || item.status === "archived" || item.source_deleted_at) {
        throw new Error("signature_request_restore_rejected");
      }
      return database.begin(async (tx) => {
        const now = clock().toISOString();
        const rows = await tx.unsafe<{id:string;status:string}>(`UPDATE signature_documents
          SET operationally_restored_at=$2::timestamptz,operationally_restored_by_admin_id=$3::uuid,
              operationally_restore_reason=$4
          WHERE id=$1::uuid AND operationally_hidden_at IS NOT NULL AND operationally_restored_at IS NULL
            AND status<>'archived' AND deleted_at IS NULL
          RETURNING id::text,status`, [input.documentId,now,input.actorAdminId,reason]);
        if (!rows[0]) throw new Error("signature_request_restore_rejected");
        await tx.unsafe(`INSERT INTO signature_governance_events(entity_type,entity_id,action,actor_admin_id,
          snapshot_sha256,previous_state,new_state,idempotency_key)
          VALUES ('signing_request',$1::uuid,'workflow_restored',$2::uuid,$3,$4,$4,$5::uuid)`,
          [input.documentId,input.actorAdminId,sha256SignatureValue(canonicalJson({documentId:input.documentId,status:rows[0].status,restoredAt:now,reason})),rows[0].status,input.idempotencyKey ?? randomUUID()]);
        return { status:rows[0].status, restored:true as const };
      });
    },
  };
}
