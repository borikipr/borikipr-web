import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { sha256SignatureValue } from "./domain/crypto";

export const MAX_SIGNATURE_SOURCE_BYTES = 3_000_000;
const SOURCE_KEY_PATTERN =
  /^signatures\/source\/[0-9a-f-]{36}\/[1-9][0-9]*\/[0-9a-f]{64}[.]pdf$/;
const FINAL_KEY_PATTERN =
  /^signatures\/final\/[0-9a-f-]{36}\/[1-9][0-9]*\/[0-9a-f]{64}[.]pdf$/;
const CERTIFICATE_KEY_PATTERN =
  /^signatures\/certificates\/[0-9a-f-]{36}\/[1-9][0-9]*\/[0-9a-f]{64}[.]pdf$/;
export const MAX_SIGNATURE_FINAL_BYTES = 4_000_000;
export const MAX_SIGNATURE_CERTIFICATE_BYTES = 1_000_000;

export type SignatureSourceObject = Readonly<{
  key: string;
  bytes: Uint8Array;
  mimeType: "application/pdf";
  byteCount: number;
  sourceSha256: string;
}>;

export interface SignatureSourceStorage {
  putSource(input: SignatureSourceObject): Promise<"created" | "existing">;
  getSource(input: {
    key: string;
    byteCount: number;
    sourceSha256: string;
  }): Promise<Uint8Array>;
  deleteSourceIfExact(input: {
    key: string;
    byteCount: number;
    sourceSha256: string;
  }): Promise<boolean>;
}

export type ImmutableSignaturePdfObject = Readonly<{
  key: string;
  bytes: Uint8Array;
  mimeType: "application/pdf";
  byteCount: number;
  sha256: string;
}>;

export interface SignatureCompletedStorage extends SignatureSourceStorage {
  putFinal(input: ImmutableSignaturePdfObject): Promise<"created" | "existing">;
  putCertificate(input: ImmutableSignaturePdfObject): Promise<"created" | "existing">;
}

export function sanitizeSignatureFilename(filename: string) {
  const leaf = filename.split(/[\\/]/).pop()?.trim() ?? "";
  const sanitized = leaf
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 255);
  if (!sanitized || !/[.]pdf$/i.test(sanitized)) {
    throw new Error("signature_source_filename_invalid");
  }
  return sanitized;
}

function assertSourceObject(input: SignatureSourceObject) {
  if (!SOURCE_KEY_PATTERN.test(input.key)) {
    throw new Error("signature_source_key_invalid");
  }
  if (input.mimeType !== "application/pdf") {
    throw new Error("signature_source_mime_invalid");
  }
  if (
    input.byteCount !== input.bytes.byteLength ||
    input.byteCount < 1 ||
    input.byteCount > MAX_SIGNATURE_SOURCE_BYTES
  ) {
    throw new Error("signature_source_size_invalid");
  }
  if (sha256SignatureValue(input.bytes) !== input.sourceSha256) {
    throw new Error("signature_source_hash_mismatch");
  }
}

function getSigningR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("signature_r2_not_configured");
  }
  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

function createClient(accountId: string, accessKeyId: string, secretAccessKey: string) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function missing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const details = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return details.name === "NotFound" || details.$metadata?.httpStatusCode === 404;
}

function precondition(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const details = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return details.name === "PreconditionFailed" || details.$metadata?.httpStatusCode === 412;
}

export function createPrivateSignatureR2Storage(): SignatureCompletedStorage {
  const config = getSigningR2Config();
  const client = createClient(
    config.accountId,
    config.accessKeyId,
    config.secretAccessKey
  );

  async function matches(input: {
    key: string;
    byteCount: number;
    sourceSha256: string;
  }) {
    try {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: config.bucketName, Key: input.key })
      );
      return (
        Number(head.ContentLength) === input.byteCount &&
        head.ContentType === "application/pdf" &&
        head.Metadata?.sha256 === input.sourceSha256
      );
    } catch (error) {
      if (missing(error)) return false;
      throw error;
    }
  }

  async function putImmutablePdf(
    input: ImmutableSignaturePdfObject,
    keyPattern: RegExp,
    maximumBytes: number
  ): Promise<"created" | "existing"> {
    if (
      !keyPattern.test(input.key) ||
      input.mimeType !== "application/pdf" ||
      input.byteCount !== input.bytes.byteLength ||
      input.byteCount < 1 ||
      input.byteCount > maximumBytes ||
      sha256SignatureValue(input.bytes) !== input.sha256
    ) {
      throw new Error("signature_completed_object_invalid");
    }
    const descriptor = {
      key: input.key,
      byteCount: input.byteCount,
      sourceSha256: input.sha256,
    };
    if (await matches(descriptor)) return "existing";
    try {
      await client.send(new PutObjectCommand({
        Bucket: config.bucketName,
        Key: input.key,
        Body: input.bytes,
        ContentType: input.mimeType,
        ContentLength: input.byteCount,
        Metadata: { sha256: input.sha256 },
        IfNoneMatch: "*",
      }));
      return "created";
    } catch (error) {
      if (precondition(error) && (await matches(descriptor))) return "existing";
      throw new Error("signature_completed_upload_failed");
    }
  }

  return {
    async putSource(input) {
      assertSourceObject(input);
      if (await matches(input)) return "existing";
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucketName,
            Key: input.key,
            Body: input.bytes,
            ContentType: "application/pdf",
            ContentLength: input.byteCount,
            Metadata: { sha256: input.sourceSha256 },
            IfNoneMatch: "*",
          })
        );
        return "created";
      } catch (error) {
        if (precondition(error) && (await matches(input))) return "existing";
        throw new Error("signature_source_upload_failed");
      }
    },
    async getSource(input) {
      if (!SOURCE_KEY_PATTERN.test(input.key)) {
        throw new Error("signature_source_key_invalid");
      }
      const result = await client.send(
        new GetObjectCommand({ Bucket: config.bucketName, Key: input.key })
      );
      if (!result.Body) throw new Error("signature_source_unavailable");
      const bytes = await result.Body.transformToByteArray();
      if (
        bytes.byteLength !== input.byteCount ||
        sha256SignatureValue(bytes) !== input.sourceSha256
      ) {
        throw new Error("signature_source_integrity_failed");
      }
      return bytes;
    },
    async deleteSourceIfExact(input) {
      if (!(await matches(input))) return false;
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucketName, Key: input.key })
      );
      return true;
    },
    putFinal: (input) => putImmutablePdf(input, FINAL_KEY_PATTERN, MAX_SIGNATURE_FINAL_BYTES),
    putCertificate: (input) =>
      putImmutablePdf(input, CERTIFICATE_KEY_PATTERN, MAX_SIGNATURE_CERTIFICATE_BYTES),
  };
}
