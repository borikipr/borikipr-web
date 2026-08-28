import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  hashPasswordResetToken,
  parseAdminSessionValue,
  signAdminSessionPayload,
  validateNewPassword,
  verifyLegacyAdminSession,
} from "../lib/admin/auth-core.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const [migration, authSource, middlewareSource, loginPageSource, loginFormSource, forgotSource, accountSource, profileSource] = await Promise.all([
  readFile(`${root}/db/migrations/0013_extend_admin_authentication.sql`, "utf8"),
  readFile(`${root}/lib/admin/auth.ts`, "utf8"),
  readFile(`${root}/lib/admin/middleware.ts`, "utf8"),
  readFile(`${root}/app/admin/login/page.tsx`, "utf8"),
  readFile(`${root}/app/admin/login/LoginForm.tsx`, "utf8"),
  readFile(`${root}/app/admin/forgot-password/page.tsx`, "utf8"),
  readFile(`${root}/lib/admin/account.ts`, "utf8"),
  readFile(`${root}/app/admin/profile/ProfileForms.tsx`, "utf8"),
]);

test("versioned session is signed, expires, and rejects tampering", () => {
  const secret = "synthetic-secret-at-least-32-characters";
  const payload = { adminId: "00000000-0000-4000-8000-000000000001", username: "synthetic-admin", sessionVersion: 4, expiresAt: 2_000 };
  const session = signAdminSessionPayload(payload, secret);
  assert.deepEqual(parseAdminSessionValue(session, secret, 1_000), payload);
  assert.equal(parseAdminSessionValue(`${session}x`, secret, 1_000), null);
  assert.equal(parseAdminSessionValue(session, secret, 2_000), null);
});

test("legacy sessions remain accepted only by their valid HMAC", async () => {
  const { createHmac } = await import("node:crypto");
  const secret = "synthetic-secret-at-least-32-characters";
  const username = "legacy-admin";
  const signature = createHmac("sha256", secret).update(username).digest("hex");
  assert.equal(verifyLegacyAdminSession(`${username}.${signature}`, secret), username);
  assert.equal(verifyLegacyAdminSession(`${username}.${signature}0`, secret), null);
});

test("password reset tokens are one-way hashes and password policy is enforced", () => {
  const hash = hashPasswordResetToken("synthetic-secret-reset-token");
  assert.equal(hash.length, 64);
  assert.doesNotMatch(hash, /synthetic-secret-reset-token/);
  assert.match(validateNewPassword("short") || "", /12 caracteres/);
  assert.match(validateNewPassword("alllowercase123") || "", /mayúsculas/);
  assert.equal(validateNewPassword("ValidPassword123"), null);
});

test("migration extends the existing admin table without creating another user store", () => {
  assert.match(migration, /ALTER TABLE public\.admin_users/);
  assert.match(migration, /ADD COLUMN display_name text NULL/);
  assert.match(migration, /ADD COLUMN session_version integer NOT NULL DEFAULT 1/);
  assert.match(migration, /admin_password_reset_tokens/);
  assert.match(migration, /admin_auth_attempts/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.doesNotMatch(migration, /CREATE TABLE public\.admin_users/);
});

test("login and reset UX avoid account enumeration and expose recovery", () => {
  assert.match(loginFormSource, /¿Olvidaste tu contraseña\?/);
  assert.match(loginPageSource, /if \(await getAdminSession\(\)\) redirect\("\/admin"\)/);
  assert.match(forgotSource, /Si existe una cuenta, recibirás un email/);
  assert.doesNotMatch(forgotSource, /cuenta no existe|email no existe/i);
  assert.match(accountSource, /randomBytes\(32\)/);
  assert.match(accountSource, /email_sent_at IS NOT NULL/);
  assert.match(accountSource, /idempotencyKey: `admin-password-reset:/);
});

test("session cookies retain secure production flags and version checks", () => {
  assert.match(authSource, /httpOnly: true/);
  assert.match(authSource, /sameSite: "lax"/);
  assert.match(authSource, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(authSource, /row\.session_version !== payload\.sessionVersion/);
  assert.match(authSource, /priority: "high"/);
});

test("admin proxy protects private routes while recovery routes remain public", () => {
  assert.match(middlewareSource, /"\/admin\/forgot-password"/);
  assert.match(middlewareSource, /"\/admin\/reset-password"/);
  assert.match(middlewareSource, /NextResponse\.redirect\(new URL\("\/admin\/login"/);
  assert.match(middlewareSource, /parseAdminSessionValue/);
});

test("profile is self-service only and username is read-only", () => {
  assert.match(profileSource, /value=\{username\} readOnly/);
  assert.match(profileSource, /name="currentPassword"/);
  assert.match(profileSource, /Guardar cambios/);
  assert.match(profileSource, /Cambiar contraseña/);
  assert.doesNotMatch(profileSource, /crear administrador|invitar/i);
});

test("professional profile identity remains presentation-only and uses managed avatar media", async () => {
  const [profilePage, profileActions, accountSource, uploadRoute, authSource, storageSource, migration, rollback, schemaAudit] = await Promise.all([
    readFile(`${root}/app/admin/profile/page.tsx`, "utf8"),
    readFile(`${root}/app/admin/profile/actions.ts`, "utf8"),
    readFile(`${root}/lib/admin/account.ts`, "utf8"),
    readFile(`${root}/app/api/admin/upload/route.ts`, "utf8"),
    readFile(`${root}/lib/admin/auth.ts`, "utf8"),
    readFile(`${root}/lib/r2.ts`, "utf8"),
    readFile(`${root}/db/migrations/0043_add_admin_profile_identity.sql`, "utf8"),
    readFile(`${root}/db/migrations/0043_add_admin_profile_identity.rollback.sql`, "utf8"),
    readFile(`${root}/scripts/migrations/audit-schema-version.mjs`, "utf8"),
  ]);
  assert.match(profileSource, /Cargo profesional/);
  assert.match(profileSource, /Foto profesional/);
  assert.match(profileSource, /Rol del sistema:/);
  assert.match(profilePage, /professionalTitle/);
  assert.match(profileActions, /profileImageUrl/);
  assert.match(accountSource, /professional_title = NULLIF/);
  assert.match(accountSource, /startsWith\("perfiles\/"\)/);
  assert.match(uploadRoute, /purpose !== "profile"/);
  assert.match(uploadRoute, /"perfiles"/);
  assert.match(storageSource, /key\.startsWith\("perfiles\/"\)/);
  assert.match(authSource, /professionalTitle/);
  assert.match(migration, /professional_title text NULL/);
  assert.match(migration, /profile_image_url text NULL/);
  assert.match(rollback, /rollback blocked: admin profile identity data exists/);
  assert.match(schemaAudit, /AS v0043/);
  assert.doesNotMatch(migration, /activo.*professional_title|professional_title.*activo/s);
});

test("authentication logs never include account identifiers or reset tokens", () => {
  const logCalls = [...accountSource.matchAll(/console\.(?:error|warn|log)\(([^\n]*)/g)].map((match) => match[1]).join("\n");
  assert.doesNotMatch(logCalls, /user\.email|user\.username|token|resetUrl/);
});
