"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/admin/access-context";
import {
  changeTeamManagedSystemRole,
  createTeamMember,
  disableAdminAccount,
  reactivateAdminAccount,
  resendTeamSetupInvitation,
  updateTeamManagedProfessionalProfile,
  updateTeamProfessionalProfileByAdmin,
  setAdminModuleAccess,
  setSigningBrokerAuthorization,
  setAssignedSigningBroker,
  approvePublicProfessionalProfile,
  withdrawPublicProfessionalProfileApproval,
} from "@/lib/admin/team-access";
import { PUBLIC_PROPERTIES_CACHE_TAG } from "@/lib/queries/propiedades";

export type TeamActionState = Readonly<{ error: string; success: string; field?: string }>;
export const initialTeamActionState: TeamActionState = { error: "", success: "" };

function messageFor(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    admin_access_self_mutation_forbidden: "No puedes modificar tu propia cuenta desde Equipo.",
    admin_access_owns_target: "No puedes realizar esta acción sobre tu propia cuenta.",
    admin_access_public_profile_target_inactive: "El perfil debe pertenecer a una cuenta activa.",
    admin_access_public_profile_approval_state_invalid: "El perfil no está listo para esa revisión.",
    admin_access_public_profile_withdrawal_state_invalid: "El perfil no tiene una aprobación activa para retirar.",
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
    admin_access_broker_account_inactive: "La cuenta debe estar activa para autorizarla como corredor(a).",
    admin_access_professional_target_disabled: "Esta cuenta está deshabilitada. El perfil profesional es solo de lectura.",
    admin_access_broker_role_required: "La cuenta debe tener el rol profesional de Corredor(a) de Bienes Raíces.",
    admin_access_broker_license_required: "La cuenta necesita un número de licencia para autorizarse como corredor(a).",
    admin_access_assigned_broker_self_forbidden: "Una cuenta no puede asignarse a sí misma como corredor(a).",
    admin_access_assigned_broker_invalid: "El corredor(a) seleccionado no está disponible.",
    admin_access_assigned_broker_unauthorized: "El corredor(a) seleccionado no está autorizado para Firmas.",
  };
  return messages[code] ?? "No fue posible completar esta acción. Inténtalo nuevamente.";
}

export async function setSigningBrokerAuthorizationAction(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const targetId = String(formData.get("targetId") || "");
  const authorized = String(formData.get("authorized") || "") === "true";
  try {
    await setSigningBrokerAuthorization(await actorId(), targetId, authorized);
    invalidateTeamPaths(targetId);
    return { error: "", success: authorized ? "Corredor autorizado para Firmas." : "Autorización de corredor eliminada." };
  } catch (error) { return { error: messageFor(error), success: "" }; }
}

export async function setAssignedSigningBrokerAction(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const targetId = String(formData.get("targetId") || "");
  const rawBrokerId = String(formData.get("brokerAdminId") || "").trim();
  try {
    await setAssignedSigningBroker(await actorId(), targetId, rawBrokerId || null);
    invalidateTeamPaths(targetId);
    return { error: "", success: rawBrokerId ? "Corredor asignado para futuras solicitudes." : "Corredor asignado eliminado." };
  } catch (error) { return { error: messageFor(error), success: "" }; }
}

export async function approvePublicProfessionalProfileAction(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const targetId = String(formData.get("targetId") || "");
  try { await approvePublicProfessionalProfile(await actorId(), targetId); invalidatePublicProperties(); invalidateTeamPaths(targetId); return { error: "", success: "Perfil aprobado." }; }
  catch (error) { return { error: messageFor(error), success: "" }; }
}

export async function withdrawPublicProfessionalProfileApprovalAction(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const targetId = String(formData.get("targetId") || "");
  try { await withdrawPublicProfessionalProfileApproval(await actorId(), targetId); invalidatePublicProperties(); invalidateTeamPaths(targetId); return { error: "", success: "Aprobación retirada." }; }
  catch (error) { return { error: messageFor(error), success: "" }; }
}

async function actorId() {
  return (await requireSuperAdmin()).user.id;
}

function invalidateTeamPaths(userId?: string) {
  revalidatePath("/admin/equipo");
  if (userId) revalidatePath(`/admin/equipo/${userId}`);
}

function invalidatePublicProperties() {
  updateTag(PUBLIC_PROPERTIES_CACHE_TAG);
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
    invalidatePublicProperties();
    invalidateTeamPaths(targetId);
    redirect(`/admin/equipo/${targetId}?notice=updated`);
  } catch (error) {
    return { error: messageFor(error), success: "" };
  }
}

export async function updateTeamProfessionalProfileAction(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const targetId = String(formData.get("targetId") || "");
  try {
    const result = await updateTeamProfessionalProfileByAdmin(await actorId(), targetId, {
      displayName: String(formData.get("displayName") || ""),
      profileImageUrl: String(formData.get("profileImageUrl") || ""),
      professionalRoles: String(formData.get("professionalRoles") || ""),
      professionalCustomTitle: String(formData.get("professionalCustomTitle") || ""),
      professionalLicenseNumber: String(formData.get("professionalLicenseNumber") || ""),
      professionalEmail: String(formData.get("professionalEmail") || ""),
      professionalPhone: String(formData.get("professionalPhone") || ""),
      professionalPhoneWhatsappEnabled: String(formData.get("professionalPhoneWhatsappEnabled") || "") === "true",
      professionalBio: String(formData.get("professionalBio") || ""),
    });
    if (!result.ok) return { error: result.error, success: "", field: result.field };
    invalidatePublicProperties();
    invalidateTeamPaths(targetId);
    redirect(`/admin/equipo/${targetId}?notice=${result.pendingReview ? "professional_review_pending" : "professional_updated"}`);
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
    invalidatePublicProperties();
    invalidateTeamPaths(targetId);
    return { error: "", success: "Cuenta desactivada." };
  } catch (error) { return { error: messageFor(error), success: "" }; }
}

export async function reactivateMemberAction(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const targetId = String(formData.get("targetId") || "");
  try {
    const result = await reactivateAdminAccount(await actorId(), targetId);
    invalidatePublicProperties();
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
