import { assertSha256 } from "./crypto";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string, name: string) {
  if (!UUID_PATTERN.test(value)) throw new Error(`signature_${name}_invalid`);
  return value.toLowerCase();
}

function assertVersion(versionNumber: number) {
  if (!Number.isSafeInteger(versionNumber) || versionNumber < 1 || versionNumber > 1000) {
    throw new Error("signature_version_number_invalid");
  }
  return versionNumber;
}

export function signatureSourceR2Key(
  documentId: string,
  versionNumber: number,
  sourceSha256: string
) {
  return `signatures/source/${assertUuid(documentId, "document_id")}/${assertVersion(
    versionNumber
  )}/${assertSha256(sourceSha256, "source_hash")}.pdf`;
}

export function signatureArtifactR2Key(
  documentId: string,
  versionNumber: number,
  fieldId: string,
  artifactSha256: string
) {
  return `signatures/artifacts/${assertUuid(documentId, "document_id")}/${assertVersion(
    versionNumber
  )}/${assertUuid(fieldId, "field_id")}/${assertSha256(
    artifactSha256,
    "artifact_hash"
  )}.bin`;
}

export function signatureFinalR2Key(
  documentId: string,
  versionNumber: number,
  finalSha256: string
) {
  return `signatures/final/${assertUuid(documentId, "document_id")}/${assertVersion(
    versionNumber
  )}/${assertSha256(finalSha256, "final_hash")}.pdf`;
}

export function signatureCertificateR2Key(
  documentId: string,
  versionNumber: number,
  certificateSha256: string
) {
  return `signatures/certificates/${assertUuid(
    documentId,
    "document_id"
  )}/${assertVersion(versionNumber)}/${assertSha256(
    certificateSha256,
    "certificate_hash"
  )}.pdf`;
}
