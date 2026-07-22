import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
export const PASSWORD_RESET_TTL_MINUTES = 45;
export const LOGIN_RATE_LIMIT = 5;
export const LOGIN_RATE_WINDOW_MINUTES = 15;
export const RESET_RATE_LIMIT = 3;
export const RESET_RATE_WINDOW_MINUTES = 60;

export type AdminSessionPayload = {
  adminId: string;
  username: string;
  sessionVersion: number;
  expiresAt: number;
};

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function signAdminSessionPayload(
  payload: AdminSessionPayload,
  secret: string
) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("hex");
  return `v2.${encoded}.${signature}`;
}

export function parseAdminSessionValue(
  value: string | null | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  if (!value?.startsWith("v2.")) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [, encoded, signature] = parts;
  const expected = createHmac("sha256", secret)
    .update(encoded)
    .digest("hex");
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as Partial<AdminSessionPayload>;
    if (
      typeof payload.adminId !== "string" ||
      typeof payload.username !== "string" ||
      !Number.isInteger(payload.sessionVersion) ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= nowSeconds
    ) {
      return null;
    }
    return payload as AdminSessionPayload;
  } catch {
    return null;
  }
}

export function verifyLegacyAdminSession(
  value: string | null | undefined,
  secret: string
) {
  if (!value || value.startsWith("v2.")) return null;
  const lastDot = value.lastIndexOf(".");
  if (lastDot < 1) return null;
  const username = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);
  const expected = createHmac("sha256", secret)
    .update(username)
    .digest("hex");
  return safeEqual(signature, expected) ? username : null;
}

export function hashOpaqueValue(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function hashPasswordResetToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeAdminEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateNewPassword(password: string) {
  if (password.length < 12) {
    return "La nueva contraseña debe tener al menos 12 caracteres.";
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Incluye letras mayúsculas, minúsculas y al menos un número.";
  }
  return null;
}
