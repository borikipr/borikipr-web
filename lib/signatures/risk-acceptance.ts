import { createHash, randomUUID } from "node:crypto";
import type { SignatureDatabase } from "./domain/types";
import { canonicalJson } from "./prototype/hash";
import { RISK_ACCEPTANCE_CONFIRMATION_PHRASE } from "./preflight";

export const SIGNATURE_RECOVERY_RISKS = ["neon_restore_unproven","r2_independent_recovery_unproven"] as const;
export type SignatureRecoveryRisk = typeof SIGNATURE_RECOVERY_RISKS[number];

export function createSignatureRiskAcceptanceService(database:SignatureDatabase,clock=()=>new Date()) {
  return {
    async acceptForInternalCanary(input:{riskCode:SignatureRecoveryRisk;residualRisk:string;evidenceReference:string;expiresAt:Date;actorAdminId:string;confirmationPhrase:string;explicitConfirmation:boolean;idempotencyKey?:string}) {
      const now=clock();
      if(!SIGNATURE_RECOVERY_RISKS.includes(input.riskCode) || !input.explicitConfirmation || input.confirmationPhrase.normalize("NFC").trim()!==RISK_ACCEPTANCE_CONFIRMATION_PHRASE) throw new Error("signature_risk_confirmation_required");
      if(input.residualRisk.trim().length<20 || input.evidenceReference.trim().length<3 || input.expiresAt<=now || input.expiresAt.getTime()>now.getTime()+90*86_400_000) throw new Error("signature_risk_scope_invalid");
      return database.begin(async(tx)=>{
        const phraseHash=createHash("sha256").update(input.confirmationPhrase.normalize("NFC").trim(),"utf8").digest("hex");
        const [row]=await tx.unsafe<{id:string}>(`INSERT INTO signature_risk_acceptances
          (risk_code,authorization_scope,residual_risk,evidence_reference,accepted_by_admin_id,accepted_at,expires_at,explicit_confirmation,confirmation_phrase_sha256)
          VALUES ($1,'internal_canary',$2,$3,$4::uuid,$5::timestamptz,$6::timestamptz,true,$7) RETURNING id::text`,
          [input.riskCode,input.residualRisk.trim(),input.evidenceReference.trim(),input.actorAdminId,now.toISOString(),input.expiresAt.toISOString(),phraseHash]);
        const snapshot={riskCode:input.riskCode,scope:"internal_canary",residualRisk:input.residualRisk.trim(),evidenceReference:input.evidenceReference.trim(),expiresAt:input.expiresAt.toISOString()};
        await tx.unsafe(`INSERT INTO signature_governance_events(entity_type,entity_id,action,actor_admin_id,snapshot_sha256,previous_state,new_state,idempotency_key)
          VALUES ('risk_acceptance',$1::uuid,'created',$2::uuid,$3,NULL,'active',$4::uuid)`,[row.id,input.actorAdminId,createHash("sha256").update(canonicalJson(snapshot),"utf8").digest("hex"),input.idempotencyKey??randomUUID()]);
        return row;
      });
    }
  };
}
