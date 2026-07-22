"use server";

import { revalidatePath } from "next/cache";
import { createAdminSession, getAdminSession } from "@/lib/admin/auth";
import { validateNewPassword } from "@/lib/admin/auth-core";
import { changeOwnAdminPassword, updateOwnAdminProfile } from "@/lib/admin/account";

export type ProfileState = { error: string; success: string };

export async function updateProfile(
  _previous: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const admin = await getAdminSession();
  if (!admin) return { error: "Tu sesión venció. Vuelve a iniciar sesión.", success: "" };
  const result = await updateOwnAdminProfile({
    admin,
    displayName: String(formData.get("displayName") || ""),
    email: String(formData.get("email") || ""),
    currentPassword: String(formData.get("currentPassword") || ""),
  });
  if (!result.ok) return { error: result.error, success: "" };
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/profile");
  return { error: "", success: "Perfil actualizado correctamente." };
}

export async function changePassword(
  _previous: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const admin = await getAdminSession();
  if (!admin) return { error: "Tu sesión venció. Vuelve a iniciar sesión.", success: "" };
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmation = String(formData.get("confirmation") || "");
  const passwordError = validateNewPassword(newPassword);
  if (passwordError) return { error: passwordError, success: "" };
  if (newPassword !== confirmation) return { error: "Las contraseñas no coinciden.", success: "" };
  const result = await changeOwnAdminPassword({ admin, currentPassword, newPassword });
  if (!result.ok) return { error: result.error, success: "" };
  await createAdminSession(result.user);
  return { error: "", success: "Contraseña actualizada. Las demás sesiones fueron cerradas." };
}
