import { createHash } from "node:crypto";

export const SIGNATURE_PRIVACY_DISCLOSURE_ENV = "SIGNATURE_PRIVACY_DISCLOSURE_JSON";

export type SignaturePrivacyDisclosure = Readonly<{
  version: string;
  approvalReference: string;
  effectiveFrom: string;
  locales: Readonly<Record<"es-PR" | "en-US", Readonly<{
    text: string;
    sha256: string;
  }>>>;
}>;

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizedText(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.normalize("NFC").trim();
  return text.length >= 20 && text.length <= 10_000 ? text : null;
}

export function parseSignaturePrivacyDisclosure(value: string | undefined): SignaturePrivacyDisclosure {
  let parsed: unknown;
  try { parsed = JSON.parse(value ?? ""); }
  catch { throw new Error("signature_privacy_disclosure_invalid"); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("signature_privacy_disclosure_invalid");
  }
  const raw = parsed as Record<string, unknown>;
  const version = typeof raw.version === "string" && /^[a-z0-9][a-z0-9._-]{0,99}$/.test(raw.version)
    ? raw.version : null;
  const approvalReference = typeof raw.approvalReference === "string" && raw.approvalReference.trim()
    ? raw.approvalReference.trim() : null;
  const effectiveFrom = typeof raw.effectiveFrom === "string" && !Number.isNaN(Date.parse(raw.effectiveFrom))
    ? new Date(raw.effectiveFrom).toISOString() : null;
  const locales = raw.locales && !Array.isArray(raw.locales) && typeof raw.locales === "object"
    ? raw.locales as Record<string, unknown> : null;
  const esPR = normalizedText(locales?.["es-PR"]);
  const enUS = normalizedText(locales?.["en-US"]);
  if (!version || !approvalReference || !effectiveFrom || !esPR || !enUS) {
    throw new Error("signature_privacy_disclosure_invalid");
  }
  return Object.freeze({
    version,
    approvalReference,
    effectiveFrom,
    locales: Object.freeze({
      "es-PR": Object.freeze({ text: esPR, sha256: sha256(esPR) }),
      "en-US": Object.freeze({ text: enUS, sha256: sha256(enUS) }),
    }),
  });
}

export function inspectSignaturePrivacyDisclosure(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  now = new Date()
) {
  try {
    const disclosure = parseSignaturePrivacyDisclosure(environment[SIGNATURE_PRIVACY_DISCLOSURE_ENV]);
    if (new Date(disclosure.effectiveFrom) > now) {
      return { configured: false as const, disclosure: null, reason: "signature_privacy_disclosure_not_effective" };
    }
    return { configured: true as const, disclosure, reason: null };
  } catch (error) {
    return { configured: false as const, disclosure: null,
      reason: error instanceof Error ? error.message : "signature_privacy_disclosure_invalid" };
  }
}
