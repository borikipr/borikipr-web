import type { SignatureQueryExecutor } from "./domain/types";
import { isInternalCanarySigningEnabled, isProductionInternalCanaryCapabilityEnabled,
  isPublicSigningEnabled, SIGNING_INTERNAL_CANARY_READINESS_SHA256_ENV, SIGNING_PUBLIC_READINESS_SHA256_ENV } from "./public-config";
import { evaluateSignaturePreflight, type SignaturePreflightAuthorizationType, type SignaturePreflightLocale } from "./preflight";

export async function isSignerAccessAuthorized(database: SignatureQueryExecutor,input:{participantId:string;documentVersionId:string},environment:Readonly<Record<string,string|undefined>>=process.env,now=new Date()) {
  if (isInternalCanarySigningEnabled(environment)) return true;
  const publicMode=isPublicSigningEnabled(environment);
  const canaryMode=isProductionInternalCanaryCapabilityEnabled(environment);
  if(!publicMode && !canaryMode) return false;
  const authorizationType:SignaturePreflightAuthorizationType=publicMode?"production_public_launch":"internal_canary";
  const readiness=environment[publicMode?SIGNING_PUBLIC_READINESS_SHA256_ENV:SIGNING_INTERNAL_CANARY_READINESS_SHA256_ENV]?.trim();
  if(!/^[0-9a-f]{64}$/.test(readiness??"")) return false;
  const rows=await database.unsafe<{authorization_id:string;document_id:string;participant_email:string;expires_at:string|Date;readiness_snapshot_sha256:string;authorized_participant_emails:string[];authorized_document_types:string[];authorized_locales:SignaturePreflightLocale[]}>(`SELECT
      a.id::text authorization_id,d.id::text document_id,p.normalized_email participant_email,a.expires_at,
      a.readiness_snapshot_sha256,a.authorized_participant_emails,a.authorized_document_types,a.authorized_locales
    FROM signature_launch_authorizations a
    JOIN signature_participants p ON p.id=$1::uuid AND p.document_version_id=$2::uuid
    JOIN signature_document_versions v ON v.id=p.document_version_id
    JOIN signature_documents d ON d.id=v.document_id
    WHERE a.environment='production' AND a.authorization_type=$3 AND a.status='active' AND a.phase2o_legacy=false
      AND a.expires_at>$4::timestamptz AND a.readiness_snapshot_sha256=$5
      AND a.authorized_participant_scope ? p.id::text
      AND p.normalized_email=ANY(a.authorized_participant_emails)
      AND d.document_type=ANY(a.authorized_document_types)
      AND cardinality(a.authorized_locales)>0
    ORDER BY a.authorized_at DESC LIMIT 1`,[input.participantId,input.documentVersionId,authorizationType,now.toISOString(),readiness]);
  const authorization=rows[0];
  if(!authorization) return false;
  const current=await evaluateSignaturePreflight({database,documentId:authorization.document_id,
    participantEmails:authorization.authorized_participant_emails,documentTypes:authorization.authorized_document_types,
    locales:authorization.authorized_locales,environment:"production",authorizationType,
    authorizationExpiresAt:new Date(authorization.expires_at),environmentVariables:environment,now});
  return current.overallStatus==="pass" && current.readinessHash===authorization.readiness_snapshot_sha256 && current.readinessHash===readiness;
}

export async function assertSignerAccessAuthorized(database:SignatureQueryExecutor,input:{participantId:string;documentVersionId:string},environment:Readonly<Record<string,string|undefined>>=process.env) {
  if(!await isSignerAccessAuthorized(database,input,environment)) throw new Error("signature_signer_access_disabled");
}
