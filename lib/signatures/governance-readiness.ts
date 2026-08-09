import type { SignatureQueryExecutor } from "./domain/types";
import { getSignatureSecurityConfig } from "./config";
import { isPublicSigningEnabled } from "./public-config";
import { inspectSignatureRetentionPolicy } from "./retention-policy";
import { inspectSignatureEventKeyCoverage } from "./key-rotation";

export async function getSignatureGovernanceReadiness(
  database: SignatureQueryExecutor,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  now = new Date()
) {
  const [approvals, consents] = await Promise.all([
    database.unsafe<{ document_type: string; status: string; approval_reference: string | null; effective_from: Date | null; revoked_at: Date | null }>(
      `SELECT document_type, status, approval_reference, effective_from, revoked_at
         FROM public.signature_document_type_approvals ORDER BY document_type, created_at DESC`
    ),
    database.unsafe<{ version_identifier: string; locale: "es-PR" | "en-US"; status: string; consent_text_sha256: string; effective_from: Date | null; approval_reference: string | null }>(
      `SELECT version_identifier, locale, status, consent_text_sha256, effective_from, approval_reference
         FROM public.signature_consent_versions ORDER BY locale, created_at DESC`
    ),
  ]);
  const activeApprovals = approvals.filter((row) => row.status === "approved" && !row.revoked_at && row.effective_from && new Date(row.effective_from) <= now);
  const approvedLocales = new Set(consents.filter((row) => row.status === "approved" && row.effective_from && new Date(row.effective_from) <= now).map((row) => row.locale));
  const retention = inspectSignatureRetentionPolicy(environment);
  let evidenceKeysConfigured = false;
  let keyCoverage: Awaited<ReturnType<typeof inspectSignatureEventKeyCoverage>> | null = null;
  try {
    const keys = getSignatureSecurityConfig(environment);
    keyCoverage = await inspectSignatureEventKeyCoverage(database, keys.configuredKeyVersions, keys.currentVersion);
    evidenceKeysConfigured = keyCoverage.safe;
  } catch { evidenceKeysConfigured = false; }
  const publicSigningEnabled = isPublicSigningEnabled(environment);
  const blockers = [
    ...(activeApprovals.length ? [] : ["counsel_approval_missing"]),
    ...(approvedLocales.has("es-PR") ? [] : ["approved_consent_es_pr_missing"]),
    ...(approvedLocales.has("en-US") ? [] : ["approved_consent_en_us_missing"]),
    ...(retention.configured ? [] : ["retention_policy_missing"]),
    ...(evidenceKeysConfigured ? [] : ["event_keys_unavailable"]),
    ...(publicSigningEnabled ? [] : ["public_signing_disabled"]),
  ];
  return { approvals, consents, consentSlots: (["es-PR", "en-US"] as const).map((locale) => ({ locale, approved: approvedLocales.has(locale) })),
    retention, evidenceKeysConfigured, keyCoverage, publicSigningEnabled, activeApprovalCount: activeApprovals.length,
    launchReady: blockers.length === 0, blockers: Object.freeze(blockers) };
}
