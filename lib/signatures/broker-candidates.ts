import type { SignatureDatabase, SignatureQueryExecutor } from "./domain/types";

/**
 * The current signing setting is deliberately only a compatibility-backed
 * candidate source. A document receives a participant snapshot when it is
 * created, so a later setting change cannot rewrite that document.
 *
 * Team & Access can replace this resolver with a bounded set of authorized
 * broker accounts later without changing the draft workflow contract.
 */
export type SignatureBrokerCandidate = Readonly<{
  id: string;
  name: string;
  email: string;
}>;

type CandidateDatabase = Pick<SignatureDatabase, "unsafe"> | SignatureQueryExecutor;

export async function listSignatureBrokerCandidates(
  database: CandidateDatabase,
): Promise<readonly SignatureBrokerCandidate[]> {
  const rows = await database.unsafe<{
    id: string;
    name: string;
    email: string;
  }>(
    `SELECT settings.broker_admin_user_id::text AS id,
            coalesce(nullif(btrim(admin.display_name),''), admin.username) AS name,
            lower(admin.email) AS email
       FROM signature_signing_settings settings
       JOIN admin_users admin ON admin.id=settings.broker_admin_user_id
      WHERE settings.singleton=true
        AND admin.activo=true
        AND admin.account_state='active'
        AND admin.email IS NOT NULL
      LIMIT 2`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email.toLowerCase(),
  }));
}

export async function resolveSignatureBrokerCandidate(
  database: CandidateDatabase,
  requestedCandidateId?: string | null,
): Promise<SignatureBrokerCandidate | null> {
  const candidates = await listSignatureBrokerCandidates(database);
  if (candidates.length === 0) return null;

  const requested = requestedCandidateId?.trim();
  if (!requested) return candidates.length === 1 ? candidates[0] : null;
  return candidates.find((candidate) => candidate.id === requested) ?? null;
}
