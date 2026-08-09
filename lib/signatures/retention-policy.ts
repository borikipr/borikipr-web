export const SIGNATURE_RETENTION_POLICY_ENV = "SIGNATURE_RETENTION_POLICY_JSON";

export type SignatureRetentionPolicy = Readonly<{
  version: string;
  approvalReference: string;
  privacyReference: string;
  sourcePdfDays: number;
  completedPdfDays: number | null;
  certificateDays: number | null;
  evidenceManifestDays: number | null;
  tokenDays: number;
  sessionHours: number;
  networkEvidenceDays: number;
  failedCancelledDraftDays: number;
  auditEventDays: number | null;
  completedCleanupEnabled: boolean;
}>;

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum
    ? Number(value)
    : null;
}

function preservedDays(value: unknown) {
  if (value === null) return null;
  return boundedInteger(value, 1, 36_500) ?? undefined;
}

export function parseSignatureRetentionPolicy(value: string | undefined): SignatureRetentionPolicy {
  let parsed: unknown;
  try { parsed = JSON.parse(value ?? ""); }
  catch { throw new Error("signature_retention_policy_invalid"); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("signature_retention_policy_invalid");
  const raw = parsed as Record<string, unknown>;
  const version = typeof raw.version === "string" && /^[a-z0-9][a-z0-9._-]{0,99}$/.test(raw.version) ? raw.version : null;
  const approvalReference = typeof raw.approvalReference === "string" && raw.approvalReference.trim().length > 0 ? raw.approvalReference.trim() : null;
  const privacyReference = typeof raw.privacyReference === "string" && raw.privacyReference.trim().length > 0 ? raw.privacyReference.trim() : null;
  const sourcePdfDays = boundedInteger(raw.sourcePdfDays, 1, 36_500);
  const completedPdfDays = preservedDays(raw.completedPdfDays);
  const certificateDays = preservedDays(raw.certificateDays);
  const evidenceManifestDays = preservedDays(raw.evidenceManifestDays);
  const tokenDays = boundedInteger(raw.tokenDays, 1, 365);
  const sessionHours = boundedInteger(raw.sessionHours, 1, 168);
  const networkEvidenceDays = boundedInteger(raw.networkEvidenceDays, 1, 3_650);
  const failedCancelledDraftDays = boundedInteger(raw.failedCancelledDraftDays, 1, 3_650);
  const auditEventDays = preservedDays(raw.auditEventDays);
  if (!version || !approvalReference || !privacyReference || sourcePdfDays === null ||
      completedPdfDays === undefined || certificateDays === undefined || evidenceManifestDays === undefined ||
      tokenDays === null || sessionHours === null || networkEvidenceDays === null ||
      failedCancelledDraftDays === null || auditEventDays === undefined ||
      typeof raw.completedCleanupEnabled !== "boolean") {
    throw new Error("signature_retention_policy_invalid");
  }
  if (raw.completedCleanupEnabled && [completedPdfDays, certificateDays, evidenceManifestDays, auditEventDays].some((days) => days === null)) {
    throw new Error("signature_retention_completed_cleanup_inconsistent");
  }
  return Object.freeze({ version, approvalReference, privacyReference, sourcePdfDays,
    completedPdfDays, certificateDays, evidenceManifestDays, tokenDays, sessionHours,
    networkEvidenceDays, failedCancelledDraftDays, auditEventDays,
    completedCleanupEnabled: raw.completedCleanupEnabled });
}

export function inspectSignatureRetentionPolicy(environment: Readonly<Record<string, string | undefined>> = process.env) {
  try { return { configured: true as const, policy: parseSignatureRetentionPolicy(environment[SIGNATURE_RETENTION_POLICY_ENV]), reasons: [] as readonly string[] }; }
  catch (error) { return { configured: false as const, policy: null, reasons: [error instanceof Error ? error.message : "signature_retention_policy_invalid"] as readonly string[] }; }
}

export function evaluateSignatureRetention(input: {
  policy: SignatureRetentionPolicy;
  recordType: "source_pdf" | "completed_pdf" | "certificate" | "evidence_manifest" | "token" | "session" | "network_evidence" | "failed_cancelled_draft" | "audit_event";
  createdAt: Date;
  now: Date;
  legalHold: boolean;
  completedRecord: boolean;
}) {
  if (input.legalHold) return { eligible: false as const, reason: "legal_hold" };
  const days = input.recordType === "source_pdf" ? input.policy.sourcePdfDays
    : input.recordType === "completed_pdf" ? input.policy.completedPdfDays
    : input.recordType === "certificate" ? input.policy.certificateDays
    : input.recordType === "evidence_manifest" ? input.policy.evidenceManifestDays
    : input.recordType === "token" ? input.policy.tokenDays
    : input.recordType === "session" ? input.policy.sessionHours / 24
    : input.recordType === "network_evidence" ? input.policy.networkEvidenceDays
    : input.recordType === "failed_cancelled_draft" ? input.policy.failedCancelledDraftDays
    : input.policy.auditEventDays;
  if (days === null || (input.completedRecord && !input.policy.completedCleanupEnabled)) {
    return { eligible: false as const, reason: "preserved" };
  }
  const eligible = input.now.getTime() >= input.createdAt.getTime() + days * 86_400_000;
  return { eligible, reason: eligible ? "retention_elapsed" : "retention_active" } as const;
}
