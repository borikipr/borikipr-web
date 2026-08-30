import { randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { Resend } from "resend";
import { sql } from "@/lib/db";
import type { AdminSessionUser } from "@/lib/admin/auth";
import { deleteEligiblePublicMediaObject, extractManagedPublicObjectKey } from "@/lib/r2";
import {
  hashOpaqueValue,
  hashPasswordResetToken,
  normalizeAdminEmail,
  PASSWORD_RESET_TTL_MINUTES,
} from "@/lib/admin/auth-core";
import { normalizeProfessionalBio, normalizeProfessionalEmail, normalizeProfessionalPhone, normalizeProfessionalProfile, type ProfessionalRoleId } from "@/lib/admin/professional-profile";
import { writeAdminAccessEvent } from "@/lib/admin/access-audit";
import type { AccountState, PasswordTokenPurpose, SystemRole } from "@/lib/admin/access-types";

export type AuthAttemptType = "login" | "password_reset_request";

export async function reserveAuthAttempt({
  attemptType,
  identifier,
  limit,
  windowMinutes,
  secret,
}: {
  attemptType: AuthAttemptType;
  identifier: string;
  limit: number;
  windowMinutes: number;
  secret: string;
}) {
  const identifierHash = hashOpaqueValue(identifier, secret);
  return sql.begin(async (transaction) => {
    await transaction.unsafe(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`${attemptType}:${identifierHash}`]
    );
    const recent = await transaction.unsafe<{ count: number }[]>(
      `SELECT count(*)::int AS count
         FROM public.admin_auth_attempts
        WHERE attempt_type = $1
          AND identifier_hash = $2
          AND ($1 = 'password_reset_request' OR succeeded = false)
          AND created_at >= now() - ($3::int * interval '1 minute')`,
      [attemptType, identifierHash, windowMinutes]
    );
    if ((recent[0]?.count || 0) >= limit) return null;

    const inserted = await transaction.unsafe<{ id: string }[]>(
      `INSERT INTO public.admin_auth_attempts (
         identifier_hash, attempt_type, succeeded
       ) VALUES ($1, $2, false)
       RETURNING id::text`,
      [identifierHash, attemptType]
    );
    return inserted[0]?.id || null;
  });
}

export async function completeAuthAttempt(id: string, succeeded: boolean) {
  await sql`
    UPDATE public.admin_auth_attempts
    SET succeeded = ${succeeded}
    WHERE id = ${id}::uuid
  `;
}

export async function updateOwnProfessionalProfile({
  admin,
  displayName,
  professionalRoles,
  professionalCustomTitle,
  professionalLicenseNumber,
  profileImageUrl,
  professionalEmail,
  professionalPhone,
  professionalPhoneWhatsappEnabled,
  professionalBio,
  publicProfileEnabled,
}: {
  admin: AdminSessionUser;
  displayName: string;
  professionalRoles: string;
  professionalCustomTitle: string;
  professionalLicenseNumber: string;
  profileImageUrl: string;
  professionalEmail: string;
  professionalPhone: string;
  professionalPhoneWhatsappEnabled: boolean;
  professionalBio: string;
  publicProfileEnabled: boolean;
}) {
  const cleanName = displayName.trim();
  const professionalProfile = normalizeProfessionalProfile({
    roles: professionalRoles,
    customTitle: professionalCustomTitle,
    licenseNumber: professionalLicenseNumber,
  });
  const cleanProfileImageUrl = profileImageUrl.trim();
  const normalizedProfessionalEmail = normalizeProfessionalEmail(professionalEmail);
  const normalizedProfessionalPhone = normalizeProfessionalPhone(professionalPhone);
  const normalizedProfessionalBio = normalizeProfessionalBio(professionalBio);
  if (!cleanName || cleanName.length > 100) {
    return { ok: false as const, error: "Ingresa un nombre visible válido." };
  }
  if (!professionalProfile.ok) return professionalProfile;
  if (!normalizedProfessionalEmail.ok) return normalizedProfessionalEmail;
  if (!normalizedProfessionalPhone.ok) return normalizedProfessionalPhone;
  if (!normalizedProfessionalBio.ok) return normalizedProfessionalBio;
  if (professionalPhoneWhatsappEnabled && !normalizedProfessionalPhone.value) return { ok: false as const, error: "Añade un teléfono profesional antes de activar WhatsApp." };
  const nextProfessionalPhoneWhatsappEnabled = Boolean(
    professionalPhoneWhatsappEnabled && normalizedProfessionalPhone.value,
  );
  const imageKey = cleanProfileImageUrl ? extractManagedPublicObjectKey(cleanProfileImageUrl) : null;
  if (cleanProfileImageUrl && (!imageKey || !imageKey.startsWith("perfiles/"))) {
    return { ok: false as const, error: "La foto de perfil no es válida." };
  }

  try {
    const result = await sql.begin(async (transaction) => {
      const rows = await transaction.unsafe<{ profile_image_url: string | null; professional_roles: ProfessionalRoleId[]; professional_license_number: string | null; public_profile_approval_state: string }[]>(
        `SELECT profile_image_url, professional_roles, professional_license_number, public_profile_approval_state
           FROM public.admin_users
          WHERE id = $1::uuid AND activo = true AND account_state = 'active'
          FOR UPDATE`,
        [admin.id]
      );
      if (!rows[0]) return { ok: false as const, error: "Tu sesión venció. Vuelve a iniciar sesión." };
      const materialChange = JSON.stringify(rows[0].professional_roles || []) !== JSON.stringify(professionalProfile.roles)
        || (rows[0].professional_license_number?.trim() || "") !== professionalProfile.licenseNumber;
      const invalidatesApproval = materialChange && rows[0].public_profile_approval_state === "approved";
      const nextPublicState = publicProfileEnabled
        ? (invalidatesApproval || rows[0].public_profile_approval_state === "draft" || rows[0].public_profile_approval_state === "disabled" ? "pending_review" : rows[0].public_profile_approval_state)
        : "disabled";
      await transaction.unsafe(
        `UPDATE public.admin_users
            SET display_name = $2,
                professional_title = $3,
                professional_roles = $4::text[],
                professional_license_number = NULLIF($5, ''),
                profile_image_url = NULLIF($6, ''),
                professional_email = $7,
                professional_phone_e164 = $8,
                professional_phone_whatsapp_enabled = $9,
                professional_bio = $10,
                public_profile_enabled = $11,
                public_profile_approval_state = $12,
                public_profile_approved_at = CASE WHEN $12 = 'approved' THEN public_profile_approved_at ELSE NULL END,
                public_profile_approved_by_admin_id = CASE WHEN $12 = 'approved' THEN public_profile_approved_by_admin_id ELSE NULL END
          WHERE id = $1::uuid AND activo = true`,
        [admin.id, cleanName, professionalProfile.displayTitle, professionalProfile.roles, professionalProfile.licenseNumber, cleanProfileImageUrl, normalizedProfessionalEmail.value, normalizedProfessionalPhone.value, nextProfessionalPhoneWhatsappEnabled, normalizedProfessionalBio.value, publicProfileEnabled, nextPublicState]
      );
      if (invalidatesApproval) await writeAdminAccessEvent(transaction, { eventType: "public_profile_review_invalidated", actorAdminUserId: admin.id, targetAdminUserId: admin.id, metadata: { source: "self_profile", previousState: "approved", nextState: "pending_review" } });
      return {
        ok: true as const,
        previousProfileImageUrl: rows[0].profile_image_url,
        pendingReview: nextPublicState === "pending_review",
        professionalPhoneWhatsappEnabled: nextProfessionalPhoneWhatsappEnabled,
      };
    });
    if (!result.ok) return result;

    const previousKey = result.previousProfileImageUrl
      ? extractManagedPublicObjectKey(result.previousProfileImageUrl)
      : null;
    if (previousKey && previousKey.startsWith("perfiles/") && previousKey !== imageKey) {
      try {
        await deleteEligiblePublicMediaObject(previousKey);
      } catch {
        return {
          ok: true as const,
          cleanupWarning: true,
          pendingReview: result.pendingReview,
          professionalPhoneWhatsappEnabled: result.professionalPhoneWhatsappEnabled,
        };
      }
    }
    return {
      ok: true as const,
      cleanupWarning: false,
      pendingReview: result.pendingReview,
      professionalPhoneWhatsappEnabled: result.professionalPhoneWhatsappEnabled,
    };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return { ok: false as const, error: "Ese email ya está asociado a otra cuenta." };
    }
    throw error;
  }
}

export async function updateOwnAdminEmail({
  admin,
  email,
  currentPassword,
}: {
  admin: AdminSessionUser;
  email: string;
  currentPassword: string;
}) {
  const cleanEmail = normalizeAdminEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail) || cleanEmail.length > 254) {
    return { ok: false as const, error: "Ingresa un email válido." };
  }
  return sql.begin(async (transaction) => {
    const rows = await transaction.unsafe<{ password_hash: string }[]>(
      `SELECT password_hash FROM public.admin_users
        WHERE id = $1::uuid AND activo = true AND account_state = 'active'
        FOR UPDATE`,
      [admin.id],
    );
    if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return { ok: false as const, error: "La contraseña actual no es correcta." };
    }
    try {
      await transaction.unsafe(
        `UPDATE public.admin_users SET email = $2 WHERE id = $1::uuid`,
        [admin.id, cleanEmail],
      );
      return { ok: true as const };
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return { ok: false as const, error: "Ese email ya está asociado a otra cuenta." };
      throw error;
    }
  });
}

export async function changeOwnAdminPassword({
  admin,
  currentPassword,
  newPassword,
}: {
  admin: AdminSessionUser;
  currentPassword: string;
  newPassword: string;
}) {
  return sql.begin(async (transaction) => {
    const rows = await transaction.unsafe<
      { password_hash: string; session_version: number }[]
    >(
      `SELECT password_hash, session_version
         FROM public.admin_users
        WHERE id = $1::uuid AND activo = true
        FOR UPDATE`,
      [admin.id]
    );
    const row = rows[0];
    if (!row || !(await bcrypt.compare(currentPassword, row.password_hash))) {
      return { ok: false as const, error: "La contraseña actual no es correcta." };
    }
    if (await bcrypt.compare(newPassword, row.password_hash)) {
      return { ok: false as const, error: "La nueva contraseña debe ser diferente." };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await transaction.unsafe<
      { id: string; username: string; display_name: string | null; email: string | null; professional_title: string | null; professional_roles: ProfessionalRoleId[]; professional_license_number: string | null; profile_image_url: string | null; session_version: number; account_state: AccountState; system_role: SystemRole }[]
    >(
      `UPDATE public.admin_users
          SET password_hash = $2,
              password_changed_at = now(),
              session_version = session_version + 1
        WHERE id = $1::uuid
        RETURNING id::text, username, display_name, email, professional_title, professional_roles, professional_license_number, profile_image_url, session_version, account_state, system_role`,
      [admin.id, passwordHash]
    );
    await transaction.unsafe(
      `UPDATE public.admin_password_reset_tokens
          SET used_at = COALESCE(used_at, now())
        WHERE admin_user_id = $1::uuid AND used_at IS NULL`,
      [admin.id]
    );
    const user = updated[0];
    return {
      ok: true as const,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name?.trim() || user.username,
        email: user.email,
        professionalTitle: user.professional_title?.trim() || null,
        professionalRoles: user.professional_roles || [],
        professionalLicenseNumber: user.professional_license_number?.trim() || null,
        profileImageUrl: user.profile_image_url || null,
        professionalEmail: null,
        professionalPhoneE164: null,
        professionalPhoneWhatsappEnabled: false,
        professionalBio: null,
        publicProfileEnabled: false,
        publicProfileApprovalState: "draft" as const,
        sessionVersion: user.session_version,
        accountState: user.account_state,
        systemRole: user.system_role,
      },
    };
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function requestAdminPasswordReset(email: string) {
  const cleanEmail = normalizeAdminEmail(email);
  const rows = await sql<
    { id: string; email: string; display_name: string | null; username: string }[]
  >`
    SELECT id::text, email, display_name, username
    FROM public.admin_users
    WHERE lower(email) = ${cleanEmail}
      AND activo = true
      AND account_state = 'active'
    LIMIT 1
  `;
  const user = rows[0];
  if (!user) return;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashPasswordResetToken(token);
  const inserted = await sql.begin(async (transaction) => {
    await transaction.unsafe(
      `UPDATE public.admin_password_reset_tokens
          SET used_at = now()
        WHERE admin_user_id = $1::uuid AND used_at IS NULL`,
      [user.id]
    );
    const result = await transaction.unsafe<{ id: string }[]>(
      `INSERT INTO public.admin_password_reset_tokens (
          admin_user_id, token_hash, expires_at, purpose
       ) VALUES ($1::uuid, $2, now() + ($3::int * interval '1 minute'), 'password_reset')
       RETURNING id::text`,
      [user.id, tokenHash, PASSWORD_RESET_TTL_MINUTES]
    );
    return result[0];
  });

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.CONTACT_FROM_EMAIL?.trim();
  if (!apiKey || !fromEmail || !inserted) {
    if (inserted) {
      await sql`UPDATE public.admin_password_reset_tokens SET used_at = now() WHERE id = ${inserted.id}::uuid`;
    }
    return;
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://borikipr.com").replace(/\/$/, "");
  const resetUrl = `${siteUrl}/admin/reset-password?token=${encodeURIComponent(token)}`;
  const displayName = escapeHtml(user.display_name?.trim() || user.username);
  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send(
      {
        from: `Erickson Real Estate <${fromEmail}>`,
        to: [user.email],
        subject: "Restablecer contraseña de Borikí Admin",
        html: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body style="margin:0;background:#f8f8f8;font-family:Arial,sans-serif;color:#0d1b2a"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="background:#0d1b2a;padding:24px;color:#fff"><strong style="color:#d4af37">ERICKSON REAL ESTATE</strong><h1 style="font-size:24px">Restablecer contraseña</h1></div><div style="background:#fff;padding:28px"><p>Hola, ${displayName}.</p><p>Recibimos una solicitud para restablecer tu contraseña de Borikí Admin.</p><p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#11518b;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px">Crear nueva contraseña</a></p><p>Este enlace vence en ${PASSWORD_RESET_TTL_MINUTES} minutos y solo puede usarse una vez.</p><p>Si no solicitaste este cambio, ignora este mensaje.</p></div></div></body></html>`,
      },
      { idempotencyKey: `admin-password-reset:${inserted.id}` }
    );
    if (result.error) throw result.error;
    await sql`UPDATE public.admin_password_reset_tokens SET email_sent_at = now() WHERE id = ${inserted.id}::uuid`;
  } catch (error) {
    await sql`UPDATE public.admin_password_reset_tokens SET used_at = now() WHERE id = ${inserted.id}::uuid`;
    console.error("Admin password reset delivery failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
      statusCode: (error as { statusCode?: number }).statusCode,
    });
  }
}

export async function resetAdminPassword(token: string, newPassword: string) {
  const tokenHash = hashPasswordResetToken(token);
  return sql.begin(async (transaction) => {
    const tokens = await transaction.unsafe<
      { id: string; admin_user_id: string; purpose: PasswordTokenPurpose }[]
    >(
      `SELECT token.id::text, token.admin_user_id::text, token.purpose
         FROM public.admin_password_reset_tokens token
         JOIN public.admin_users admin ON admin.id = token.admin_user_id
        WHERE token.token_hash = $1
          AND token.used_at IS NULL
          AND token.email_sent_at IS NOT NULL
          AND token.expires_at > now()
          AND (
            (token.purpose = 'password_reset' AND admin.activo = true AND admin.account_state = 'active')
            OR (token.purpose = 'account_setup' AND admin.activo = false AND admin.account_state = 'pending_setup')
          )
        FOR UPDATE OF token, admin`,
      [tokenHash]
    );
    const resetToken = tokens[0];
    if (!resetToken) return { ok: false as const };

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await transaction.unsafe<
      { id: string; username: string; display_name: string | null; email: string | null; professional_title: string | null; professional_roles: ProfessionalRoleId[]; professional_license_number: string | null; profile_image_url: string | null; session_version: number; account_state: AccountState; system_role: SystemRole }[]
    >(
      `UPDATE public.admin_users
          SET password_hash = $2,
              password_changed_at = now(),
              session_version = session_version + 1,
              account_state = CASE WHEN $3 = 'account_setup' THEN 'active' ELSE account_state END,
              activo = CASE WHEN $3 = 'account_setup' THEN true ELSE activo END,
              setup_completed_at = CASE WHEN $3 = 'account_setup' THEN now() ELSE setup_completed_at END
        WHERE id = $1::uuid
        RETURNING id::text, username, display_name, email, professional_title, professional_roles, professional_license_number, profile_image_url, session_version, account_state, system_role`,
      [resetToken.admin_user_id, passwordHash, resetToken.purpose]
    );
      await transaction.unsafe(
      `UPDATE public.admin_password_reset_tokens
          SET used_at = now()
        WHERE admin_user_id = $1::uuid AND used_at IS NULL`,
      [resetToken.admin_user_id]
      );
    if (resetToken.purpose === "account_setup") {
      const user = updated[0];
      await transaction.unsafe(
        `INSERT INTO public.admin_access_events (
           event_type, actor_admin_user_id, target_admin_user_id, metadata
         ) VALUES ('account_activated', NULL, $1::uuid, '{"source":"account_setup"}'::jsonb)`,
        [user.id],
      );
    }
    const user = updated[0];
    return {
      ok: true as const,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name?.trim() || user.username,
        email: user.email,
        professionalTitle: user.professional_title?.trim() || null,
        professionalRoles: user.professional_roles || [],
        professionalLicenseNumber: user.professional_license_number?.trim() || null,
        profileImageUrl: user.profile_image_url || null,
        professionalEmail: null,
        professionalPhoneE164: null,
        professionalPhoneWhatsappEnabled: false,
        professionalBio: null,
        publicProfileEnabled: false,
        publicProfileApprovalState: "draft" as const,
        sessionVersion: user.session_version,
        accountState: user.account_state,
        systemRole: user.system_role,
      },
    };
  });
}
