"use server";

import { revalidatePath } from "next/cache";
import { createAdminSession, getAdminSession } from "@/lib/admin/auth";
import { validateNewPassword } from "@/lib/admin/auth-core";
import { changeOwnAdminPassword, updateOwnAdminEmail, updateOwnProfessionalProfile } from "@/lib/admin/account";

export type ProfileState = {
  error: string;
  success: string;
  field?: string;
  professionalPhoneWhatsappEnabled?: boolean;
};

function profileField(error: string) {
  if (/roles profesionales|otro rol/i.test(error)) return "professionalRoles";
  if (/licencia/i.test(error)) return "professionalLicenseNumber";
  if (/correo profesional/i.test(error)) return "professionalEmail";
  if (/teléfono profesional|WhatsApp/i.test(error)) return "professionalPhone";
  if (/biografía/i.test(error)) return "professionalBio";
  if (/foto de perfil/i.test(error)) return "profileImageUrl";
  return undefined;
}

export async function updateProfessionalProfile(
  _previous: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const admin = await getAdminSession();
  if (!admin) return { error: "Tu sesión venció. Vuelve a iniciar sesión.", success: "" };
  const result = await updateOwnProfessionalProfile({
    admin,
    displayName: String(formData.get("displayName") || ""),
    professionalRoles: String(formData.get("professionalRoles") || ""),
    professionalCustomTitle: String(formData.get("professionalCustomTitle") || ""),
    professionalLicenseNumber: String(formData.get("professionalLicenseNumber") || ""),
    profileImageUrl: String(formData.get("profileImageUrl") || ""),
    professionalEmail: String(formData.get("professionalEmail") || ""),
    professionalPhone: String(formData.get("professionalPhone") || ""),
    professionalPhoneWhatsappEnabled: String(formData.get("professionalPhoneWhatsappEnabled") || "") === "true",
    professionalBio: String(formData.get("professionalBio") || ""),
    publicProfileEnabled: String(formData.get("publicProfileEnabled") || "") === "true",
  });
  if (!result.ok) return { error: result.error, success: "", field: profileField(result.error) };
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/profile");
  return {
    error: "",
    success: result.pendingReview ? "Tus datos profesionales cambiaron. El perfil requiere una nueva revisión." : result.cleanupWarning ? "Perfil actualizado. La limpieza de una foto anterior se completará de forma segura." : "Perfil actualizado correctamente.",
    professionalPhoneWhatsappEnabled: result.professionalPhoneWhatsappEnabled,
  };
}

export async function updateAccountEmail(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const admin = await getAdminSession();
  if (!admin) return { error: "Tu sesión venció. Vuelve a iniciar sesión.", success: "" };
  const result = await updateOwnAdminEmail({
    admin,
    email: String(formData.get("email") || ""),
    currentPassword: String(formData.get("currentPassword") || ""),
  });
  if (!result.ok) return { error: result.error, success: "", field: "email" };
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/profile");
  return { error: "", success: "Correo de acceso actualizado." };
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
