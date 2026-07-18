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

export async function enqueueAvailabilityNotificationsInTransaction(
  transaction: postgres.TransactionSql,
  property: AvailabilityProperty
) {
  const rows = await transaction.unsafe<RegistrationRow[]>(
    `SELECT id::text, lead_id::text, name, email
       FROM public.property_priority_registrations
      WHERE property_id = $1::uuid
        AND notified_at IS NULL
      ORDER BY created_at ASC, id ASC
      FOR UPDATE`,
    [property.id]
  );

  let queued = 0;
  let alreadyQueued = 0;
  let skippedInvalidEmail = 0;

  for (const row of rows) {
    if (!isEligibleAvailabilityEmail(row.email)) {
      skippedInvalidEmail += 1;
      continue;
    }

    const registration: AvailabilityRegistration = {
      id: row.id,
      leadId: row.lead_id,
      name: row.name,
      email: row.email,
    };
    const email = buildPropertyAvailabilityEmail({ property, registration });
    const inserted = await transaction.unsafe<{ id: string }[]>(
      `INSERT INTO public.email_queue (
         recipient, subject, html, email_type, related_property_id,
         related_lead_id, canonical_lead_id, related_submission_type,
         related_submission_id, dedupe_key, status, attempts, last_error
       ) VALUES (
         $1, $2, $3, $4, $5::uuid, $6::uuid, $7::uuid, $8, $9::uuid,
         $10, 'pending', 0, NULL
       )
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL
       DO NOTHING
       RETURNING id::text`,
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
        buildPropertyAvailabilityDedupeKey(property.id, registration.id),
      ]
    );

    if (inserted.length > 0) queued += 1;
    else alreadyQueued += 1;
  }

  return {
    eligibleRegistrations: rows.length - skippedInvalidEmail,
    queued,
    alreadyQueued,
    skippedInvalidEmail,
  };
}
