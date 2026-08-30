import { cookies } from "next/headers";
import * as bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
  parseAdminSessionValue,
  signAdminSessionPayload,
  verifyLegacyAdminSession,
} from "@/lib/admin/auth-core";
import { parseProfessionalRoles, type ProfessionalRoleId, type PublicProfileApprovalState } from "@/lib/admin/professional-profile";
import type { AccountState, SystemRole } from "@/lib/admin/access-types";

export const SESSION_COOKIE = "boriki_admin_session";

export type AdminSessionUser = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  professionalTitle: string | null;
  professionalRoles: ProfessionalRoleId[];
  professionalLicenseNumber: string | null;
  profileImageUrl: string | null;
  professionalEmail: string | null;
  professionalPhoneE164: string | null;
  professionalPhoneWhatsappEnabled: boolean;
  professionalBio: string | null;
  publicProfileEnabled: boolean;
  publicProfileApprovalState: PublicProfileApprovalState;
  sessionVersion: number;
  accountState: AccountState;
  systemRole: SystemRole;
};

type AdminUserRow = {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  professional_title: string | null;
  professional_roles: unknown;
  professional_license_number: string | null;
  profile_image_url: string | null;
  professional_email: string | null;
  professional_phone_e164: string | null;
  professional_phone_whatsapp_enabled: boolean;
  professional_bio: string | null;
  public_profile_enabled: boolean;
  public_profile_approval_state: PublicProfileApprovalState;
  password_hash: string;
  activo: boolean;
  account_state: AccountState;
  system_role: SystemRole;
  session_version: number;
  password_changed_at: Date | null;
};

const DUMMY_PASSWORD_HASH =
  "$2b$12$Ohn0e/3Mn/EF7LNXKXCgMOB8vmZjiUzIv/kCrgIJXF0s3C39YTHEK";

export function getSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) throw new Error("SESSION_SECRET no está configurado.");
  return secret;
}

function toSessionUser(row: AdminUserRow): AdminSessionUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name?.trim() || row.username,
    email: row.email,
    professionalTitle: row.professional_title?.trim() || null,
    professionalRoles: parseProfessionalRoles(row.professional_roles) ?? [],
    professionalLicenseNumber: row.professional_license_number?.trim() || null,
    profileImageUrl: row.profile_image_url || null,
    professionalEmail: row.professional_email?.trim() || null,
    professionalPhoneE164: row.professional_phone_e164?.trim() || null,
    professionalPhoneWhatsappEnabled: row.professional_phone_whatsapp_enabled,
    professionalBio: row.professional_bio?.trim() || null,
    publicProfileEnabled: row.public_profile_enabled,
    publicProfileApprovalState: row.public_profile_approval_state,
    sessionVersion: row.session_version,
    accountState: row.account_state,
    systemRole: row.system_role,
  };
}

async function findActiveAdminByUsername(username: string) {
  const rows = await sql<AdminUserRow[]>`
    SELECT id::text, username, display_name, email, professional_title, professional_roles, professional_license_number, profile_image_url, professional_email, professional_phone_e164, professional_phone_whatsapp_enabled, professional_bio, public_profile_enabled, public_profile_approval_state, password_hash, activo,
           account_state, system_role, session_version, password_changed_at
    FROM public.admin_users
    WHERE username = ${username}
      AND activo = true
      AND account_state = 'active'
    LIMIT 1
  `;
  return rows[0] || null;
}

async function findActiveAdminById(id: string) {
  const rows = await sql<AdminUserRow[]>`
    SELECT id::text, username, display_name, email, professional_title, professional_roles, professional_license_number, profile_image_url, professional_email, professional_phone_e164, professional_phone_whatsapp_enabled, professional_bio, public_profile_enabled, public_profile_approval_state, password_hash, activo,
           account_state, system_role, session_version, password_changed_at
    FROM public.admin_users
    WHERE id = ${id}::uuid
      AND activo = true
      AND account_state = 'active'
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function authenticateAdmin(username: string, password: string) {
  const cleanUsername = username.trim();
  const row = cleanUsername
    ? await findActiveAdminByUsername(cleanUsername)
    : null;
  const matches = await bcrypt.compare(
    password,
    row?.password_hash || DUMMY_PASSWORD_HASH
  );
  if (!row || !matches) return null;

  await sql`
    UPDATE public.admin_users
    SET last_login_at = now()
    WHERE id = ${row.id}::uuid
  `;
  return toSessionUser(row);
}

export async function verifyAdminSessionValue(
  sessionValue: string | undefined | null
) {
  const secret = getSessionSecret();
  const payload = parseAdminSessionValue(sessionValue, secret);

  if (payload) {
    const row = await findActiveAdminById(payload.adminId);
    if (
      !row ||
      row.username !== payload.username ||
      row.session_version !== payload.sessionVersion
    ) {
      return null;
    }
    return toSessionUser(row);
  }

  // Existing signed cookies remain valid during this deployment. Every newly
  // created session uses the versioned v2 format, so the compatibility path
  // naturally disappears after the previous eight-hour cookie window.
  const legacyUsername = verifyLegacyAdminSession(sessionValue, secret);
  if (!legacyUsername) return null;
  const row = await findActiveAdminByUsername(legacyUsername);
  return row && !row.password_changed_at ? toSessionUser(row) : null;
}

export async function createAdminSession(user: AdminSessionUser) {
  const cookieStore = await cookies();
  const expiresAt =
    Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS;
  const value = signAdminSessionPayload(
    {
      adminId: user.id,
      username: user.username,
      sessionVersion: user.sessionVersion,
      expiresAt,
    },
    getSessionSecret()
  );

  cookieStore.set({
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    priority: "high",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    priority: "high",
  });
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return verifyAdminSessionValue(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function getAdminSessionUser() {
  return (await getAdminSession())?.username || null;
}
