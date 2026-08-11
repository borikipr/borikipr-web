import type { SignatureQueryExecutor } from "./domain/types";
import { isInternalCanarySigningEnabled, isProductionInternalCanaryCapabilityEnabled,
  isPublicSigningEnabled, SIGNING_INTERNAL_CANARY_READINESS_SHA256_ENV } from "./public-config";

export async function isSignerAccessAuthorized(database: SignatureQueryExecutor,input:{participantId:string;documentVersionId:string},environment:Readonly<Record<string,string|undefined>>=process.env,now=new Date()) {
  if (isPublicSigningEnabled(environment) || isInternalCanarySigningEnabled(environment)) return true;
  if (!isProductionInternalCanaryCapabilityEnabled(environment)) return false;
  const readiness=environment[SIGNING_INTERNAL_CANARY_READINESS_SHA256_ENV]?.trim();
  const rows=await database.unsafe<{authorized:boolean}>(`SELECT EXISTS(
    SELECT 1 FROM signature_launch_authorizations a
    JOIN signature_participants p ON p.id=$1::uuid AND p.document_version_id=$2::uuid
    JOIN signature_document_versions v ON v.id=p.document_version_id
    JOIN signature_documents d ON d.id=v.document_id
    WHERE a.environment='production' AND a.authorization_type='internal_canary' AND a.status='active'
      AND a.expires_at>$3::timestamptz AND a.readiness_snapshot_sha256=$4
      AND a.authorized_participant_scope ? p.id::text
      AND d.document_type=ANY(a.authorized_document_types)
  ) authorized`,[input.participantId,input.documentVersionId,now.toISOString(),readiness]);
  return rows[0]?.authorized===true;
}

export async function assertSignerAccessAuthorized(database:SignatureQueryExecutor,input:{participantId:string;documentVersionId:string},environment:Readonly<Record<string,string|undefined>>=process.env) {
  if(!await isSignerAccessAuthorized(database,input,environment)) throw new Error("signature_signer_access_disabled");
}
