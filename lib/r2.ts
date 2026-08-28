import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export class PrivateR2ObjectNotFoundError extends Error {
  constructor() {
    super("Private R2 object not found.");
    this.name = "PrivateR2ObjectNotFoundError";
  }
}

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicBaseUrl) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicBaseUrl };
}

function getPrivateR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

export function isR2Configured() {
  return Boolean(getR2Config());
}

export function isPrivateR2Configured() {
  return Boolean(getPrivateR2Config());
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function buildObjectKey(fileName: string, folder = "propiedades") {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const safeName = sanitizeFileName(fileName);
  const random = crypto.randomUUID();

  return `${folder}/${year}/${month}/${random}-${safeName}`;
}

export async function uploadImageToR2(file: File, folder = "propiedades") {
  const config = getR2Config();

  if (!config) {
    throw new Error("Cloudflare R2 no esta configurado.");
  }

  const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const key = buildObjectKey(file.name, folder);

  await r2.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
    })
  );

  return `${config.publicBaseUrl}/${key}`;
}

export async function uploadFileToR2Key(file: File, key: string) {
  const config = getPrivateR2Config();

  if (!config) {
    throw new Error("Cloudflare R2 no esta configurado.");
  }

  if (!isSafePrivateObjectKey(key)) {
    throw new Error("Invalid private R2 object key.");
  }

  const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  await r2.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type || "application/octet-stream",
    })
  );
}

export async function inspectPrivateR2Object(key: string) {
  const config = getPrivateR2Config();
  if (!config) throw new Error("Cloudflare R2 no esta configurado.");
  assertSafePrivateObjectKey(key);

  const r2 = createPrivateR2Client(config);
  try {
    const result = await r2.send(
      new HeadObjectCommand({ Bucket: config.bucketName, Key: key })
    );
    return {
      exists: true as const,
      contentLength:
        result.ContentLength === undefined ? null : Number(result.ContentLength),
      contentType: result.ContentType || null,
    };
  } catch (error) {
    if (isMissingObjectError(error)) {
      return { exists: false as const, contentLength: null, contentType: null };
    }
    throw error;
  } finally {
    r2.destroy();
  }
}

export async function downloadPrivateR2Object(key: string) {
  const config = getPrivateR2Config();
  if (!config) throw new Error("Cloudflare R2 no esta configurado.");
  assertSafePrivateObjectKey(key);

  const r2 = createPrivateR2Client(config);
  try {
    const result = await r2.send(
      new GetObjectCommand({ Bucket: config.bucketName, Key: key })
    );
    if (!result.Body) throw new Error("Private R2 object has no body.");
    return {
      bytes: await result.Body.transformToByteArray(),
      contentType: result.ContentType || null,
    };
  } catch (error) {
    if (isMissingObjectError(error)) throw new PrivateR2ObjectNotFoundError();
    throw error;
  } finally {
    r2.destroy();
  }
}

export type ManagedR2Object = {
  key: string;
  size: number | null;
  lastModified: Date | null;
};

export async function listManagedR2ObjectsPage(input: {
  prefix: string;
  continuationToken?: string;
  maxKeys?: number;
}) {
  const config = getPrivateR2Config();
  if (!config) throw new Error("Cloudflare R2 no esta configurado.");
  if (!isSafeManagedPrefix(input.prefix)) {
    throw new Error("Invalid managed R2 prefix.");
  }

  const r2 = createPrivateR2Client(config);
  try {
    const result = await r2.send(
      new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: input.prefix,
        ContinuationToken: input.continuationToken,
        MaxKeys: Math.min(Math.max(input.maxKeys ?? 500, 1), 1000),
      })
    );
    return {
      objects: (result.Contents ?? [])
        .filter((object): object is typeof object & { Key: string } => Boolean(object.Key))
        .map((object) => ({
          key: object.Key,
          size: object.Size === undefined ? null : Number(object.Size),
          lastModified: object.LastModified ?? null,
        })),
      nextContinuationToken: result.NextContinuationToken,
    };
  } finally {
    r2.destroy();
  }
}

export async function deleteEligiblePublicMediaObject(key: string) {
  const config = getPrivateR2Config();
  if (!config) throw new Error("Cloudflare R2 no esta configurado.");
  if (!isSafePublicMediaObjectKey(key)) {
    throw new Error("R2 deletion is limited to managed public media.");
  }

  const r2 = createPrivateR2Client(config);
  try {
    await r2.send(
      new DeleteObjectCommand({ Bucket: config.bucketName, Key: key })
    );
  } finally {
    r2.destroy();
  }
}

export function extractManagedPublicObjectKey(url: string) {
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!publicBaseUrl || !url.startsWith(`${publicBaseUrl}/`)) return null;
  const key = decodeURIComponent(url.slice(publicBaseUrl.length + 1));
  return isSafePublicMediaObjectKey(key) ? key : null;
}

function createPrivateR2Client(config: NonNullable<ReturnType<typeof getPrivateR2Config>>) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function assertSafePrivateObjectKey(key: string) {
  if (!isSafePrivateObjectKey(key)) {
    throw new Error("Invalid private R2 object key.");
  }
}

function isMissingObjectError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const details = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return details.name === "NotFound" || details.$metadata?.httpStatusCode === 404;
}

export function isSafePrivateObjectKey(key: string) {
  return (
    key.length > 0 &&
    key.length <= 512 &&
    !key.startsWith("/") &&
    !key.includes("..") &&
    /^[a-zA-Z0-9/_+.-]+$/.test(key)
  );
}

export function isSafePublicMediaObjectKey(key: string) {
  return (
    isSafePrivateObjectKey(key) &&
    (key.startsWith("propiedades/") || key.startsWith("testimonios/") || key.startsWith("perfiles/"))
  );
}

function isSafeManagedPrefix(prefix: string) {
  return (
    prefix === "propiedades/" ||
    prefix === "testimonios/" ||
    prefix === "perfiles/" ||
    prefix === "lead-documents/"
  );
}
