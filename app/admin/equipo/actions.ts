"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/admin/access-context";
import {
  changeTeamManagedSystemRole,
  createTeamMember,
  disableAdminAccount,
  reactivateAdminAccount,
  resendTeamSetupInvitation,
  updateTeamManagedProfessionalProfile,
  setAdminModuleAccess,
} from "@/lib/admin/team-access";

export type TeamActionState = Readonly<{ error: string; success: string }>;
export const initialTeamActionState: TeamActionState = { error: "", success: "" };

function messageFor(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    admin_access_self_mutation_forbidden: "No puedes modificar tu propia cuenta desde Equipo.",
    admin_access_last_super_admin_forbidden: "No se puede retirar la última cuenta de superadministración activa.",
    admin_access_setup_resend_state_invalid: "La invitación solo puede reenviarse a una cuenta pendiente de configuración.",
    admin_access_setup_resend_rate_limited: "Espera un minuto antes de reenviar otra invitación.",
    admin_access_setup_delivery_unavailable: "No se pudo enviar la invitación. La cuenta sigue pendiente; inténtalo nuevamente.",
    admin_access_setup_delivery_failed: "No se pudo enviar la invitación. La cuenta sigue pendiente; inténtalo nuevamente.",
    admin_access_reactivation_state_invalid: "Solo se pueden reactivar cuentas desactivadas.",
    admin_access_team_role_invalid: "Selecciona un acceso del sistema válido.",
    admin_access_team_role_state_invalid: "Reactiva la cuenta antes de cambiar su acceso.",
    admin_access_team_super_admin_mutation_forbidden: "La autoridad de superadministración se administra por separado.",
    admin_access_already_disabled: "Esta cuenta ya está desactivada.",
    admin_access_module_target_invalid: "Los accesos por módulo solo aplican a cuentas miembro.",
    admin_access_module_invalid: "El acceso seleccionado no es válido.",
  };
  return messages[code] ?? "No fue posible completar esta acción. Inténtalo nuevamente.";
}

async function actorId() {
  return (await requireSuperAdmin()).user.id;
}

function invalidateTeamPaths(userId?: string) {
  revalidatePath("/admin/equipo");
  if (userId) revalidatePath(`/admin/equipo/${userId}`);
}

export async function createMemberAction(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const actor = await actorId();
  try {
    const result = await createTeamMember(actor, {
      displayName: String(formData.get("displayName") || ""), email: String(formData.get("email") || ""), username: String(formData.get("username") || ""),
      professionalRoles: String(formData.get("professionalRoles") || ""), professionalCustomTitle: String(formData.get("professionalCustomTitle") || ""),
      professionalLicenseNumber: String(formData.get("professionalLicenseNumber") || ""), systemRole: String(formData.get("systemRole") || "member") as "admin" | "member",
    });
    if (!result.ok) return { error: result.error, success: "" };
    invalidateTeamPaths(result.id);
    redirect(`/admin/equipo/${result.id}?notice=${result.invitationSent ? "created" : "created_delivery_failed"}`);
  } catch (error) {
    return { error: messageFor(error), success: "" };
  }
}

export async function updateMemberProfileAction(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const targetId = String(formData.get("targetId") || "");
  try {
    const result = await updateTeamManagedProfessionalProfile(await actorId(), targetId, {
      displayName: String(formData.get("displayName") || ""), professionalRoles: String(formData.get("professionalRoles") || ""),
      professionalCustomTitle: String(formData.get("professionalCustomTitle") || ""), professionalLicenseNumber: String(formData.get("professionalLicenseNumber") || ""),
    });
    if (!result.ok) return { error: result.error, success: "" };
    invalidateTeamPaths(targetId);
    redirect(`/admin/equipo/${targetId}?notice=updated`);
  } catch (error) {
    return { error: messageFor(error), success: "" };
  }
}

export async function resendInvitationAction(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const targetId = String(formData.get("targetId") || "");
  try {
    await resendTeamSetupInvitation(await actorId(), targetId);
    invalidateTeamPaths(targetId);
    return { error: "", success: "Invitación reenviada." };
  } catch (error) { return { error: messageFor(error), success: "" }; }
}

export async function changeMemberRoleAction(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const targetId = String(formData.get("targetId") || "");
  const nextRole = String(formData.get("systemRole") || "") as "admin" | "member";
  try {
    await changeTeamManagedSystemRole(await actorId(), targetId, nextRole);
    invalidateTeamPaths(targetId);
    return { error: "", success: "Acceso actualizado." };
  } catch (error) { return { error: messageFor(error), success: "" }; }
}

export async function disableMemberAction(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const targetId = String(formData.get("targetId") || "");
  try {
    await disableAdminAccount(await actorId(), targetId);
    invalidateTeamPaths(targetId);
    return { error: "", success: "Cuenta desactivada." };
  } catch (error) { return { error: messageFor(error), success: "" }; }
}

export async function reactivateMemberAction(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const targetId = String(formData.get("targetId") || "");
  try {
    const result = await reactivateAdminAccount(await actorId(), targetId);
    invalidateTeamPaths(targetId);
    return result.invitationSent
      ? { error: "", success: "Cuenta reactivada; se envió una nueva invitación." }
      : { error: "La cuenta fue reactivada y quedó pendiente de configuración, pero no se pudo enviar la invitación. Reenvíala desde esta cuenta.", success: "" };
  } catch (error) { return { error: messageFor(error), success: "" }; }
}

export async function setMemberModuleAccessAction(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const targetId = String(formData.get("targetId") || "");
  const moduleKey = String(formData.get("moduleKey") || "") as import("@/lib/admin/access-types").ModuleKey;
  const rawLevel = String(formData.get("accessLevel") || "");
  const accessLevel = rawLevel === "view" || rawLevel === "manage" ? rawLevel : null;
  try {
    await setAdminModuleAccess(await actorId(), targetId, moduleKey, accessLevel);
    invalidateTeamPaths(targetId);
    return { error: "", success: "Acceso actualizado." };
  } catch (error) { return { error: messageFor(error), success: "" }; }
}
