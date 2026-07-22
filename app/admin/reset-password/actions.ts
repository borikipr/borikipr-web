"use server";

import { redirect } from "next/navigation";
import { createAdminSession } from "@/lib/admin/auth";
import { validateNewPassword } from "@/lib/admin/auth-core";
import { resetAdminPassword } from "@/lib/admin/account";

export type ResetPasswordState = { error: string };

export async function submitPasswordReset(
  _previous: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("confirmation") || "");
  if (!token || token.length > 100) return { error: "El enlace no es válido o ya venció." };
  const passwordError = validateNewPassword(password);
  if (passwordError) return { error: passwordError };
  if (password !== confirmation) return { error: "Las contraseñas no coinciden." };

  const result = await resetAdminPassword(token, password);
  if (!result.ok) return { error: "El enlace no es válido o ya venció." };
  await createAdminSession(result.user);
  redirect("/admin/profile?passwordReset=1");
}
