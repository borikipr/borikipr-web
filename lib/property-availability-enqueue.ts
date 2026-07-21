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

export async function deliverAvailabilityNotifications(
  property: AvailabilityProperty,
  registrations: AvailabilityRegistration[]
) {
  const { deliverCanonicalLeadEmail } = await import("@/lib/email-queue");
  const totals = {
    eligibleRegistrations: 0,
    sent: 0,
    queued: 0,
    alreadyHandled: 0,
    permanentFailures: 0,
    failedToQueue: 0,
    skippedInvalidEmail: 0,
  };

  for (const registration of registrations) {
    if (!isEligibleAvailabilityEmail(registration.email)) {
      totals.skippedInvalidEmail += 1;
      continue;
    }
    totals.eligibleRegistrations += 1;
    const email = buildPropertyAvailabilityEmail({ property, registration });
    const state = await deliverCanonicalLeadEmail(
      {
        recipient: registration.email,
        subject: email.subject,
        html: email.html,
        emailType: PROPERTY_AVAILABILITY_EMAIL_TYPE,
        relatedPropertyId: property.id,
        canonicalLeadId: registration.leadId,
        relatedSubmissionType: PROPERTY_AVAILABILITY_SUBMISSION_TYPE,
        relatedSubmissionId: registration.id,
        dedupeKey: buildPropertyAvailabilityDedupeKey(
          property.id,
          registration.id
        ),
      },
      (stage, error) => {
        console.error("PROPERTY AVAILABILITY EMAIL", {
          stage,
          registrationId: registration.id,
          error: safeError(error),
        });
      }
    );

    if (state === "sent" || state === "already_sent") {
      if (state === "sent") totals.sent += 1;
      else totals.alreadyHandled += 1;
      await markAvailabilityNotified(registration.id);
    } else if (state === "queued") totals.queued += 1;
    else if (state === "already_queued") totals.alreadyHandled += 1;
    else if (state === "failed_to_queue") totals.failedToQueue += 1;
    else totals.permanentFailures += 1;
  }
  return totals;
}

async function markAvailabilityNotified(registrationId: string) {
  try {
    const { sql } = await import("@/lib/db");
    await sql`
      UPDATE public.property_priority_registrations
      SET notified_at = now()
      WHERE id = ${registrationId}
        AND notified_at IS NULL
    `;
  } catch (error) {
    console.error("PROPERTY AVAILABILITY NOTIFIED_AT", {
      registrationId,
      error: safeError(error),
    });
  }
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: String(error) };
}
