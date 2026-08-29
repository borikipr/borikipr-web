export const SYSTEM_ROLES = ["super_admin", "admin", "member"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const ACCOUNT_STATES = ["pending_setup", "active", "disabled"] as const;
export type AccountState = (typeof ACCOUNT_STATES)[number];

export const MODULE_KEYS = [
  "properties",
  "leads",
  "signatures",
  "testimonials",
  "analytics",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const ACCESS_LEVELS = ["view", "manage"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ADMIN_ACCESS_EVENT_TYPES = [
  "user_created",
  "setup_issued",
  "account_activated",
  "account_disabled",
  "account_reactivated",
  "system_role_changed",
  "module_access_granted",
  "module_access_revoked",
] as const;
export type AdminAccessEventType = (typeof ADMIN_ACCESS_EVENT_TYPES)[number];

export type PasswordTokenPurpose = "password_reset" | "account_setup";

export const systemRoleLabels: Record<SystemRole, string> = {
  super_admin: "Superadministrador",
  admin: "Administrador",
  member: "Miembro",
};

export function hasMinimumAccess(
  actual: AccessLevel | undefined,
  required: AccessLevel,
) {
  if (!actual) return false;
  return actual === "manage" || required === "view";
}
