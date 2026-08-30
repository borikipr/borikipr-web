import "server-only";

import { cache } from "react";
import { sql } from "@/lib/db";
import { parseProfessionalRoles, type ProfessionalRoleId } from "@/lib/admin/professional-profile";
import type { PublicProfileApprovalState } from "@/lib/admin/professional-profile";
import type { AccessLevel, AccountState, ModuleKey, SystemRole } from "@/lib/admin/access-types";

export type TeamDirectoryMember = Readonly<{
  id: string;
  displayName: string;
  username: string;
  email: string | null;
  systemRole: SystemRole;
  accountState: AccountState;
  professionalRoles: ProfessionalRoleId[];
  professionalTitle: string | null;
  professionalLicenseNumber: string | null;
  profileImageUrl: string | null;
  signingBrokerAuthorized: boolean;
  assignedBrokerUserId: string | null;
  assignedBrokerName: string | null;
  publicProfileEnabled: boolean;
  publicProfileApprovalState: PublicProfileApprovalState;
  moduleAccess: ReadonlyMap<ModuleKey, AccessLevel>;
}>;

export type TeamSigningBrokerOption = Readonly<{
  id: string;
  displayName: string;
  licenseNumber: string;
}>;

type TeamDirectoryRow = {
  id: string;
  display_name: string | null;
  username: string;
  email: string | null;
  system_role: SystemRole;
  account_state: AccountState;
  professional_roles: unknown;
  professional_title: string | null;
  professional_license_number: string | null;
  profile_image_url: string | null;
  signing_broker_authorized_at: string | Date | null;
  assigned_broker_user_id: string | null;
  assigned_broker_name: string | null;
  public_profile_enabled: boolean;
  public_profile_approval_state: PublicProfileApprovalState;
};

function toTeamDirectoryMember(row: TeamDirectoryRow, moduleAccess = new Map<ModuleKey, AccessLevel>()): TeamDirectoryMember {
  return {
    id: row.id,
    displayName: row.display_name?.trim() || row.username,
    username: row.username,
    email: row.email?.trim() || null,
    systemRole: row.system_role,
    accountState: row.account_state,
    professionalRoles: parseProfessionalRoles(row.professional_roles) ?? [],
    professionalTitle: row.professional_title?.trim() || null,
    professionalLicenseNumber: row.professional_license_number?.trim() || null,
    profileImageUrl: row.profile_image_url || null,
    signingBrokerAuthorized: Boolean(row.signing_broker_authorized_at),
    assignedBrokerUserId: row.assigned_broker_user_id,
    assignedBrokerName: row.assigned_broker_name?.trim() || null,
    publicProfileEnabled: row.public_profile_enabled,
    publicProfileApprovalState: row.public_profile_approval_state,
    moduleAccess,
  };
}

export const listTeamDirectoryMembers = cache(async (): Promise<TeamDirectoryMember[]> => {
  const rows = await sql<TeamDirectoryRow[]>`
    SELECT admin.id::text, admin.display_name, admin.username, admin.email, admin.system_role, admin.account_state,
           admin.professional_roles, admin.professional_title, admin.professional_license_number, admin.profile_image_url,
           admin.signing_broker_authorized_at, admin.assigned_broker_user_id::text,
           coalesce(nullif(btrim(broker.display_name),''), broker.username) as assigned_broker_name,
           admin.public_profile_enabled, admin.public_profile_approval_state
      FROM public.admin_users admin
      LEFT JOIN public.admin_users broker ON broker.id=admin.assigned_broker_user_id
     ORDER BY lower(COALESCE(NULLIF(trim(admin.display_name), ''), admin.username)), admin.id
  `;
  return rows.map((row) => toTeamDirectoryMember(row));
});

/** Bounded, authorized-only options for assigning a member's signing broker. */
export const listTeamSigningBrokerOptions = cache(async (): Promise<TeamSigningBrokerOption[]> => {
  const rows = await sql<{ id: string; display_name: string | null; username: string; professional_license_number: string }[]>`
    SELECT admin.id::text, admin.display_name, admin.username,
           btrim(admin.professional_license_number) AS professional_license_number
      FROM public.admin_users admin
      LEFT JOIN public.admin_module_access signing_access
        ON signing_access.admin_user_id = admin.id
       AND signing_access.module_key = 'signatures'
     WHERE admin.activo = true
       AND admin.account_state = 'active'
       AND admin.signing_broker_authorized_at IS NOT NULL
       AND 'real_estate_broker' = ANY(admin.professional_roles)
       AND nullif(btrim(admin.professional_license_number), '') IS NOT NULL
       AND (admin.system_role IN ('super_admin', 'admin') OR signing_access.access_level = 'manage')
     ORDER BY lower(coalesce(nullif(btrim(admin.display_name), ''), admin.username)), admin.id
  `;
  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name?.trim() || row.username,
    licenseNumber: row.professional_license_number,
  }));
});

export const getTeamDirectoryMember = cache(async (id: string): Promise<TeamDirectoryMember | null> => {
  const rows = await sql<TeamDirectoryRow[]>`
    SELECT admin.id::text, admin.display_name, admin.username, admin.email, admin.system_role, admin.account_state,
           admin.professional_roles, admin.professional_title, admin.professional_license_number, admin.profile_image_url,
           admin.signing_broker_authorized_at, admin.assigned_broker_user_id::text,
           coalesce(nullif(btrim(broker.display_name),''), broker.username) as assigned_broker_name,
           admin.public_profile_enabled, admin.public_profile_approval_state
      FROM public.admin_users admin LEFT JOIN public.admin_users broker ON broker.id=admin.assigned_broker_user_id
     WHERE admin.id = ${id}::uuid
     LIMIT 1
  `;
  if (!rows[0]) return null;
  const grants = await sql<{ module_key: ModuleKey; access_level: AccessLevel }[]>`
    SELECT module_key, access_level FROM public.admin_module_access WHERE admin_user_id = ${id}::uuid
  `;
  return toTeamDirectoryMember(rows[0], new Map(grants.map((grant) => [grant.module_key, grant.access_level])));
});
