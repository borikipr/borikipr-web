import "server-only";

import { randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { Resend } from "resend";
import { sql } from "@/lib/db";
import { hashPasswordResetToken, normalizeAdminEmail, PASSWORD_RESET_TTL_MINUTES } from "@/lib/admin/auth-core";
import { writeAdminAccessEvent } from "@/lib/admin/access-audit";
import { normalizeProfessionalProfile } from "@/lib/admin/professional-profile";
import type { AccessLevel, ModuleKey, SystemRole } from "@/lib/admin/access-types";

export const INITIAL_SUPER_ADMIN_ID = "3cefce78-7d62-485d-9faa-6fed1b6ae377";
export const INITIAL_ADMIN_ID = "837a7fca-c067-4878-a4eb-01c12a4cf7ba";

type TeamDatabase = typeof sql;

type TargetAccount = {
  id: string;
  email: string | null;
  display_name: string | null;
  username: string;
  system_role: SystemRole;
  account_state: "pending_setup" | "active" | "disabled";
  activo: boolean;
};

type TeamManagedRole = "admin" | "member";

export type CreateTeamMemberInput = Readonly<{
  displayName: string;
  email: string;
  username: string;
  professionalRoles: string;
  professionalCustomTitle: string;
  professionalLicenseNumber: string;
  systemRole: TeamManagedRole;
}>;

function cleanUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,59}$/.test(username)) return null;
  return username;
}

function assertDifferentActor(actorAdminId: string, targetAdminId: string) {
  if (actorAdminId === targetAdminId) throw new Error("admin_access_self_mutation_forbidden");
}

async function lockAuthorityMutation(database: TeamDatabase) {
  await database.unsafe("SELECT pg_advisory_xact_lock(hashtextextended('boriki-team-access-authority', 0))");
}

async function assertActorIsSuperAdmin(database: TeamDatabase, actorAdminId: string) {
  const rows = await database.unsafe<{ id: string }[]>(
    `SELECT id::text FROM public.admin_users
      WHERE id = $1::uuid AND activo = true AND account_state = 'active'
        AND system_role = 'super_admin'
      FOR UPDATE`,
    [actorAdminId],
  );
  if (!rows[0]) throw new Error("admin_access_super_admin_required");
}

async function assertTargetCanLoseSuperAdmin(
  database: TeamDatabase,
  target: TargetAccount,
) {
  if (target.system_role !== "super_admin" || target.account_state !== "active" || !target.activo) return;
  const rows = await database.unsafe<{ count: number }[]>(
    `SELECT count(*)::int AS count
       FROM public.admin_users
      WHERE activo = true AND account_state = 'active' AND system_role = 'super_admin'`,
  );
  if ((rows[0]?.count ?? 0) <= 1) throw new Error("admin_access_last_super_admin_forbidden");
}

async function loadTargetForUpdate(database: TeamDatabase, targetAdminId: string) {
  const rows = await database.unsafe<TargetAccount[]>(
    `SELECT id::text, email, display_name, username, system_role, account_state, activo
       FROM public.admin_users
      WHERE id = $1::uuid
      FOR UPDATE`,
    [targetAdminId],
  );
  if (!rows[0]) throw new Error("admin_access_target_not_found");
  return rows[0];
}

export async function bootstrapInitialTeamAccess(
  database: TeamDatabase = sql,
) {
  return database.begin(async (transaction) => {
    const tx = transaction as unknown as TeamDatabase;
    await lockAuthorityMutation(tx);
    if (new Set([INITIAL_SUPER_ADMIN_ID, INITIAL_ADMIN_ID]).size !== 2) {
      throw new Error("admin_access_bootstrap_ids_invalid");
    }
    const rows = await tx.unsafe<TargetAccount[]>(
      `SELECT id::text, email, display_name, username, system_role, account_state, activo
         FROM public.admin_users
        WHERE id IN ($1::uuid, $2::uuid)
        FOR UPDATE`,
      [INITIAL_SUPER_ADMIN_ID, INITIAL_ADMIN_ID],
    );
    if (rows.length !== 2 || rows.some((row) => !row.activo || row.account_state !== "active")) {
      throw new Error("admin_access_bootstrap_accounts_invalid");
    }
    const currentRoles = new Map(rows.map((row) => [row.id, row.system_role]));
    if (
      currentRoles.get(INITIAL_SUPER_ADMIN_ID) === "super_admin" &&
      currentRoles.get(INITIAL_ADMIN_ID) === "admin"
    ) {
      return;
    }
    await tx.unsafe(
      `UPDATE public.admin_users
          SET system_role = CASE
            WHEN id = $1::uuid THEN 'super_admin'
            WHEN id = $2::uuid THEN 'admin'
            ELSE system_role
          END
        WHERE id IN ($1::uuid, $2::uuid)`,
      [INITIAL_SUPER_ADMIN_ID, INITIAL_ADMIN_ID],
    );
    await writeAdminAccessEvent(tx, {
      eventType: "system_role_changed",
      actorAdminUserId: null,
      targetAdminUserId: INITIAL_SUPER_ADMIN_ID,
      metadata: { source: "phase_11_5_bootstrap", after: "super_admin" },
    });
    await writeAdminAccessEvent(tx, {
      eventType: "system_role_changed",
      actorAdminUserId: null,
      targetAdminUserId: INITIAL_ADMIN_ID,
      metadata: { source: "phase_11_5_bootstrap", after: "admin" },
    });
  });
}

export async function disableAdminAccount(
  actorAdminId: string,
  targetAdminId: string,
  database: TeamDatabase = sql,
) {
  assertDifferentActor(actorAdminId, targetAdminId);
  return database.begin(async (transaction) => {
    const tx = transaction as unknown as TeamDatabase;
    await lockAuthorityMutation(tx);
    await assertActorIsSuperAdmin(tx, actorAdminId);
    const target = await loadTargetForUpdate(tx, targetAdminId);
    if (target.account_state === "disabled") throw new Error("admin_access_already_disabled");
    await assertTargetCanLoseSuperAdmin(tx, target);
    await tx.unsafe(
      `UPDATE public.admin_users
          SET account_state = 'disabled', activo = false, disabled_at = now(),
              disabled_by_admin_id = $2::uuid, session_version = session_version + 1
        WHERE id = $1::uuid`,
      [targetAdminId, actorAdminId],
    );
    await tx.unsafe(
      `UPDATE public.admin_password_reset_tokens
          SET used_at = COALESCE(used_at, now())
        WHERE admin_user_id = $1::uuid AND used_at IS NULL`,
      [targetAdminId],
    );
    await writeAdminAccessEvent(tx, {
      eventType: "account_disabled",
      actorAdminUserId: actorAdminId,
      targetAdminUserId: targetAdminId,
      metadata: { source: "team_access" },
    });
  });
}

export async function changeAdminSystemRole(
  actorAdminId: string,
  targetAdminId: string,
  nextRole: SystemRole,
  database: TeamDatabase = sql,
) {
  assertDifferentActor(actorAdminId, targetAdminId);
  return database.begin(async (transaction) => {
    const tx = transaction as unknown as TeamDatabase;
    await lockAuthorityMutation(tx);
    await assertActorIsSuperAdmin(tx, actorAdminId);
    const target = await loadTargetForUpdate(tx, targetAdminId);
    if (target.system_role === nextRole) return;
    if (nextRole !== "super_admin") await assertTargetCanLoseSuperAdmin(tx, target);
    await tx.unsafe(`UPDATE public.admin_users SET system_role = $2 WHERE id = $1::uuid`, [targetAdminId, nextRole]);
    await writeAdminAccessEvent(tx, {
      eventType: "system_role_changed",
      actorAdminUserId: actorAdminId,
      targetAdminUserId: targetAdminId,
      metadata: { before: target.system_role, after: nextRole },
    });
  });
}

export async function setAdminModuleAccess(
  actorAdminId: string,
  targetAdminId: string,
  moduleKey: ModuleKey,
  accessLevel: AccessLevel | null,
  database: TeamDatabase = sql,
) {
  assertDifferentActor(actorAdminId, targetAdminId);
  return database.begin(async (transaction) => {
    const tx = transaction as unknown as TeamDatabase;
    await assertActorIsSuperAdmin(tx, actorAdminId);
    await loadTargetForUpdate(tx, targetAdminId);
    if (accessLevel) {
      await tx.unsafe(
        `INSERT INTO public.admin_module_access (admin_user_id, module_key, access_level, granted_by_admin_user_id)
         VALUES ($1::uuid, $2, $3, $4::uuid)
         ON CONFLICT (admin_user_id, module_key)
         DO UPDATE SET access_level = EXCLUDED.access_level, granted_by_admin_user_id = EXCLUDED.granted_by_admin_user_id, updated_at = now()`,
        [targetAdminId, moduleKey, accessLevel, actorAdminId],
      );
      await writeAdminAccessEvent(tx, { eventType: "module_access_granted", actorAdminUserId: actorAdminId, targetAdminUserId: targetAdminId, metadata: { module: moduleKey, level: accessLevel } });
    } else {
      const removed = await tx.unsafe<{ admin_user_id: string }[]>(
        `DELETE FROM public.admin_module_access WHERE admin_user_id = $1::uuid AND module_key = $2 RETURNING admin_user_id::text`,
        [targetAdminId, moduleKey],
      );
      if (removed[0]) await writeAdminAccessEvent(tx, { eventType: "module_access_revoked", actorAdminUserId: actorAdminId, targetAdminUserId: targetAdminId, metadata: { module: moduleKey } });
    }
  });
}

export async function reactivateAdminAccount(
  actorAdminId: string,
  targetAdminId: string,
  database: TeamDatabase = sql,
) {
  assertDifferentActor(actorAdminId, targetAdminId);
  const target = await database.begin(async (transaction) => {
    const tx = transaction as unknown as TeamDatabase;
    await lockAuthorityMutation(tx);
    await assertActorIsSuperAdmin(tx, actorAdminId);
    const account = await loadTargetForUpdate(tx, targetAdminId);
    if (account.account_state !== "disabled") throw new Error("admin_access_reactivation_state_invalid");
    if (!account.email) throw new Error("admin_access_setup_email_missing");
    await tx.unsafe(
      `UPDATE public.admin_users
          SET account_state = 'pending_setup', activo = false, disabled_at = NULL,
              disabled_by_admin_id = NULL, session_version = session_version + 1
        WHERE id = $1::uuid`,
      [targetAdminId],
    );
    await tx.unsafe(
      `UPDATE public.admin_password_reset_tokens SET used_at = COALESCE(used_at, now())
        WHERE admin_user_id = $1::uuid AND used_at IS NULL`,
      [targetAdminId],
    );
    await writeAdminAccessEvent(tx, { eventType: "account_reactivated", actorAdminUserId: actorAdminId, targetAdminUserId: targetAdminId, metadata: { next_state: "pending_setup" } });
    return account;
  });
  try {
    await issueAccountSetupToken(actorAdminId, target, database);
    return { invitationSent: true as const };
  } catch (error) {
    if (error instanceof Error && /^admin_access_setup_delivery_/.test(error.message)) {
      return { invitationSent: false as const };
    }
    throw error;
  }
}

export async function createTeamMember(
  actorAdminId: string,
  input: CreateTeamMemberInput,
  database: TeamDatabase = sql,
) {
  const displayName = input.displayName.trim();
  const email = normalizeAdminEmail(input.email);
  const username = cleanUsername(input.username);
  const professionalProfile = normalizeProfessionalProfile({
    roles: input.professionalRoles,
    customTitle: input.professionalCustomTitle,
    licenseNumber: input.professionalLicenseNumber,
  });
  if (!displayName || displayName.length > 100) return { ok: false as const, error: "Ingresa un nombre visible válido." };
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return { ok: false as const, error: "Ingresa un email válido." };
  if (!username) return { ok: false as const, error: "Usa un usuario de 3 a 60 caracteres: letras, números, punto, guion o guion bajo." };
  if (!professionalProfile.ok) return professionalProfile;
  if (input.systemRole !== "admin" && input.systemRole !== "member") return { ok: false as const, error: "Selecciona un acceso del sistema válido." };

  try {
    const target = await database.begin(async (transaction) => {
      const tx = transaction as unknown as TeamDatabase;
      await lockAuthorityMutation(tx);
      await assertActorIsSuperAdmin(tx, actorAdminId);
      const placeholderPasswordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
      const inserted = await tx.unsafe<TargetAccount[]>(
        `INSERT INTO public.admin_users (
           username, password_hash, display_name, email, professional_title,
           professional_roles, professional_license_number, system_role, account_state, activo
         ) VALUES ($1, $2, $3, $4, $5, $6::text[], NULLIF($7, ''), $8, 'pending_setup', false)
         RETURNING id::text, email, display_name, username, system_role, account_state, activo`,
        [username, placeholderPasswordHash, displayName, email, professionalProfile.displayTitle, professionalProfile.roles, professionalProfile.licenseNumber, input.systemRole],
      );
      const created = inserted[0];
      if (!created) throw new Error("admin_access_member_create_failed");
      await writeAdminAccessEvent(tx, {
        eventType: "user_created", actorAdminUserId: actorAdminId, targetAdminUserId: created.id,
        metadata: { system_role: input.systemRole, source: "team_management" },
      });
      return created;
    });
    try {
      await issueAccountSetupToken(actorAdminId, target, database, true);
      return { ok: true as const, id: target.id, invitationSent: true };
    } catch (error) {
      if (error instanceof Error && /^admin_access_setup_delivery_/.test(error.message)) {
        return { ok: true as const, id: target.id, invitationSent: false };
      }
      throw error;
    }
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return { ok: false as const, error: "El email o usuario ya está asociado a una cuenta interna." };
    }
    throw error;
  }
}

export async function resendTeamSetupInvitation(
  actorAdminId: string,
  targetAdminId: string,
  database: TeamDatabase = sql,
) {
  assertDifferentActor(actorAdminId, targetAdminId);
  const target = await database.begin(async (transaction) => {
    const tx = transaction as unknown as TeamDatabase;
    await lockAuthorityMutation(tx);
    await assertActorIsSuperAdmin(tx, actorAdminId);
    const account = await loadTargetForUpdate(tx, targetAdminId);
    if (account.account_state !== "pending_setup" || account.activo) throw new Error("admin_access_setup_resend_state_invalid");
    if (!account.email) throw new Error("admin_access_setup_email_missing");
    return account;
  });
  return issueAccountSetupToken(actorAdminId, target, database, true);
}

export async function updateTeamManagedProfessionalProfile(
  actorAdminId: string,
  targetAdminId: string,
  input: Pick<CreateTeamMemberInput, "displayName" | "professionalRoles" | "professionalCustomTitle" | "professionalLicenseNumber">,
  database: TeamDatabase = sql,
) {
  assertDifferentActor(actorAdminId, targetAdminId);
  const displayName = input.displayName.trim();
  const professionalProfile = normalizeProfessionalProfile({ roles: input.professionalRoles, customTitle: input.professionalCustomTitle, licenseNumber: input.professionalLicenseNumber });
  if (!displayName || displayName.length > 100) return { ok: false as const, error: "Ingresa un nombre visible válido." };
  if (!professionalProfile.ok) return professionalProfile;
  await database.begin(async (transaction) => {
    const tx = transaction as unknown as TeamDatabase;
    await assertActorIsSuperAdmin(tx, actorAdminId);
    const target = await loadTargetForUpdate(tx, targetAdminId);
    if (target.system_role === "super_admin") throw new Error("admin_access_team_super_admin_mutation_forbidden");
    await tx.unsafe(
      `UPDATE public.admin_users SET display_name = $2, professional_title = $3,
          professional_roles = $4::text[], professional_license_number = NULLIF($5, '')
        WHERE id = $1::uuid`,
      [targetAdminId, displayName, professionalProfile.displayTitle, professionalProfile.roles, professionalProfile.licenseNumber],
    );
  });
  return { ok: true as const };
}

export async function changeTeamManagedSystemRole(
  actorAdminId: string,
  targetAdminId: string,
  nextRole: TeamManagedRole,
  database: TeamDatabase = sql,
) {
  assertDifferentActor(actorAdminId, targetAdminId);
  if (nextRole !== "admin" && nextRole !== "member") throw new Error("admin_access_team_role_invalid");
  return database.begin(async (transaction) => {
    const tx = transaction as unknown as TeamDatabase;
    await lockAuthorityMutation(tx);
    await assertActorIsSuperAdmin(tx, actorAdminId);
    const target = await loadTargetForUpdate(tx, targetAdminId);
    if (target.account_state === "disabled") throw new Error("admin_access_team_role_state_invalid");
    if (target.system_role === nextRole) return;
    if (target.system_role === "super_admin") throw new Error("admin_access_team_super_admin_mutation_forbidden");
    await tx.unsafe(`UPDATE public.admin_users SET system_role = $2 WHERE id = $1::uuid`, [targetAdminId, nextRole]);
    await writeAdminAccessEvent(tx, { eventType: "system_role_changed", actorAdminUserId: actorAdminId, targetAdminUserId: targetAdminId, metadata: { before: target.system_role, after: nextRole } });
  });
}

async function issueAccountSetupToken(
  actorAdminId: string,
  target: TargetAccount,
  database: TeamDatabase,
  revokeExisting = false,
) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashPasswordResetToken(token);
  const tokenRow = await database.begin(async (transaction) => {
    const tx = transaction as unknown as TeamDatabase;
    if (revokeExisting) {
      await lockAuthorityMutation(tx);
      const recent = await tx.unsafe<{ count: number }[]>(
        `SELECT count(*)::int AS count FROM public.admin_password_reset_tokens
          WHERE admin_user_id = $1::uuid AND purpose = 'account_setup'
            AND created_at > now() - interval '1 minute'`,
        [target.id],
      );
      if ((recent[0]?.count ?? 0) > 0) throw new Error("admin_access_setup_resend_rate_limited");
      await tx.unsafe(`UPDATE public.admin_password_reset_tokens SET used_at = COALESCE(used_at, now()) WHERE admin_user_id = $1::uuid AND used_at IS NULL`, [target.id]);
    }
    const inserted = await tx.unsafe<{ id: string }[]>(
      `INSERT INTO public.admin_password_reset_tokens (admin_user_id, token_hash, expires_at, purpose)
       VALUES ($1::uuid, $2, now() + ($3::int * interval '1 minute'), 'account_setup')
       RETURNING id::text`,
      [target.id, tokenHash, PASSWORD_RESET_TTL_MINUTES],
    );
    return inserted[0];
  });
  if (!tokenRow || !target.email) throw new Error("admin_access_setup_token_create_failed");

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.CONTACT_FROM_EMAIL?.trim();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://borikipr.com").replace(/\/$/, "");
  if (!apiKey || !fromEmail) {
    await database.unsafe(`UPDATE public.admin_password_reset_tokens SET used_at = now() WHERE id = $1::uuid`, [tokenRow.id]);
    throw new Error("admin_access_setup_delivery_unavailable");
  }
  try {
    const resetUrl = `${siteUrl}/admin/reset-password?token=${encodeURIComponent(token)}`;
    const name = (target.display_name?.trim() || target.username).replace(/[<>&"']/g, "");
    const result = await new Resend(apiKey).emails.send({
      from: `Erickson Real Estate <${fromEmail}>`, to: [target.email],
      subject: "Configura tu cuenta de Borikí Admin",
      html: `<p>Hola, ${name}.</p><p>Configura tu contraseña para acceder a Borikí Admin.</p><p><a href="${resetUrl}">Configurar contraseña</a></p><p>Este enlace vence en ${PASSWORD_RESET_TTL_MINUTES} minutos y solo puede usarse una vez.</p>`,
    }, { idempotencyKey: `admin-account-setup:${tokenRow.id}` });
    if (result.error) throw result.error;
    await database.begin(async (transaction) => {
      const tx = transaction as unknown as TeamDatabase;
      await tx.unsafe(`UPDATE public.admin_password_reset_tokens SET email_sent_at = now() WHERE id = $1::uuid`, [tokenRow.id]);
      await writeAdminAccessEvent(tx, { eventType: "setup_issued", actorAdminUserId: actorAdminId, targetAdminUserId: target.id, metadata: { purpose: "account_setup" } });
    });
    return { ok: true as const };
  } catch {
    await database.unsafe(`UPDATE public.admin_password_reset_tokens SET used_at = now() WHERE id = $1::uuid`, [tokenRow.id]);
    throw new Error("admin_access_setup_delivery_failed");
  }
}
