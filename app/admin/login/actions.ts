"use server";

import { redirect } from "next/navigation";
import { authenticateAdmin, createAdminSession, getSessionSecret } from "@/lib/admin/auth";
import { LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MINUTES } from "@/lib/admin/auth-core";
import { completeAuthAttempt, reserveAuthAttempt } from "@/lib/admin/account";
import { getAuthRequestIdentifier } from "@/lib/admin/request-security";

export type LoginState = { error: string };

export async function loginAdmin(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!username || !password) {
    return { error: "Completa usuario y contraseña." };
  }

  const identifier = await getAuthRequestIdentifier("login", username);
  const attemptId = await reserveAuthAttempt({
    attemptType: "login",
    identifier,
    limit: LOGIN_RATE_LIMIT,
    windowMinutes: LOGIN_RATE_WINDOW_MINUTES,
    secret: getSessionSecret(),
  });
  if (!attemptId) {
    return { error: "Demasiados intentos. Espera unos minutos antes de continuar." };
  }

  const user = await authenticateAdmin(username, password);
  await completeAuthAttempt(attemptId, Boolean(user));
  if (!user) return { error: "Credenciales inválidas." };

  await createAdminSession(user);
  redirect("/admin");
}
