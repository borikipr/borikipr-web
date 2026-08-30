import "server-only";

import { cache } from "react";
import { sql } from "@/lib/db";
import { isPublicProfessionalProfileEligible, parseProfessionalRoles, professionalRoleTitle, type ProfessionalProfile, type PublicProfileApprovalState } from "@/lib/admin/professional-profile";

type ProfessionalProfileRow = {
  display_name: string | null; professional_title: string | null; professional_roles: unknown;
  professional_license_number: string | null; profile_image_url: string | null;
  professional_email: string | null; professional_phone_e164: string | null;
  professional_phone_whatsapp_enabled: boolean; professional_bio: string | null;
  public_profile_enabled: boolean; public_profile_slug: string | null;
  public_profile_approval_state: PublicProfileApprovalState; activo: boolean; account_state: string;
};

function toProfessionalProfile(row: ProfessionalProfileRow): ProfessionalProfile {
  const roles = parseProfessionalRoles(row.professional_roles) ?? [];
  return {
    displayName: row.display_name?.trim() || "", avatarUrl: row.profile_image_url || null,
    roles, primaryRole: roles.length ? professionalRoleTitle(roles, row.professional_title ?? "") : null,
    licenseNumber: row.professional_license_number?.trim() || null, organizationName: "Erickson Real Estate · Borikí",
    bio: row.professional_bio?.trim() || null, professionalEmail: row.professional_email?.trim() || null,
    professionalPhoneE164: row.professional_phone_e164?.trim() || null,
    whatsappEnabled: row.professional_phone_whatsapp_enabled, publicProfileEnabled: row.public_profile_enabled,
    approvalState: row.public_profile_approval_state, publicProfileSlug: row.public_profile_slug?.trim() || null,
  };
}

export const getProfessionalProfileForAdminUser = cache(async (adminUserId: string): Promise<ProfessionalProfile | null> => {
  const rows = await sql<ProfessionalProfileRow[]>`
    SELECT display_name, professional_title, professional_roles, professional_license_number, profile_image_url,
           professional_email, professional_phone_e164, professional_phone_whatsapp_enabled, professional_bio,
           public_profile_enabled, public_profile_slug, public_profile_approval_state, activo, account_state
      FROM public.admin_users WHERE id = ${adminUserId}::uuid LIMIT 1
  `;
  return rows[0] ? toProfessionalProfile(rows[0]) : null;
});

export const getPublicEligibleProfessionalProfile = cache(async (adminUserId: string): Promise<ProfessionalProfile | null> => {
  const rows = await sql<ProfessionalProfileRow[]>`
    SELECT display_name, professional_title, professional_roles, professional_license_number, profile_image_url,
           professional_email, professional_phone_e164, professional_phone_whatsapp_enabled, professional_bio,
           public_profile_enabled, public_profile_slug, public_profile_approval_state, activo, account_state
      FROM public.admin_users WHERE id = ${adminUserId}::uuid LIMIT 1
  `;
  const row = rows[0];
  return row && isPublicProfessionalProfileEligible({ activo: row.activo, accountState: row.account_state, publicProfileEnabled: row.public_profile_enabled, approvalState: row.public_profile_approval_state })
    ? toProfessionalProfile(row) : null;
});
