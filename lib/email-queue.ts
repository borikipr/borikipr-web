import { Resend } from "resend";
import { randomUUID } from "crypto";
import { sql } from "@/lib/db";

const MAX_EMAIL_ATTEMPTS = 5;
const STALE_PROCESSING_TIMEOUT = "15 minutes";

export type QueuedEmailInput = {
  recipient: string;
  subject: string;
  html: string;
  emailType: string;
  relatedPropertyId?: string | null;
  relatedLeadId?: string | null;
  lastError?: string | null;
};

type PendingEmailRow = {
  id: string;
  recipient: string;
  subject: string;
  html: string;
  email_type: string;
  related_lead_id: string | null;
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

export async function processPendingEmailQueue(limit = 20) {
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

  for (const row of rows) {
    const { error } = await resend.emails.send({
      from: `Erickson Real Estate <${fromEmail}>`,
      to: [row.recipient],
      subject: row.subject,
      html: row.html,
    });

    if (error) {
      failed += 1;
      const attempts = row.attempts + 1;
      await sql`
        UPDATE email_queue
        SET
          attempts = ${attempts},
          status = ${attempts >= MAX_EMAIL_ATTEMPTS ? "failed" : "pending"},
          last_error = ${serializeEmailError(error)},
          locked_at = NULL,
          locked_by = NULL,
          updated_at = now()
        WHERE id = ${row.id}
          AND status = 'processing'
          AND locked_by = ${invocationId}
      `;
      continue;
    }

    sent += 1;
    await sql`
      UPDATE email_queue
      SET
        status = 'sent',
        sent_at = now(),
        locked_at = NULL,
        locked_by = NULL,
        updated_at = now(),
        last_error = NULL
      WHERE id = ${row.id}
        AND status = 'processing'
        AND locked_by = ${invocationId}
    `;

    if (
      row.email_type === "priority_registration_confirmation" &&
      row.related_lead_id
    ) {
      await sql`
        UPDATE property_priority_registrations
        SET confirmation_sent_at = now()
        WHERE id = ${row.related_lead_id}
          AND confirmation_sent_at IS NULL
      `;
    }
  }

  return {
    processed: rows.length,
    sent,
    failed,
  };
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
        email_queue.attempts
    `,
      [MAX_EMAIL_ATTEMPTS, limit, invocationId]
    );
  });
}
