import { createSignatureDomainServices } from "./domain/service";
import type { SignatureDatabase } from "./domain/types";

export const SIGNATURE_EVENT_HMAC_KEYS_ENV = "SIGNATURE_EVENT_HMAC_KEYS_JSON";
export const SIGNATURE_EVENT_HMAC_CURRENT_VERSION_ENV =
  "SIGNATURE_EVENT_HMAC_CURRENT_VERSION";
export const SIGNATURE_NETWORK_EVIDENCE_HMAC_KEY_ENV =
  "SIGNATURE_NETWORK_EVIDENCE_HMAC_KEY";

function decodeKey(value: unknown, errorCode: string) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(errorCode);
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.byteLength < 32) throw new Error(errorCode);
  return bytes;
}

export function getSignatureSecurityConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  const currentVersion = Number(
    environment[SIGNATURE_EVENT_HMAC_CURRENT_VERSION_ENV]
  );
  if (!Number.isInteger(currentVersion) || currentVersion < 1) {
    throw new Error("signature_event_hmac_current_version_invalid");
  }
  let rawKeys: unknown;
  try {
    rawKeys = JSON.parse(environment[SIGNATURE_EVENT_HMAC_KEYS_ENV] ?? "");
  } catch {
    throw new Error("signature_event_hmac_key_ring_invalid");
  }
  if (!rawKeys || Array.isArray(rawKeys) || typeof rawKeys !== "object") {
    throw new Error("signature_event_hmac_key_ring_invalid");
  }
  const keys = new Map<number, Uint8Array>();
  for (const [rawVersion, rawKey] of Object.entries(rawKeys)) {
    const version = Number(rawVersion);
    if (!Number.isInteger(version) || version < 1 || version > 1_000_000) {
      throw new Error("signature_event_hmac_key_ring_invalid");
    }
    keys.set(
      version,
      decodeKey(rawKey, "signature_event_hmac_key_ring_invalid")
    );
  }
  const currentKey = keys.get(currentVersion);
  if (!currentKey) throw new Error("signature_event_hmac_current_key_missing");
  const networkEvidenceHmacKey = decodeKey(
    environment[SIGNATURE_NETWORK_EVIDENCE_HMAC_KEY_ENV],
    "signature_network_evidence_hmac_key_invalid"
  );
  return Object.freeze({
    currentVersion,
    currentKey,
    networkEvidenceHmacKey,
    resolveEventHmacKey: (version: number) => keys.get(version) ?? null,
    configuredKeyVersions: Object.freeze([...keys.keys()].sort((a, b) => a - b)),
  });
}

export function createConfiguredSignatureDomainServices(database: SignatureDatabase) {
  const config = getSignatureSecurityConfig();
  return createSignatureDomainServices({
    database,
    eventHmacKey: config.currentKey,
    eventHmacKeyVersion: config.currentVersion,
    resolveEventHmacKey: config.resolveEventHmacKey,
    networkEvidenceHmacKey: config.networkEvidenceHmacKey,
  });
}
