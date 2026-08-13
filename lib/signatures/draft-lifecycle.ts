import { randomUUID } from "node:crypto";
import type { SignatureDatabase } from "./domain/types";
import { sha256SignatureValue } from "./domain/crypto";
import { canonicalJson } from "./prototype/hash";
import type { SignatureSourceStorage } from "./storage";

type EligibilityRow = Readonly<{
  document_id: string; version_id: string; title: string; status: string;
  source_r2_key: string; byte_count: number | bigint; source_sha256: string;
  participants: number; values_count: number; sessions: number; tokens: number;
  deliveries: number; finalized: boolean; final_artifacts: boolean; legal_holds: number;
}>;

export type SignatureDraftDeletionEligibility = Readonly<{
  eligible: boolean;
  reasons: readonly string[];
  title: string | null;
  sourceWillBeRemoved: boolean;
}>;

async function row(database: SignatureDatabase, documentId: string) {
  const rows = await database.unsafe<EligibilityRow>(`SELECT d.id::text document_id,v.id::text version_id,d.title,d.status,
      v.source_r2_key,v.byte_count,v.source_sha256,
      (SELECT count(*)::int FROM signature_participants p WHERE p.document_version_id=v.id) participants,
      (SELECT count(*)::int FROM signature_field_values fv JOIN signature_fields f ON f.id=fv.signature_field_id WHERE f.document_version_id=v.id) values_count,
      (SELECT count(*)::int FROM signature_sessions s WHERE s.document_version_id=v.id) sessions,
      (SELECT count(*)::int FROM signature_signing_tokens t WHERE t.document_version_id=v.id) tokens,
      (SELECT count(*)::int FROM signature_delivery_intents di WHERE di.document_version_id=v.id) deliveries,
      (v.finalized_at IS NOT NULL) finalized,
      (v.final_r2_key IS NOT NULL OR v.certificate_r2_key IS NOT NULL) final_artifacts,
      (SELECT count(*)::int FROM signature_legal_holds h WHERE h.status='active' AND
        (h.document_id=d.id OR h.document_version_id=v.id OR (h.scope_type='evidence_class' AND 'source_pdf'=ANY(h.evidence_classes)))) legal_holds
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

export function createSignatureDraftLifecycleService(database: SignatureDatabase, storage: SignatureSourceStorage, clock = () => new Date()) {
  return {
    async inspectDeletion(documentId: string): Promise<SignatureDraftDeletionEligibility> {
      const item = await row(database, documentId);
      const blockers = reasons(item);
      return { eligible: blockers.length === 0, reasons: Object.freeze(blockers), title: item?.title ?? null, sourceWillBeRemoved: Boolean(item) };
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
  };
}
