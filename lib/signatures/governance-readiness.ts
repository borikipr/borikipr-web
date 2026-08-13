import type { SignatureQueryExecutor } from "./domain/types";
import { getSignatureSecurityConfig } from "./config";
import { isPublicSigningEnabled } from "./public-config";
import { inspectSignatureRetentionPolicy } from "./retention-policy";
import { inspectSignatureEventKeyCoverage } from "./key-rotation";
import { inspectSignaturePrivacyDisclosure } from "./privacy-disclosure";
import { loadActivePrivacyDisclosure, loadActiveRetentionPolicy } from "./governance-config";

export type SignatureGovernanceLocale = "es-PR" | "en-US";

export function signatureGovernanceBlockersForLocales(input: {
  requiredLocales: readonly SignatureGovernanceLocale[];
  activeApprovalCount: number;
  approvedConsentLocales: ReadonlySet<SignatureGovernanceLocale>;
  approvedPrivacyLocales: ReadonlySet<SignatureGovernanceLocale>;
  retentionConfigured: boolean;
  evidenceKeysConfigured: boolean;
}) {
  return Object.freeze([
    ...(input.activeApprovalCount ? [] : ["document_classification_approval_missing"]),
    ...input.requiredLocales.flatMap((locale) => input.approvedConsentLocales.has(locale)
      ? [] : [locale === "es-PR" ? "approved_consent_es_pr_missing" : "approved_consent_en_us_missing"]),
    ...input.requiredLocales.flatMap((locale) => input.approvedPrivacyLocales.has(locale)
      ? [] : [locale === "es-PR" ? "approved_privacy_es_pr_missing" : "approved_privacy_en_us_missing"]),
    ...(input.retentionConfigured ? [] : ["retention_policy_missing"]),
    ...(input.evidenceKeysConfigured ? [] : ["event_keys_unavailable"]),
  ]);
}

export async function getSignatureGovernanceReadiness(
  database: SignatureQueryExecutor,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  now = new Date()
) {
  const [approvals, consents, durablePrivacy, durableRetention, launchAuthorizations] = await Promise.all([
    database.unsafe<{ document_type: string; status: string; approval_mode: string; approval_reference: string | null; effective_from: Date | null; revoked_at: Date | null }>(
      `SELECT document_type, status, approval_mode, approval_reference, effective_from, revoked_at
         FROM public.signature_document_type_approvals ORDER BY document_type, created_at DESC`
    ),
    database.unsafe<{ version_identifier: string; locale: "es-PR" | "en-US"; status: string; consent_text_sha256: string; effective_from: Date | null; approval_reference: string | null }>(
      `SELECT version_identifier, locale, status, consent_text_sha256, effective_from, approval_reference
         FROM public.signature_consent_versions ORDER BY locale, created_at DESC`
    ),
    loadActivePrivacyDisclosure(database, now),
    loadActiveRetentionPolicy(database),
    database.unsafe<{ environment: string; authorization_type: string; status: string; authorized_at: Date; expires_at: Date | null }>(
      `SELECT environment,authorization_type,status,authorized_at,expires_at FROM public.signature_launch_authorizations ORDER BY authorized_at DESC`
    ),
  ]);
  const activeApprovals = approvals.filter((row) => row.status === "approved" && ["internal_business","external_review"].includes(row.approval_mode) && !row.revoked_at && row.effective_from && new Date(row.effective_from) <= now);
  const approvedLocales = new Set<SignatureGovernanceLocale>(consents.filter((row) => row.status === "approved" && row.effective_from && new Date(row.effective_from) <= now).map((row) => row.locale));
  const environmentRetention = inspectSignatureRetentionPolicy(environment);
  const environmentPrivacy = inspectSignaturePrivacyDisclosure(environment, now);
  const retention = durableRetention ? { configured: true as const, policy: durableRetention, policySha256: null, reasons: [] as readonly string[], source: "database" as const }
    : { ...environmentRetention, source: "environment" as const };
  const privacyDisclosure = durablePrivacy ? { configured: true as const, disclosure: {
    version: durablePrivacy.version_identifier, approvalReference: durablePrivacy.approval_reference,
    effectiveFrom: new Date(durablePrivacy.effective_from).toISOString(), locales: {
      "es-PR": { text: durablePrivacy.es_pr_text, sha256: durablePrivacy.es_pr_sha256 },
      "en-US": { text: durablePrivacy.en_us_text, sha256: durablePrivacy.en_us_sha256 },
    } }, reason: null, source: "database" as const } : { ...environmentPrivacy, source: "environment" as const };
  let evidenceKeysConfigured = false;
  let keyCoverage: Awaited<ReturnType<typeof inspectSignatureEventKeyCoverage>> | null = null;
  try {
    const keys = getSignatureSecurityConfig(environment);
    keyCoverage = await inspectSignatureEventKeyCoverage(database, keys.configuredKeyVersions, keys.currentVersion);
    evidenceKeysConfigured = keyCoverage.safe;
  } catch { evidenceKeysConfigured = false; }
  const publicSigningEnabled = isPublicSigningEnabled(environment);
  const approvedPrivacyLocales = new Set<SignatureGovernanceLocale>(privacyDisclosure.configured
    ? ["es-PR", "en-US"] : []);
  const scope = (requiredLocales: readonly SignatureGovernanceLocale[]) => signatureGovernanceBlockersForLocales({
    requiredLocales, activeApprovalCount: activeApprovals.length, approvedConsentLocales: approvedLocales,
    approvedPrivacyLocales, retentionConfigured: retention.configured, evidenceKeysConfigured,
  });
  const spanishCanaryBlockers = scope(["es-PR"]);
  const bilingualCanaryBlockers = scope(["es-PR", "en-US"]);
  const blockers = bilingualCanaryBlockers;
  return { approvals, consents, consentSlots: (["es-PR", "en-US"] as const).map((locale) => ({ locale, approved: approvedLocales.has(locale) })),
    privacySlots: (["es-PR", "en-US"] as const).map((locale) => ({ locale, approved: approvedPrivacyLocales.has(locale) })),
    retention, privacyDisclosure, evidenceKeysConfigured, keyCoverage, publicSigningEnabled, activeApprovalCount: activeApprovals.length,
    launchAuthorizations, spanishCanaryReady: spanishCanaryBlockers.length === 0, spanishCanaryBlockers,
    bilingualCanaryReady: bilingualCanaryBlockers.length === 0, bilingualCanaryBlockers,
    launchReady: blockers.length === 0, blockers };
}
