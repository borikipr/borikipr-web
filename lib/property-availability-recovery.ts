import { sql } from "@/lib/db";
import {
  collectAvailabilityRegistrationsInTransaction,
  queueAvailabilityNotificationIntentsInTransaction,
} from "@/lib/property-availability-enqueue";

export type AvailabilityRecoveryAudit = {
  availableProperties: number;
  eligibleRegistrations: number;
  alreadyNotified: number;
  pendingIntents: number;
  processingIntents: number;
  sentIntents: number;
  failedIntents: number;
  missingIntents: number;
};

const AVAILABILITY_DEDUPE_PREFIX = "property_availability:";

export async function auditAvailabilityNotificationRecovery(): Promise<AvailabilityRecoveryAudit> {
  const rows = await sql<
    {
      available_properties: number;
      eligible_registrations: number;
      already_notified: number;
      pending_intents: number;
      processing_intents: number;
      sent_intents: number;
      failed_intents: number;
      missing_intents: number;
    }[]
  >`
    WITH eligible AS (
      SELECT
        r.id,
        r.notified_at,
        q.status AS queue_status
      FROM public.property_priority_registrations r
      JOIN public.propiedades p ON p.id = r.property_id
      LEFT JOIN public.email_queue q
        ON q.dedupe_key =
          ${AVAILABILITY_DEDUPE_PREFIX} || p.id::text || ':' || r.id::text || ':v1'
      WHERE p.estado = 'disponible'
        AND r.email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    )
    SELECT
      (SELECT count(*)::int FROM public.propiedades WHERE estado = 'disponible')
        AS available_properties,
      count(*)::int AS eligible_registrations,
      count(*) FILTER (WHERE notified_at IS NOT NULL)::int AS already_notified,
      count(*) FILTER (WHERE queue_status = 'pending')::int AS pending_intents,
      count(*) FILTER (WHERE queue_status = 'processing')::int AS processing_intents,
      count(*) FILTER (WHERE queue_status = 'sent')::int AS sent_intents,
      count(*) FILTER (WHERE queue_status = 'failed')::int AS failed_intents,
      count(*) FILTER (
        WHERE notified_at IS NULL AND queue_status IS NULL
      )::int AS missing_intents
    FROM eligible
  `;
  const row = rows[0];
  return {
    availableProperties: row?.available_properties ?? 0,
    eligibleRegistrations: row?.eligible_registrations ?? 0,
    alreadyNotified: row?.already_notified ?? 0,
    pendingIntents: row?.pending_intents ?? 0,
    processingIntents: row?.processing_intents ?? 0,
    sentIntents: row?.sent_intents ?? 0,
    failedIntents: row?.failed_intents ?? 0,
    missingIntents: row?.missing_intents ?? 0,
  };
}

export async function queueMissingAvailabilityNotificationIntents() {
  return sql.begin(async (transaction) => {
    const properties = await transaction.unsafe<
      { id: string; slug: string; title: string }[]
    >(
      `SELECT p.id::text, p.slug, p.titulo AS title
         FROM public.propiedades p
        WHERE p.estado = 'disponible'
          AND EXISTS (
            SELECT 1
            FROM public.property_priority_registrations r
            WHERE r.property_id = p.id
              AND r.notified_at IS NULL
              AND r.email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
              AND NOT EXISTS (
                SELECT 1
                FROM public.email_queue q
                WHERE q.dedupe_key =
                  $1 || p.id::text || ':' || r.id::text || ':v1'
              )
          )
        ORDER BY p.id
        FOR UPDATE OF p`,
      [AVAILABILITY_DEDUPE_PREFIX]
    );

    let inserted = 0;
    let alreadyRecorded = 0;
    let skippedInvalidEmail = 0;
    for (const property of properties) {
      const registrations = await collectAvailabilityRegistrationsInTransaction(
        transaction,
        property.id
      );
      const result = await queueAvailabilityNotificationIntentsInTransaction(
        transaction,
        property,
        registrations
      );
      inserted += result.inserted;
      alreadyRecorded += result.alreadyRecorded;
      skippedInvalidEmail += result.skippedInvalidEmail;
    }
    return {
      propertiesReviewed: properties.length,
      inserted,
      alreadyRecorded,
      skippedInvalidEmail,
    };
  });
}
