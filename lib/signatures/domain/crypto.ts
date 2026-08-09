import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

export function canonicalSignatureJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function sha256SignatureValue(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSignatureValue(
  key: Uint8Array | string,
  value: Uint8Array | string
) {
  return createHmac("sha256", key).update(value).digest("hex");
}

export function randomSignatureSecret() {
  return randomBytes(32).toString("base64url");
}

export function constantTimeDigestMatch(left: string, right: string) {
  if (!SHA256_PATTERN.test(left) || !SHA256_PATTERN.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function assertSha256(value: string, field = "digest") {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`signature_${field}_invalid`);
  }
  return value;
}

export function hashPseudonymousEvidence(
  hmacKey: Uint8Array | string,
  value: string | null | undefined
) {
  const normalized = value?.trim();
  return normalized ? hmacSignatureValue(hmacKey, normalized) : null;
}
