import { Resend } from "resend";
import { randomUUID } from "crypto";
import { sql } from "@/lib/db";
import { PROPERTY_AVAILABILITY_EMAIL_TYPE } from "@/lib/property-availability-notifications";
import { deliverClaimedEmail } from "@/lib/email-queue-delivery";

const MAX_EMAIL_ATTEMPTS = 5;
const STALE_PROCESSING_TIMEOUT = "15 minutes";
export const DEFAULT_EMAIL_QUEUE_BATCH_SIZE = 100;
export const EMAIL_QUEUE_SEND_INTERVAL_MS = 250;

export type QueuedEmailInput = {
  recipient: string;
  subject: string;
  html: string;
  emailType: string;
  relatedPropertyId?: string | null;
  relatedLeadId?: string | null;
  lastError?: string | null;
};

export type CanonicalLeadQueuedEmailInput = {
  recipient: string;
  subject: string;
  html: string;
  emailType: string;
  relatedPropertyId?: string | null;
  canonicalLeadId: string;
  relatedSubmissionType: string;
  relatedSubmissionId: string;
  dedupeKey: string;
};

type PendingEmailRow = {
  id: string;
  recipient: string;
  subject: string;
  html: string;
  email_type: string;
  related_lead_id: string | null;
  dedupe_key: string | null;
  attempts: number;
};

export function isResendLimitError(error: unknown) {
  const details = error as {
    name?: unknown;
    message?: unknown;
    statusCode?: unknown;
    status?: unknown;
    code?: unknown;
  };
  const status = Number(details?.statusCode ?? details?.status ?? 0);
  const text = [
    details?.name,
    details?.message,
    details?.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    status === 429 ||
    text.includes("rate limit") ||
    text.includes("rate_limit") ||
    text.includes("quota") ||
    text.includes("daily") ||
    text.includes("limit exceeded") ||
    text.includes("too many requests")
  );
}

export function serializeEmailError(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const details = error as {
      name?: unknown;
      message?: unknown;
      statusCode?: unknown;
      status?: unknown;
      code?: unknown;
    };

    return JSON.stringify({
      name: details.name,
      message: details.message,
      statusCode: details.statusCode ?? details.status,
      code: details.code,
    }).slice(0, 2000);
  }

  return String(error ?? "Unknown email error").slice(0, 2000);
}

export async function queueEmail(input: QueuedEmailInput) {
  if (input.relatedLeadId) {
    const existing = await sql<{ id: string }[]>`
      SELECT id::text
      FROM email_queue
      WHERE status = 'pending'
        AND related_lead_id = ${input.relatedLeadId}
        AND email_type = ${input.emailType}
        AND lower(recipient) = lower(${input.recipient})
      LIMIT 1
    `;

    if (existing.length > 0) {
      return;
    }
  }

  await sql`
    INSERT INTO email_queue (
      recipient,
      subject,
      html,
      email_type,
      related_property_id,
      related_lead_id,
      status,
      attempts,
      last_error
    ) VALUES (
      ${input.recipient},
      ${input.subject},
      ${input.html},
      ${input.emailType},
      ${input.relatedPropertyId || null},
      ${input.relatedLeadId || null},
      'pending',
      0,
      ${input.lastError || null}
    )
  `;
}

export async function queueCanonicalLeadEmail(
  input: CanonicalLeadQueuedEmailInput
) {
  const inserted = await sql<{ id: string }[]>`
    INSERT INTO email_queue (
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
      ${input.recipient},
      ${input.subject},
      ${input.html},
      ${input.emailType},
      ${input.relatedPropertyId || null},
      NULL,
      ${input.canonicalLeadId},
      ${input.relatedSubmissionType},
      ${input.relatedSubmissionId},
      ${input.dedupeKey},
      'pending',
      0,
      NULL
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL
    DO NOTHING
    RETURNING id::text
  `;

  return inserted.length > 0 ? "queued" : "already_queued";
}

export async function processPendingEmailQueue(
  limit = DEFAULT_EMAIL_QUEUE_BATCH_SIZE
) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const invocationId = randomUUID();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail =
    process.env.CONTACT_FROM_EMAIL?.trim() || "onboarding@resend.dev";
  const rows = await claimPendingEmails(invocationId, limit);

  let sent = 0;
  let failed = 0;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (index > 0) await wait(EMAIL_QUEUE_SEND_INTERVAL_MS);

    const outcome = await deliverClaimedEmail({
      attempts: row.attempts,
      maximumAttempts: MAX_EMAIL_ATTEMPTS,
      async send() {
        const result = await resend.emails.send(
          {
            from: `Erickson Real Estate <${fromEmail}>`,
            to: [row.recipient],
            subject: row.subject,
            html: row.html,
          },
          row.dedupe_key ? { idempotencyKey: row.dedupe_key } : undefined
        );
        if (result.error) throw result.error;
      },
      async markFailure({ error, attempts, terminal }) {
        await sql`
          UPDATE email_queue
          SET
            attempts = ${attempts},
            status = ${terminal ? "failed" : "pending"},
            last_error = ${serializeEmailError(error)},
            locked_at = NULL,
            locked_by = NULL,
            updated_at = now()
          WHERE id = ${row.id}
            AND status = 'processing'
            AND locked_by = ${invocationId}
        `;
      },
      async markSuccess() {
        await finalizeSuccessfulEmail(row, invocationId);
      },
    });

    if (outcome.status === "sent") sent += 1;
    else failed += 1;
  }

  return {
    processed: rows.length,
    sent,
    failed,
  };
}

async function finalizeSuccessfulEmail(
  row: PendingEmailRow,
  invocationId: string
) {
  await sql.begin(async (transaction) => {
    const finalized = await transaction.unsafe<{ id: string }[]>(
      `UPDATE public.email_queue
          SET status = 'sent',
              sent_at = now(),
              locked_at = NULL,
              locked_by = NULL,
              updated_at = now(),
              last_error = NULL
        WHERE id = $1::uuid
          AND status = 'processing'
          AND locked_by = $2
        RETURNING id::text`,
      [row.id, invocationId]
    );
    if (finalized.length === 0) return;

    if (
      row.email_type === "priority_registration_confirmation" &&
      row.related_lead_id
    ) {
      await transaction.unsafe(
        `UPDATE public.property_priority_registrations
            SET confirmation_sent_at = now()
          WHERE id = $1::uuid
            AND confirmation_sent_at IS NULL`,
        [row.related_lead_id]
      );
    }

    if (
      row.email_type === PROPERTY_AVAILABILITY_EMAIL_TYPE &&
      row.related_lead_id
    ) {
      await transaction.unsafe(
        `UPDATE public.property_priority_registrations
            SET notified_at = now()
          WHERE id = $1::uuid
            AND notified_at IS NULL`,
        [row.related_lead_id]
      );
    }
  });
}

async function claimPendingEmails(invocationId: string, limit: number) {
  return sql.begin(async (tx) => {
    await tx.unsafe(
      `
      UPDATE email_queue
      SET
        status = 'pending',
        locked_at = NULL,
        locked_by = NULL,
        updated_at = now()
      WHERE status = 'processing'
        AND locked_at < now() - interval '${STALE_PROCESSING_TIMEOUT}'
    `
    );

    return tx.unsafe<PendingEmailRow[]>(
      `
      WITH candidates AS (
        SELECT id
        FROM email_queue
        WHERE status = 'pending'
          AND attempts < $1
        ORDER BY created_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      UPDATE email_queue
      SET
        status = 'processing',
        locked_at = now(),
        locked_by = $3,
        updated_at = now()
      FROM candidates
      WHERE email_queue.id = candidates.id
      RETURNING
        email_queue.id::text,
        email_queue.recipient,
        email_queue.subject,
        email_queue.html,
        email_queue.email_type,
        email_queue.related_lead_id::text,
        email_queue.dedupe_key,
        email_queue.attempts
    `,
      [MAX_EMAIL_ATTEMPTS, limit, invocationId]
    );
  });
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
