export const PROFESSIONAL_ROLE_OPTIONS = [
  { id: "real_estate_broker", label: "Corredor(a) de Bienes Raíces", requiresLicense: true },
  { id: "real_estate_salesperson", label: "Vendedor(a) de Bienes Raíces", requiresLicense: true },
  { id: "administrator", label: "Administrador(a)", requiresLicense: false },
  { id: "community_manager", label: "Community Manager", requiresLicense: false },
  { id: "web_development", label: "Desarrollo Web", requiresLicense: false },
  { id: "technology_systems", label: "Tecnología y Sistemas", requiresLicense: false },
  { id: "marketing", label: "Marketing", requiresLicense: false },
  { id: "administrative_assistant", label: "Asistente Administrativo", requiresLicense: false },
  { id: "transaction_coordination", label: "Coordinación de Transacciones", requiresLicense: false },
  { id: "other", label: "Otro", requiresLicense: false },
] as const;

export type ProfessionalRoleId = (typeof PROFESSIONAL_ROLE_OPTIONS)[number]["id"];
const roleById = new Map(PROFESSIONAL_ROLE_OPTIONS.map((role) => [role.id, role]));
const MAX_PROFESSIONAL_ROLES = 2;

export function parseProfessionalRoles(value: unknown): ProfessionalRoleId[] | null {
  let source: unknown = value;
  if (typeof value === "string") {
    try { source = JSON.parse(value); } catch { return null; }
  }
  if (!Array.isArray(source) || source.length < 1 || source.length > MAX_PROFESSIONAL_ROLES) return null;
  const roles = source.filter((role): role is ProfessionalRoleId => typeof role === "string" && roleById.has(role as ProfessionalRoleId));
  return roles.length === source.length && new Set(roles).size === roles.length ? roles : null;
}

export function rolesRequireLicense(roles: readonly ProfessionalRoleId[]) {
  return roles.some((role) => roleById.get(role)?.requiresLicense);
}

export function professionalRoleLabels(roles: readonly ProfessionalRoleId[], customTitle = "") {
  const custom = customTitle.trim();
  return roles.map((role) => role === "other" && custom ? custom : roleById.get(role)?.label ?? role);
}

export function professionalRoleTitle(roles: readonly ProfessionalRoleId[], customTitle = "") {
  return professionalRoleLabels(roles, customTitle).join(" · ");
}

export function normalizeProfessionalProfile(input: { roles: unknown; customTitle: string; licenseNumber: string }) {
  const roles = parseProfessionalRoles(input.roles);
  if (!roles) return { ok: false as const, error: "Selecciona uno o dos roles profesionales válidos." };
  const customTitle = input.customTitle.trim();
  if (roles.includes("other") && (customTitle.length < 2 || customTitle.length > 120)) {
    return { ok: false as const, error: "Describe el otro rol profesional con entre 2 y 120 caracteres." };
  }
  const licenseNumber = input.licenseNumber.trim();
  if (rolesRequireLicense(roles) && !licenseNumber) {
    return { ok: false as const, error: "El número de licencia es obligatorio para Corredor(a) o Vendedor(a) de Bienes Raíces." };
  }
  if (licenseNumber.length > 80) return { ok: false as const, error: "El número de licencia es demasiado largo." };
  return {
    ok: true as const,
    roles,
    customTitle: roles.includes("other") ? customTitle : "",
    licenseNumber: rolesRequireLicense(roles) ? licenseNumber : "",
    displayTitle: professionalRoleTitle(roles, customTitle),
  };
}
