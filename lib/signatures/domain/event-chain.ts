import {
  canonicalSignatureJson,
  constantTimeDigestMatch,
  hmacSignatureValue,
} from "./crypto";
import type { SignatureEventRecord } from "./types";

export type SignatureEventDigestInput = Omit<
  SignatureEventRecord,
  "id" | "eventDigest"
>;

export function createSignatureEventDigest(
  hmacKey: Uint8Array | string,
  event: SignatureEventDigestInput
) {
  return hmacSignatureValue(hmacKey, canonicalSignatureJson(event));
}

export type EventChainVerification = Readonly<{
  valid: boolean;
  checkedEvents: number;
  invalidSequence: number | null;
  reason: "ok" | "sequence" | "predecessor" | "digest";
}>;

export function verifySignatureEventChain(
  events: readonly SignatureEventRecord[],
  resolveHmacKey: (keyVersion: number) => Uint8Array | string | null
): EventChainVerification {
  let previousDigest: string | null = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expectedSequence = index + 1;
    if (event.sequenceNumber !== expectedSequence) {
      return {
        valid: false,
        checkedEvents: index,
        invalidSequence: event.sequenceNumber,
        reason: "sequence",
      };
    }
    if (event.previousEventDigest !== previousDigest) {
      return {
        valid: false,
        checkedEvents: index,
        invalidSequence: event.sequenceNumber,
        reason: "predecessor",
      };
    }
    const key = resolveHmacKey(event.keyVersion);
    const expectedDigest = key
      ? createSignatureEventDigest(key, {
          documentId: event.documentId,
          documentVersionId: event.documentVersionId,
          participantId: event.participantId,
          sessionId: event.sessionId,
          eventType: event.eventType,
          actorClass: event.actorClass,
          actorAdminId: event.actorAdminId,
          serverTimestamp: event.serverTimestamp,
          sequenceNumber: event.sequenceNumber,
          versionHash: event.versionHash,
          controlledMetadata: event.controlledMetadata,
          idempotencyKey: event.idempotencyKey,
          previousEventDigest: event.previousEventDigest,
          keyVersion: event.keyVersion,
          networkAddressDigest: event.networkAddressDigest,
          userAgentDigest: event.userAgentDigest,
        })
      : "";
    if (!constantTimeDigestMatch(expectedDigest, event.eventDigest)) {
      return {
        valid: false,
        checkedEvents: index,
        invalidSequence: event.sequenceNumber,
        reason: "digest",
      };
    }
    previousDigest = event.eventDigest;
  }
  return {
    valid: true,
    checkedEvents: events.length,
    invalidSequence: null,
    reason: "ok",
  };
}
