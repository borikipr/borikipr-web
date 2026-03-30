import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} no está configurado.`);
  }
  return value;
}

const accountId = getRequiredEnv("R2_ACCOUNT_ID");
const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");
const bucketName = getRequiredEnv("R2_BUCKET_NAME");
const publicBaseUrl = getRequiredEnv("R2_PUBLIC_BASE_URL").replace(/\/$/, "");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

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
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const key = buildObjectKey(file.name, folder);

  await r2.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
    })
  );

  return `${publicBaseUrl}/${key}`;
}