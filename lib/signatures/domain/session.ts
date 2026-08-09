import {
  constantTimeDigestMatch,
  randomSignatureSecret,
  sha256SignatureValue,
} from "./crypto";

export const SIGNER_SESSION_MAX_MINUTES = 20;
export const SIGNER_SESSION_IDLE_MINUTES = 10;

export type SignerSessionMaterial = Readonly<{
  sessionSecret: string;
  sessionSecretDigest: string;
  csrfNonce: string;
  csrfNonceDigest: string;
}>;

export type StoredSignerSession = Readonly<{
  participantId: string;
  documentVersionId: string;
  sessionSecretDigest: string;
  csrfNonceDigest: string;
  expiresAt: string | Date;
  idleExpiresAt: string | Date;
  revokedAt: string | Date | null;
  completedAt: string | Date | null;
}>;

export function createSignerSessionMaterial(): SignerSessionMaterial {
  const sessionSecret = randomSignatureSecret();
  const csrfNonce = randomSignatureSecret();
  return {
    sessionSecret,
    sessionSecretDigest: sha256SignatureValue(sessionSecret),
    csrfNonce,
    csrfNonceDigest: sha256SignatureValue(csrfNonce),
  };
}

export function verifySignerSession({
  sessionSecret,
  csrfNonce,
  stored,
  expectedParticipantId,
  expectedDocumentVersionId,
  now = new Date(),
}: {
  sessionSecret: string;
  csrfNonce: string;
  stored: StoredSignerSession;
  expectedParticipantId: string;
  expectedDocumentVersionId: string;
  now?: Date;
}) {
  return (
    constantTimeDigestMatch(
      sha256SignatureValue(sessionSecret),
      stored.sessionSecretDigest
    ) &&
    constantTimeDigestMatch(
      sha256SignatureValue(csrfNonce),
      stored.csrfNonceDigest
    ) &&
    stored.participantId === expectedParticipantId &&
    stored.documentVersionId === expectedDocumentVersionId &&
    stored.revokedAt === null &&
    stored.completedAt === null &&
    new Date(stored.expiresAt).getTime() > now.getTime() &&
    new Date(stored.idleExpiresAt).getTime() > now.getTime()
  );
}
