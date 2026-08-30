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
    professionalRoles: String(formData.get("professionalRoles") || ""),
    professionalCustomTitle: String(formData.get("professionalCustomTitle") || ""),
    professionalLicenseNumber: String(formData.get("professionalLicenseNumber") || ""),
    profileImageUrl: String(formData.get("profileImageUrl") || ""),
    email: String(formData.get("email") || ""),
    professionalEmail: String(formData.get("professionalEmail") || ""),
    professionalPhone: String(formData.get("professionalPhone") || ""),
    professionalPhoneWhatsappEnabled: String(formData.get("professionalPhoneWhatsappEnabled") || "") === "true",
    professionalBio: String(formData.get("professionalBio") || ""),
    publicProfileEnabled: String(formData.get("publicProfileEnabled") || "") === "true",
    currentPassword: String(formData.get("currentPassword") || ""),
  });
  if (!result.ok) return { error: result.error, success: "" };
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/profile");
  return { error: "", success: result.pendingReview ? "Tus datos profesionales cambiaron. El perfil requiere una nueva revisión." : result.cleanupWarning ? "Perfil actualizado. La limpieza de una foto anterior se completará de forma segura." : "Perfil actualizado correctamente." };
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
