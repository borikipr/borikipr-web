import "server-only";

import type { ProfessionalRoleId } from "@/lib/admin/professional-profile";

export type ListingResponsibilityRole = "real_estate_broker" | "real_estate_salesperson";

export type ListingResponsibleProfessional = Readonly<{
  id: string;
  displayName: string;
  role: ListingResponsibilityRole;
  licenseNumber: string;
}>;

export type ListingResponsibleCurrent = Readonly<{
  id: string;
  displayName: string;
  roleLabel: string;
  licenseNumber: string | null;
  eligible: boolean;
}>;

export type ListingResponsibilityDatabase = {
  unsafe<T = unknown>(query: string, parameters?: readonly unknown[]): Promise<T[]>;
};

type ProfessionalRow = {
  id: string;
  display_name: string;
  professional_roles: unknown;
  professional_license_number: string | null;
  professional_title?: string | null;
  activo: boolean;
  account_state: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRoles(value: unknown): ProfessionalRoleId[] {
  if (!Array.isArray(value)) return [];
  return value.filter((role): role is ProfessionalRoleId => typeof role === "string");
}

function eligibleRole(roles: readonly ProfessionalRoleId[]): ListingResponsibilityRole | null {
  if (roles.includes("real_estate_broker")) return "real_estate_broker";
  if (roles.includes("real_estate_salesperson")) return "real_estate_salesperson";
  return null;
}

function toProfessional(row: ProfessionalRow): ListingResponsibleProfessional | null {
  const role = eligibleRole(parseRoles(row.professional_roles));
  const licenseNumber = row.professional_license_number?.trim() || "";
  if (!role || !licenseNumber) return null;
  return { id: row.id, displayName: row.display_name.trim(), role, licenseNumber };
}

export function isListingResponsibleProfessionalEligible(row: Pick<ProfessionalRow, "professional_roles" | "professional_license_number" | "activo" | "account_state">) {
  return row.activo && row.account_state === "active" && Boolean(toProfessional({ ...row, id: "", display_name: "" }));
}

export function listingResponsibleProfessionalLabel(professional: ListingResponsibleProfessional) {
  const role = professional.role === "real_estate_broker" ? "Corredora" : "Vendedor(a)";
  return `${professional.displayName} — ${role} · Lic. ${professional.licenseNumber}`;
}

export function parseListingResponsibleUserId(value: FormDataEntryValue | null) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id) return { ok: true as const, value: null };
  if (!UUID.test(id)) return { ok: false as const, error: "listing_responsibility_invalid" as const };
  return { ok: true as const, value: id };
}

export function listingResponsibilityErrorMessage(error: "listing_responsibility_required" | "listing_responsibility_invalid" | "listing_responsibility_unavailable") {
  if (error === "listing_responsibility_required") return "Selecciona la persona responsable del listado.";
  if (error === "listing_responsibility_unavailable") return "La persona responsable seleccionada ya no está disponible.";
  return "Selecciona una persona responsable válida.";
}

const PROFESSIONAL_SELECT = `
  SELECT admin.id::text,
         coalesce(nullif(btrim(admin.display_name), ''), admin.username) AS display_name,
         admin.professional_roles,
         btrim(admin.professional_license_number) AS professional_license_number,
         nullif(btrim(admin.professional_title), '') AS professional_title,
         admin.activo,
         admin.account_state
    FROM public.admin_users admin`;

export async function listEligibleListingResponsibleProfessionals(database: ListingResponsibilityDatabase) {
  const rows = await database.unsafe<ProfessionalRow>(
    `${PROFESSIONAL_SELECT}
      WHERE admin.activo = true
        AND admin.account_state = 'active'
        AND admin.professional_roles && ARRAY['real_estate_broker', 'real_estate_salesperson']::text[]
        AND nullif(btrim(admin.professional_license_number), '') IS NOT NULL
      ORDER BY lower(coalesce(nullif(btrim(admin.display_name), ''), admin.username)), admin.id`,
  );
  return rows.flatMap((row) => {
    const professional = toProfessional(row);
    return professional ? [professional] : [];
  });
}

export async function getListingResponsibleCurrent(database: ListingResponsibilityDatabase, userId: string | null) {
  if (!userId || !UUID.test(userId)) return null;
  const rows = await database.unsafe<ProfessionalRow>(
    `${PROFESSIONAL_SELECT} WHERE admin.id = $1::uuid LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  const professional = toProfessional(row);
  const role = eligibleRole(parseRoles(row.professional_roles));
  return {
    id: row.id,
    displayName: row.display_name.trim(),
    roleLabel: role === "real_estate_broker" ? "Corredora" : role === "real_estate_salesperson" ? "Vendedor(a)" : row.professional_title || "Rol profesional no elegible",
    licenseNumber: row.professional_license_number?.trim() || null,
    eligible: Boolean(professional && isListingResponsibleProfessionalEligible(row)),
  } satisfies ListingResponsibleCurrent;
}

export async function validateListingResponsibleProfessionalForUpdate(database: ListingResponsibilityDatabase, userId: string) {
  const rows = await database.unsafe<ProfessionalRow>(
    `${PROFESSIONAL_SELECT} WHERE admin.id = $1::uuid FOR UPDATE`,
    [userId],
  );
  const row = rows[0];
  const professional = row ? toProfessional(row) : null;
  if (!row || !professional || !isListingResponsibleProfessionalEligible(row)) return null;
  return professional;
}

export async function writeListingResponsibilityEvent(
  database: ListingResponsibilityDatabase,
  input: { propertyId: string; previousResponsibleUserId: string | null; nextResponsibleUserId: string | null; actorAdminUserId: string },
) {
  const { propertyId, previousResponsibleUserId: previous, nextResponsibleUserId: next, actorAdminUserId } = input;
  if (previous === next) return;
  const eventType = previous === null ? "assigned" : next === null ? "cleared" : "changed";
  await database.unsafe(
    `INSERT INTO public.property_listing_responsibility_events (
       property_id, event_type, previous_responsible_user_id, next_responsible_user_id, actor_admin_user_id
     ) VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5::uuid)`,
    [propertyId, eventType, previous, next, actorAdminUserId],
  );
}
