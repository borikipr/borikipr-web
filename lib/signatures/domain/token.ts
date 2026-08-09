import {
  constantTimeDigestMatch,
  randomSignatureSecret,
  sha256SignatureValue,
} from "./crypto";

export type SigningTokenMaterial = Readonly<{
  plaintext: string;
  digest: string;
}>;

export type StoredSigningToken = Readonly<{
  participantId: string;
  documentVersionId: string;
  tokenDigest: string;
  expiresAt: string | Date;
  consumedAt: string | Date | null;
  revokedAt: string | Date | null;
  supersededAt: string | Date | null;
}>;

export function createSigningTokenMaterial(): SigningTokenMaterial {
  const plaintext = randomSignatureSecret();
  return { plaintext, digest: sha256SignatureValue(plaintext) };
}

export function verifySigningToken({
  plaintext,
  stored,
  expectedParticipantId,
  expectedDocumentVersionId,
  now = new Date(),
}: {
  plaintext: string;
  stored: StoredSigningToken;
  expectedParticipantId: string;
  expectedDocumentVersionId: string;
  now?: Date;
}) {
  const presentedDigest = sha256SignatureValue(plaintext);
  return (
    constantTimeDigestMatch(presentedDigest, stored.tokenDigest) &&
    stored.participantId === expectedParticipantId &&
    stored.documentVersionId === expectedDocumentVersionId &&
    stored.consumedAt === null &&
    stored.revokedAt === null &&
    stored.supersededAt === null &&
    new Date(stored.expiresAt).getTime() > now.getTime()
  );
}
