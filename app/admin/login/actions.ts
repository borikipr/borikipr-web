"use server";

import { redirect } from "next/navigation";
import { authenticateAdmin, createAdminSession } from "@/lib/admin/auth";

export type LoginState = {
  error: string;
};

export async function loginAdmin(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();

  if (!username || !password) {
    return { error: "Completa usuario y contraseña." };
  }

  const user = await authenticateAdmin(username, password);

  if (!user) {
    return { error: "Credenciales inválidas." };
  }

  await createAdminSession(user);

  redirect("/admin");
}