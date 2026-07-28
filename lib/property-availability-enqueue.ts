import type postgres from "postgres";
import {
  buildPropertyAvailabilityDedupeKey,
  buildPropertyAvailabilityEmail,
  isEligibleAvailabilityEmail,
  PROPERTY_AVAILABILITY_EMAIL_TYPE,
  PROPERTY_AVAILABILITY_SUBMISSION_TYPE,
  type AvailabilityProperty,
  type AvailabilityRegistration,
} from "@/lib/property-availability-notifications";

type RegistrationRow = {
  id: string;
  lead_id: string | null;
  name: string;
  email: string;
};

export async function collectAvailabilityRegistrationsInTransaction(
  transaction: postgres.TransactionSql,
  propertyId: string
) {
  const rows = await transaction.unsafe<RegistrationRow[]>(
    `SELECT id::text, lead_id::text, name, email
       FROM public.property_priority_registrations
      WHERE property_id = $1::uuid
        AND notified_at IS NULL
      ORDER BY created_at ASC, id ASC
      FOR UPDATE`,
    [propertyId]
  );
  return rows.map((row) => ({
    id: row.id,
    leadId: row.lead_id,
    name: row.name,
    email: row.email,
  }));
}

export async function queueAvailabilityNotificationIntentsInTransaction(
  transaction: postgres.TransactionSql,
  property: AvailabilityProperty,
  registrations: AvailabilityRegistration[]
) {
  const totals = {
    eligibleRegistrations: 0,
    inserted: 0,
    alreadyRecorded: 0,
    skippedInvalidEmail: 0,
  };
  const dedupeKeys: string[] = [];

  for (const registration of registrations) {
    if (!isEligibleAvailabilityEmail(registration.email)) {
      totals.skippedInvalidEmail += 1;
      continue;
    }
    totals.eligibleRegistrations += 1;
    const email = buildPropertyAvailabilityEmail({ property, registration });
    const dedupeKey = buildPropertyAvailabilityDedupeKey(
      property.id,
      registration.id
    );
    const inserted = await transaction.unsafe<{ dedupe_key: string }[]>(
      `INSERT INTO public.email_queue (
         recipient,
         subject,
         html,
         email_type,
         related_property_id,
         related_lead_id,
         canonical_lead_id,
         related_submission_type,
         related_submission_id,
         dedupe_key,
         status,
         attempts,
         last_error
       ) VALUES (
         $1, $2, $3, $4, $5::uuid, $6::uuid, $7::uuid, $8, $9::uuid,
         $10, 'pending', 0, NULL
       )
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL
       DO NOTHING
       RETURNING dedupe_key`,
      [
        registration.email,
        email.subject,
        email.html,
        PROPERTY_AVAILABILITY_EMAIL_TYPE,
        property.id,
        registration.id,
        registration.leadId,
        PROPERTY_AVAILABILITY_SUBMISSION_TYPE,
        registration.id,
        dedupeKey,
      ]
    );
    if (inserted.length > 0) {
      totals.inserted += 1;
      dedupeKeys.push(dedupeKey);
    } else {
      totals.alreadyRecorded += 1;
    }
  }
  return { ...totals, dedupeKeys };
}

export async function deliverAvailabilityNotificationIntents(
  dedupeKeys: string[]
) {
  if (dedupeKeys.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }
  try {
    const { processEmailQueueByDedupeKeys } = await import("@/lib/email-queue");
    return await processEmailQueueByDedupeKeys(dedupeKeys);
  } catch (error) {
    console.error("PROPERTY AVAILABILITY DELIVERY", {
      event: "property_availability_immediate_processing_failed",
      intentCount: dedupeKeys.length,
      error: safeError(error),
    });
    return { processed: 0, sent: 0, failed: dedupeKeys.length };
  }
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: String(error) };
}
