import type { SignatureDatabase, SignatureQueryExecutor } from "./domain/types";

/**
 * Team & Access is the canonical source of future broker candidates. A
 * document receives a participant snapshot when it is created, so a later
 * Team change cannot rewrite that document.
 */
export type SignatureBrokerCandidate = Readonly<{
  id: string;
  name: string;
  email: string;
  licenseNumber: string;
}>;

type CandidateDatabase = Pick<SignatureDatabase, "unsafe"> | SignatureQueryExecutor;

export async function listSignatureBrokerCandidates(
  database: CandidateDatabase,
  actorAdminId?: string,
): Promise<readonly SignatureBrokerCandidate[]> {
  const actorRows = actorAdminId ? await database.unsafe<{
    system_role: "super_admin" | "admin" | "member";
    assigned_broker_user_id: string | null;
  }>(`SELECT system_role, assigned_broker_user_id::text FROM admin_users WHERE id=$1::uuid AND activo=true AND account_state='active'`, [actorAdminId]) : [];
  const actor = actorRows[0];
  if (actorAdminId && !actor) return [];
  const rows = await database.unsafe<{
    id: string;
    name: string;
    email: string;
    license_number: string;
  }>(
    `SELECT admin.id::text AS id,
            coalesce(nullif(btrim(admin.display_name),''), admin.username) AS name,
            lower(admin.email) AS email
            , btrim(admin.professional_license_number) AS license_number
       FROM admin_users admin
       LEFT JOIN admin_module_access signing_access
         ON signing_access.admin_user_id=admin.id AND signing_access.module_key='signatures'
      WHERE admin.activo=true
        AND admin.account_state='active'
        AND admin.email IS NOT NULL
        AND admin.signing_broker_authorized_at IS NOT NULL
        AND 'real_estate_broker'=ANY(admin.professional_roles)
        AND nullif(btrim(admin.professional_license_number),'') IS NOT NULL
        AND (admin.system_role IN ('super_admin','admin') OR signing_access.access_level='manage')
      ORDER BY lower(coalesce(nullif(btrim(admin.display_name),''),admin.username)),admin.id`,
  );
  const candidates = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email.toLowerCase(),
    licenseNumber: row.license_number ?? (row as unknown as { licenseNumber?: string }).licenseNumber ?? "",
  }));
  if (!actor || actor.system_role !== "member") return candidates;
  const self = candidates.find((candidate) => candidate.id === actorAdminId);
  if (self) return [self];
  const assigned = candidates.find((candidate) => candidate.id === actor.assigned_broker_user_id);
  return assigned ? [assigned] : [];
}

/**
 * Send-time verification checks the persisted participant snapshot instead
 * of resolving another broker. It blocks an ineligible prepared draft
 * without silently replacing its final signer.
 */
export async function isPersistedBrokerParticipantEligible(
  database: CandidateDatabase,
  email: string,
): Promise<boolean> {
  const rows = await database.unsafe<{ id: string }>(
    `SELECT admin.id::text
       FROM admin_users admin
       LEFT JOIN admin_module_access signing_access
         ON signing_access.admin_user_id = admin.id
        AND signing_access.module_key = 'signatures'
      WHERE admin.activo = true
        AND admin.account_state = 'active'
        AND admin.email IS NOT NULL
        AND lower(admin.email) = lower($1)
        AND admin.signing_broker_authorized_at IS NOT NULL
        AND 'real_estate_broker' = ANY(admin.professional_roles)
        AND nullif(btrim(admin.professional_license_number), '') IS NOT NULL
        AND (admin.system_role IN ('super_admin', 'admin') OR signing_access.access_level = 'manage')
      LIMIT 1`,
    [email],
  );
  return Boolean(rows[0]);
}

export async function resolveSignatureBrokerCandidate(
  database: CandidateDatabase,
  requestedCandidateId?: string | null,
  actorAdminId?: string,
): Promise<SignatureBrokerCandidate | null> {
  const candidates = await listSignatureBrokerCandidates(database, actorAdminId);
  if (candidates.length === 0) return null;

  const requested = requestedCandidateId?.trim();
  if (!requested) return candidates.length === 1 ? candidates[0] : null;
  return candidates.find((candidate) => candidate.id === requested) ?? null;
}
