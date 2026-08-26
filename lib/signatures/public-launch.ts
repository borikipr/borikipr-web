import { createHash, randomUUID } from "node:crypto";
import type { SignatureDatabase, SignatureQueryExecutor } from "./domain/types";
import { getSignatureSecurityConfig } from "./config";
import { getSignatureDocumentTypeDefinition } from "./document-classification";
import { getSignatureGovernanceReadiness } from "./governance-readiness";
import { canonicalJson } from "./prototype/hash";
import { SIGNING_PUBLIC_READINESS_SHA256_ENV, isPublicSigningEnabled } from "./public-config";
import { PUBLIC_LAUNCH_CONFIRMATION_PHRASE } from "./public-launch-constants";

export { PUBLIC_LAUNCH_CONFIRMATION_PHRASE } from "./public-launch-constants";

type PublicLaunchClassification = Readonly<{
  id: string;
  documentType: string;
  approvalMode: string;
  snapshotSha256: string;
}>;

export type PublicLaunchReadiness = Readonly<{
  overallStatus: "pass" | "blocked";
  blockers: readonly string[];
  evaluatedAt: string;
  documentTypes: readonly string[];
  locales: readonly ("es-PR" | "en-US")[];
  snapshot: Readonly<Record<string, unknown>>;
  readinessHash: string;
}>;

function digest(value: unknown) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function textDigest(value: string) {
  return createHash("sha256").update(value.normalize("NFC").trim(), "utf8").digest("hex");
}

export async function evaluatePublicLaunchReadiness(
  database: SignatureQueryExecutor,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  now = new Date()
): Promise<PublicLaunchReadiness> {
  const governance = await getSignatureGovernanceReadiness(database, environment, now);
  const [classificationRows, consentRows, privacyRows, retentionRows] = await Promise.all([
    database.unsafe<{
      id: string; document_type: string; approval_mode: string; approval_snapshot_sha256: string | null;
    }>(`SELECT DISTINCT ON (document_type) id::text,document_type,approval_mode,approval_snapshot_sha256
      FROM signature_document_type_approvals
      WHERE status='approved' AND revoked_at IS NULL AND retired_at IS NULL
        AND effective_from<=$1::timestamptz
      ORDER BY document_type,effective_from DESC,version_number DESC`, [now.toISOString()]),
    database.unsafe<{
      id: string; locale: "es-PR" | "en-US"; version_identifier: string;
      consent_text: string; consent_text_sha256: string;
    }>(`SELECT DISTINCT ON (locale) id::text,locale,version_identifier,consent_text,consent_text_sha256
      FROM signature_consent_versions
      WHERE status='approved' AND retired_at IS NULL AND effective_from<=$1::timestamptz
      ORDER BY locale,effective_from DESC,created_at DESC`, [now.toISOString()]),
    database.unsafe<{
      id: string; version_identifier: string; es_pr_text: string; en_us_text: string;
      es_pr_sha256: string; en_us_sha256: string;
    }>(`SELECT id::text,version_identifier,es_pr_text,en_us_text,es_pr_sha256,en_us_sha256
      FROM signature_privacy_disclosure_versions
      WHERE status='approved' AND retired_at IS NULL AND effective_from<=$1::timestamptz LIMIT 1`, [now.toISOString()]),
    database.unsafe<{
      id: string; version_identifier: string; policy_sha256: string | null;
    }>(`SELECT id::text,version_identifier,policy_sha256
      FROM signature_retention_policy_versions WHERE status='active' LIMIT 1`),
  ]);

  const classifications: PublicLaunchClassification[] = classificationRows
    .filter((row) => getSignatureDocumentTypeDefinition(row.document_type)?.scope === "ordinary_brokerage")
    .map((row) => ({ id: row.id, documentType: row.document_type,
      approvalMode: row.approval_mode, snapshotSha256: row.approval_snapshot_sha256 ?? "" }))
    .sort((left, right) => left.documentType.localeCompare(right.documentType));
  const consents = consentRows
    .map((row) => ({ id: row.id, locale: row.locale, version: row.version_identifier,
      sha256: row.consent_text_sha256, valid: textDigest(row.consent_text) === row.consent_text_sha256 }))
    .sort((left, right) => left.locale.localeCompare(right.locale));
  const privacy = privacyRows[0] ?? null;
  const retention = retentionRows[0] ?? null;
  const blockers = [...governance.spanishCanaryBlockers];
  if (!classifications.length) blockers.push("document_classification_approval_missing");
  if (classifications.some((row) => !/^[0-9a-f]{64}$/.test(row.snapshotSha256))) {
    blockers.push("document_classification_evidence_invalid");
  }
  const authorizedConsents = consents.filter((row) => row.locale === "es-PR");
  if (authorizedConsents.some((row) => !row.valid)) blockers.push("approved_consent_hash_invalid");
  if (privacy && (textDigest(privacy.es_pr_text) !== privacy.es_pr_sha256 ||
      textDigest(privacy.en_us_text) !== privacy.en_us_sha256)) {
    blockers.push("approved_privacy_hash_invalid");
  }
  if (retention && !/^[0-9a-f]{64}$/.test(retention.policy_sha256 ?? "")) {
    blockers.push("retention_policy_hash_invalid");
  }
  if (environment.SIGNING_NEON_RECOVERY_PROVEN?.trim().toLowerCase() !== "true") {
    blockers.push("neon_restore_unproven");
  }
  if (environment.SIGNING_R2_INDEPENDENT_RECOVERY_PROVEN?.trim().toLowerCase() !== "true") {
    blockers.push("r2_independent_recovery_unproven");
  }

  let keyEvidence: Readonly<Record<string, unknown>> | null = null;
  try {
    const security = getSignatureSecurityConfig(environment);
    if (governance.keyCoverage?.safe) {
      keyEvidence = Object.freeze({ currentVersion: security.currentVersion,
        configuredVersions: [...security.configuredKeyVersions] });
    }
  } catch {
    // getSignatureGovernanceReadiness already emits the corresponding blocker.
  }
  const uniqueBlockers = [...new Set(blockers)].sort();
  const locales = ["es-PR"] as const;
  const snapshot = Object.freeze({
    schema: "signature-public-launch-readiness-v1",
    environment: "production",
    classifications,
    consents: authorizedConsents.map((row) => ({ id: row.id, locale: row.locale,
      version: row.version, sha256: row.sha256 })),
    privacy: privacy ? { id: privacy.id, version: privacy.version_identifier,
      esPRSha256: privacy.es_pr_sha256, enUSSha256: privacy.en_us_sha256 } : null,
    retention: retention ? { id: retention.id, version: retention.version_identifier,
      sha256: retention.policy_sha256 } : null,
    recovery: { neon: true, independentR2: true },
    eventKeys: keyEvidence,
    documentTypes: classifications.map((row) => row.documentType),
    locales,
    blockers: uniqueBlockers,
  });
  return Object.freeze({ overallStatus: uniqueBlockers.length ? "blocked" : "pass",
    blockers: Object.freeze(uniqueBlockers), evaluatedAt: now.toISOString(),
    documentTypes: Object.freeze(classifications.map((row) => row.documentType)),
    locales: Object.freeze([...locales]), snapshot, readinessHash: digest(snapshot) });
}

export async function authorizeProductionPublicLaunch(input: {
  database: SignatureDatabase;
  actorAdminId: string;
  explicitConfirmation: boolean;
  confirmationPhrase: string;
  notes?: string;
  environmentVariables?: Readonly<Record<string, string | undefined>>;
  now?: Date;
}) {
  if (!input.explicitConfirmation || input.confirmationPhrase.normalize("NFC").trim() !== PUBLIC_LAUNCH_CONFIRMATION_PHRASE) {
    throw new Error("signature_public_launch_confirmation_required");
  }
  const environment = input.environmentVariables ?? process.env;
  if (isPublicSigningEnabled(environment)) throw new Error("signature_public_launch_flag_must_be_off");
  const now = input.now ?? new Date();
  return input.database.begin(async (tx) => {
    const readiness = await evaluatePublicLaunchReadiness(tx, environment, now);
    if (readiness.overallStatus !== "pass") {
      throw new Error(`signature_public_launch_readiness_blocked:${readiness.blockers.join(",")}`);
    }
    const active = await tx.unsafe<{ id: string }>(`SELECT id::text FROM signature_launch_authorizations
      WHERE environment='production' AND authorization_type='production_public_launch' AND status='active'
      FOR UPDATE`);
    if (active.length) throw new Error("signature_public_launch_already_authorized");
    const [snapshot] = await tx.unsafe<{ id: string }>(`INSERT INTO signature_readiness_snapshots
      (environment,authorization_type,overall_status,participant_emails,document_types,locales,snapshot,snapshot_sha256,created_by_admin_id)
      VALUES ('production','production_public_launch','pass',ARRAY[]::text[],$1::text[],$2::text[],($3::text)::jsonb,$4,$5::uuid)
      RETURNING id::text`, [[...readiness.documentTypes],[...readiness.locales],JSON.stringify(readiness.snapshot),readiness.readinessHash,input.actorAdminId]);
    const [authorization] = await tx.unsafe<{ id: string }>(`INSERT INTO signature_launch_authorizations
      (environment,authorization_type,readiness_snapshot_sha256,readiness_snapshot_id,notes,explicit_confirmation,
       authorized_by_admin_id,authorized_at,expires_at,authorized_participant_scope,authorized_participant_emails,
       authorized_document_types,authorized_locales,phase2o_legacy)
      VALUES ('production','production_public_launch',$1,$2::uuid,$3,true,$4::uuid,$5::timestamptz,NULL,
        '[]'::jsonb,ARRAY[]::text[],$6::text[],$7::text[],false) RETURNING id::text`,
      [readiness.readinessHash,snapshot.id,input.notes?.trim()||null,input.actorAdminId,now.toISOString(),
        [...readiness.documentTypes],[...readiness.locales]]);
    for (const entry of [
      { entityType: "readiness_snapshot", entityId: snapshot.id, action: "created", state: "pass" },
      { entityType: "launch_authorization", entityId: authorization.id, action: "authorized", state: "active" },
    ]) {
      await tx.unsafe(`INSERT INTO signature_governance_events
        (entity_type,entity_id,action,actor_admin_id,snapshot_sha256,previous_state,new_state,idempotency_key)
        VALUES ($1,$2::uuid,$3,$4::uuid,$5,NULL,$6,$7::uuid)`,
        [entry.entityType,entry.entityId,entry.action,input.actorAdminId,
          digest({ readiness: readiness.readinessHash, type: "production_public_launch" }),entry.state,randomUUID()]);
    }
    return Object.freeze({ id: authorization.id, snapshotId: snapshot.id,
      readinessHash: readiness.readinessHash, readiness });
  });
}

export async function inspectProductionPublicLaunchGate(
  database: SignatureQueryExecutor,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  now = new Date()
) {
  const blockers: string[] = [];
  if (!isPublicSigningEnabled(environment)) blockers.push("public_signing_disabled");
  const configuredHash = environment[SIGNING_PUBLIC_READINESS_SHA256_ENV]?.trim() ?? "";
  if (!/^[0-9a-f]{64}$/.test(configuredHash)) blockers.push("public_readiness_hash_missing");
  const authorizations = /^[0-9a-f]{64}$/.test(configuredHash)
    ? await database.unsafe<{ id: string; readiness_snapshot_sha256: string; authorized_document_types: string[]; authorized_locales: ("es-PR"|"en-US")[] }>(
      `SELECT a.id::text,a.readiness_snapshot_sha256,a.authorized_document_types,a.authorized_locales
       FROM signature_launch_authorizations a
       JOIN signature_readiness_snapshots s ON s.id=a.readiness_snapshot_id
         AND s.environment='production' AND s.authorization_type='production_public_launch'
         AND s.overall_status='pass' AND s.snapshot_sha256=a.readiness_snapshot_sha256
       WHERE a.environment='production' AND a.authorization_type='production_public_launch'
         AND a.status='active' AND a.phase2o_legacy=false
         AND (a.expires_at IS NULL OR a.expires_at>$1::timestamptz)
         AND a.readiness_snapshot_sha256=$2
       LIMIT 1`, [now.toISOString(),configuredHash]) : [];
  const authorization = authorizations[0] ?? null;
  if (!authorization) blockers.push("public_launch_authorization_missing");
  const readiness = await evaluatePublicLaunchReadiness(database, environment, now);
  blockers.push(...readiness.blockers);
  if (authorization && readiness.readinessHash !== authorization.readiness_snapshot_sha256) {
    blockers.push("public_readiness_stale");
  }
  if (authorization && configuredHash !== readiness.readinessHash) {
    blockers.push("public_readiness_hash_mismatch");
  }
  const uniqueBlockers = [...new Set(blockers)].sort();
  return Object.freeze({ allowed: uniqueBlockers.length === 0,
    blockers: Object.freeze(uniqueBlockers), readiness,
    authorization: authorization ? Object.freeze({ id: authorization.id,
      documentTypes: Object.freeze([...authorization.authorized_document_types]),
      locales: Object.freeze([...authorization.authorized_locales]) }) : null });
}
