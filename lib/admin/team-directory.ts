import "server-only";

import { cache } from "react";
import { sql } from "@/lib/db";
import { parseProfessionalRoles, type ProfessionalRoleId } from "@/lib/admin/professional-profile";
import type { AccountState, SystemRole } from "@/lib/admin/access-types";

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
};

function toTeamDirectoryMember(row: TeamDirectoryRow): TeamDirectoryMember {
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
  };
}

export const listTeamDirectoryMembers = cache(async (): Promise<TeamDirectoryMember[]> => {
  const rows = await sql<TeamDirectoryRow[]>`
    SELECT id::text, display_name, username, email, system_role, account_state,
           professional_roles, professional_title, professional_license_number, profile_image_url
      FROM public.admin_users
     ORDER BY lower(COALESCE(NULLIF(trim(display_name), ''), username)), id
  `;
  return rows.map(toTeamDirectoryMember);
});

export const getTeamDirectoryMember = cache(async (id: string): Promise<TeamDirectoryMember | null> => {
  const rows = await sql<TeamDirectoryRow[]>`
    SELECT id::text, display_name, username, email, system_role, account_state,
           professional_roles, professional_title, professional_license_number, profile_image_url
      FROM public.admin_users
     WHERE id = ${id}::uuid
     LIMIT 1
  `;
  return rows[0] ? toTeamDirectoryMember(rows[0]) : null;
});
