import { sql } from "@/lib/db";

export const RESET_TOKEN_RETENTION_DAYS = 7;
export const AUTH_ATTEMPT_RETENTION_DAYS = 90;
export const PUBLIC_RATE_LIMIT_RETENTION_DAYS = 1;

export type AdminAuthCleanupResult = {
  expiredResetTokensDeleted: number;
  usedResetTokensDeleted: number;
  oldAuthAttemptsDeleted: number;
  expiredPublicRateLimitBucketsDeleted: number;
};

type CountRow = { count: number };

type MaintenanceTransaction = {
  unsafe<T extends readonly Record<string, unknown>[]>(
    query: string,
    parameters?: readonly unknown[]
  ): Promise<T>;
};

export type AuthMaintenanceDatabase = {
  begin<T>(
    callback: (transaction: MaintenanceTransaction) => Promise<T>
  ): Promise<T>;
};

async function deleteAndCount(
  transaction: MaintenanceTransaction,
  query: string,
  retentionDays: number
) {
  const rows = await transaction.unsafe<CountRow[]>(query, [retentionDays]);
  return Number(rows[0]?.count ?? 0);
}

export async function cleanupAdminAuthenticationRecords(
  database: AuthMaintenanceDatabase = sql as unknown as AuthMaintenanceDatabase
): Promise<AdminAuthCleanupResult> {
  return database.begin(async (transaction) => {
    const expiredResetTokensDeleted = await deleteAndCount(
      transaction,
      `WITH deleted AS (
         DELETE FROM public.admin_password_reset_tokens
          WHERE used_at IS NULL
            AND expires_at < now() - ($1::int * interval '1 day')
         RETURNING 1
       )
       SELECT count(*)::int AS count FROM deleted`,
      RESET_TOKEN_RETENTION_DAYS
    );

    const usedResetTokensDeleted = await deleteAndCount(
      transaction,
      `WITH deleted AS (
         DELETE FROM public.admin_password_reset_tokens
          WHERE used_at < now() - ($1::int * interval '1 day')
         RETURNING 1
       )
       SELECT count(*)::int AS count FROM deleted`,
      RESET_TOKEN_RETENTION_DAYS
    );

    const oldAuthAttemptsDeleted = await deleteAndCount(
      transaction,
      `WITH deleted AS (
         DELETE FROM public.admin_auth_attempts
          WHERE created_at < now() - ($1::int * interval '1 day')
         RETURNING 1
       )
       SELECT count(*)::int AS count FROM deleted`,
      AUTH_ATTEMPT_RETENTION_DAYS
    );

    const expiredPublicRateLimitBucketsDeleted = await deleteAndCount(
      transaction,
      `WITH deleted AS (
         DELETE FROM public.public_rate_limit_buckets
          WHERE expires_at < now() - ($1::int * interval '1 day')
         RETURNING 1
       )
       SELECT count(*)::int AS count FROM deleted`,
      PUBLIC_RATE_LIMIT_RETENTION_DAYS
    );

    return {
      expiredResetTokensDeleted,
      usedResetTokensDeleted,
      oldAuthAttemptsDeleted,
      expiredPublicRateLimitBucketsDeleted,
    };
  });
}
