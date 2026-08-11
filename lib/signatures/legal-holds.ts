import { createHash, randomUUID } from "node:crypto";
import type { SignatureDatabase, SignatureQueryExecutor } from "./domain/types";

export type SignatureEvidenceClass = "source_pdf"|"completed_pdf"|"certificate"|"evidence_manifest"|"token"|"session"|"network_evidence"|"failed_cancelled_draft"|"audit_event";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");

export function createSignatureLegalHoldService(database: SignatureDatabase, clock: () => Date = () => new Date()) {
  return {
    async place(input: { scopeType:"document"|"document_version"|"evidence_class"; documentId?:string; documentVersionId?:string; evidenceClasses?:readonly SignatureEvidenceClass[]; reasonReference:string; externalLegalReference?:string; actorAdminId:string; idempotencyKey?:string }) {
      if (!input.reasonReference.trim()) throw new Error("signature_legal_hold_reason_required");
      return database.begin(async tx => {
        const rows=await tx.unsafe<{id:string}>(`INSERT INTO signature_legal_holds
          (scope_type,document_id,document_version_id,evidence_classes,reason_reference,external_legal_reference,created_by_admin_id,created_at)
          VALUES ($1,$2::uuid,$3::uuid,$4::text[],$5,$6,$7::uuid,$8::timestamptz) RETURNING id::text`,
          [input.scopeType,input.documentId??null,input.documentVersionId??null,[...(input.evidenceClasses??[])],input.reasonReference.trim(),input.externalLegalReference?.trim()||null,input.actorAdminId,clock().toISOString()]);
        const snapshot={scopeType:input.scopeType,documentId:input.documentId??null,documentVersionId:input.documentVersionId??null,evidenceClasses:[...(input.evidenceClasses??[])],reasonReference:input.reasonReference.trim()};
        await tx.unsafe(`INSERT INTO signature_governance_events(entity_type,entity_id,action,actor_admin_id,snapshot_sha256,previous_state,new_state,external_approval_reference,idempotency_key)
          VALUES ('legal_hold',$1::uuid,'placed',$2::uuid,$3,NULL,'active',$4,$5::uuid)`,[rows[0].id,input.actorAdminId,digest(snapshot),input.externalLegalReference?.trim()||null,input.idempotencyKey??randomUUID()]);
        return rows[0];
      });
    },
    async release(input:{id:string;releaseReference:string;actorAdminId:string;idempotencyKey?:string}) {
      if (!input.releaseReference.trim()) throw new Error("signature_legal_hold_release_reference_required");
      return database.begin(async tx => {
        const rows=await tx.unsafe<{id:string;scope_type:string;document_id:string|null;document_version_id:string|null;evidence_classes:string[]}>(`UPDATE signature_legal_holds SET status='released',released_at=$2::timestamptz,released_by_admin_id=$3::uuid,release_reference=$4 WHERE id=$1::uuid AND status='active' RETURNING id::text,scope_type,document_id::text,document_version_id::text,evidence_classes`,[input.id,clock().toISOString(),input.actorAdminId,input.releaseReference.trim()]);
        if(!rows[0]) throw new Error("signature_legal_hold_release_rejected");
        await tx.unsafe(`INSERT INTO signature_governance_events(entity_type,entity_id,action,actor_admin_id,snapshot_sha256,previous_state,new_state,idempotency_key) VALUES ('legal_hold',$1::uuid,'released',$2::uuid,$3,'active','released',$4::uuid)`,[input.id,input.actorAdminId,digest(rows[0]),input.idempotencyKey??randomUUID()]);
        return rows[0];
      });
    }
  };
}

export async function hasActiveSignatureLegalHold(database: SignatureQueryExecutor,input:{documentId?:string;documentVersionId?:string;evidenceClass:SignatureEvidenceClass}) {
  const rows=await database.unsafe<{held:boolean}>(`SELECT EXISTS(SELECT 1 FROM signature_legal_holds h WHERE h.status='active' AND ((h.scope_type='document' AND h.document_id=$1::uuid) OR (h.scope_type='document_version' AND h.document_version_id=$2::uuid) OR (h.scope_type='evidence_class' AND $3=ANY(h.evidence_classes)))) held`,[input.documentId??null,input.documentVersionId??null,input.evidenceClass]);
  return rows[0]?.held===true;
}
