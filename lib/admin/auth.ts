import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "boriki_admin_session";

type AdminUser = {
  username: string;
  password: string;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET no está configurado.");
  }

  return secret;
}

function getAdminUsers(): AdminUser[] {
  const users: AdminUser[] = [];

  const user1 = process.env.ADMIN_USER_1?.trim();
  const pass1 = process.env.ADMIN_PASS_1?.trim();

  const user2 = process.env.ADMIN_USER_2?.trim();
  const pass2 = process.env.ADMIN_PASS_2?.trim();

  if (user1 && pass1) {
    users.push({ username: user1, password: pass1 });
  }

  if (user2 && pass2) {
    users.push({ username: user2, password: pass2 });
  }

  return users;
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function buildSessionValue(username: string) {
  const signature = signValue(username);
  return `${username}.${signature}`;
}

export function verifyAdminSessionValue(sessionValue: string | undefined | null) {
  if (!sessionValue) return null;

  const lastDot = sessionValue.lastIndexOf(".");

  if (lastDot === -1) return null;

  const username = sessionValue.slice(0, lastDot);
  const signature = sessionValue.slice(lastDot + 1);

  if (!username || !signature) return null;

  const expectedSignature = signValue(username);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  const userExists = getAdminUsers().some((user) => user.username === username);

  if (!userExists) {
    return null;
  }

  return username;
}

export async function authenticateAdmin(username: string, password: string) {
  const cleanUsername = username.trim();
  const cleanPassword = password.trim();

  const match = getAdminUsers().find(
    (user) =>
      user.username === cleanUsername && user.password === cleanPassword
  );

  if (!match) {
    return null;
  }

  return match.username;
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