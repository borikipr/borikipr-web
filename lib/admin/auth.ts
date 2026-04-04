import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

export const SESSION_COOKIE = "boriki_admin_session";

type AdminUser = {
  username: string;
  password_hash: string;
  activo: boolean;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error("SESSION_SECRET no está configurado.");
  }

  return secret;
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("hex");
}

function buildSessionValue(username: string) {
  const signature = signValue(username);
  return `${username}.${signature}`;
}

async function getAdminUsers() {
  const users = await sql<AdminUser[]>`
    SELECT username, password_hash, activo
    FROM admin_users
    WHERE activo = true
  `;

  return users;
}

export async function authenticateAdmin(username: string, password: string) {
  const cleanUsername = username.trim();
  const cleanPassword = password.trim();

  const users = await getAdminUsers();
  const user = users.find((u) => u.username === cleanUsername);

  if (!user) return null;

  const matches = await bcrypt.compare(cleanPassword, user.password_hash);

  return matches ? user.username : null;
}

export async function verifyAdminSessionValue(
  sessionValue: string | undefined | null
) {
  if (!sessionValue) return null;

  const lastDot = sessionValue.lastIndexOf(".");
  if (lastDot === -1) return null;

  const username = sessionValue.slice(0, lastDot);
  const signature = sessionValue.slice(lastDot + 1);

  if (!username || !signature) return null;

  const expectedSignature = signValue(username);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) return null;

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  const users = await getAdminUsers();
  const userExists = users.some((u) => u.username === username);

  return userExists ? username : null;
}

export async function createAdminSession(username: string) {
  const cookieStore = await cookies();

  cookieStore.set({
    name: SESSION_COOKIE,
    value: buildSessionValue(username),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();

  cookieStore.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getAdminSessionUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;

  return verifyAdminSessionValue(session);
}