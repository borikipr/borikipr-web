import type postgres from "postgres";
import {
  createLeadResolver,
  type LeadIdentityStatus,
  type LeadRecord,
  type LeadResolverStore,
  type LeadResolverTransaction,
  type LeadStatus,
  type NewLeadRecord,
} from "./resolver";

type LeadRow = {
  id: string;
  name: string;
  email_original: string | null;
  email_normalized: string | null;
  phone_original: string | null;
  phone_normalized: string | null;
  status: LeadStatus;
  identity_status: LeadIdentityStatus;
  first_seen_at: Date;
  last_activity_at: Date;
  created_at: Date;
  updated_at: Date;
  merged_into_lead_id: string | null;
};

export function createPostgresLeadResolver(sql: postgres.Sql) {
  const store: LeadResolverStore = {
    async withTransaction<T>(callback: (
      transaction: LeadResolverTransaction
    ) => Promise<T>) {
      const result = await sql.begin((transaction) =>
        callback(createTransaction(transaction))
      );
      return result as T;
    },
  };

  return createLeadResolver(store);
}

export function createPostgresLeadResolverInTransaction(
  transaction: postgres.TransactionSql
) {
  const store: LeadResolverStore = {
    async withTransaction<T>(callback: (
      leadTransaction: LeadResolverTransaction
    ) => Promise<T>) {
      return callback(createTransaction(transaction));
    },
  };

  return createLeadResolver(store);
}

function createTransaction(
  transaction: postgres.TransactionSql
): LeadResolverTransaction {
  return {
    async lockIdentityKeys(keys) {
      for (const key of [...new Set(keys)].sort()) {
        await transaction.unsafe(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [key]
        );
      }
    },

    async findCandidates(identity) {
      const rows = await transaction.unsafe<LeadRow[]>(
        `SELECT
           id::text,
           name,
           email_original,
           email_normalized,
           phone_original,
           phone_normalized,
           status,
           identity_status,
           first_seen_at,
           last_activity_at,
           created_at,
           updated_at,
           merged_into_lead_id::text
         FROM public.leads
         WHERE status <> 'merged'
           AND (
             ($1::text IS NOT NULL AND email_normalized = $1)
             OR ($2::text IS NOT NULL AND phone_normalized = $2)
           )
         FOR UPDATE`,
        [identity.emailNormalized, identity.phoneNormalized]
      );

      return rows.map(mapLeadRow);
    },

    async insertLead(lead: NewLeadRecord) {
      const rows = await transaction.unsafe<LeadRow[]>(
        `INSERT INTO public.leads (
           name,
           email_original,
           email_normalized,
           phone_original,
           phone_normalized,
           identity_status
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING
           id::text,
           name,
           email_original,
           email_normalized,
           phone_original,
           phone_normalized,
           status,
           identity_status,
           first_seen_at,
           last_activity_at,
           created_at,
           updated_at,
           merged_into_lead_id::text`,
        [
          lead.name,
          lead.emailOriginal,
          lead.emailNormalized,
          lead.phoneOriginal,
          lead.phoneNormalized,
          lead.identityStatus,
        ]
      );

      return mapLeadRow(rows[0]);
    },

    async markMatched(id) {
      const rows = await transaction.unsafe<LeadRow[]>(
        `UPDATE public.leads
            SET identity_status = CASE
                  WHEN identity_status = 'provisional' THEN 'matched'
                  ELSE identity_status
                END,
                last_activity_at = now(),
                updated_at = now()
          WHERE id = $1::uuid
          RETURNING
            id::text,
            name,
            email_original,
            email_normalized,
            phone_original,
            phone_normalized,
            status,
            identity_status,
            first_seen_at,
            last_activity_at,
            created_at,
            updated_at,
            merged_into_lead_id::text`,
        [id]
      );

      return mapLeadRow(rows[0]);
    },
  };
}

function mapLeadRow(row: LeadRow): LeadRecord {
  return {
    id: row.id,
    name: row.name,
    emailOriginal: row.email_original,
    emailNormalized: row.email_normalized,
    phoneOriginal: row.phone_original,
    phoneNormalized: row.phone_normalized,
    status: row.status,
    identityStatus: row.identity_status,
    firstSeenAt: new Date(row.first_seen_at),
    lastActivityAt: new Date(row.last_activity_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    mergedIntoLeadId: row.merged_into_lead_id,
  };
}
