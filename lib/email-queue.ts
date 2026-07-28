import { Resend } from "resend";
import { randomUUID } from "crypto";
import { sql } from "@/lib/db";
import { PROPERTY_AVAILABILITY_EMAIL_TYPE } from "@/lib/property-availability-notifications";
import { deliverClaimedEmail } from "@/lib/email-queue-delivery";
import {
  attemptImmediateDelivery,
  classifyEmailFailure,
  type ImmediateDeliveryState,
} from "@/lib/email-delivery";
import { downloadPrivateR2Object } from "@/lib/r2";
import {
  resolvePropertyBuyerProfileAttachment,
  type BuyerProfileAttachmentMetadata,
} from "@/lib/leads/property-buyer-profile-queue-attachment";
import {
  resolveOpenHouseInternalAttachment,
  type OpenHouseAttachmentMetadata,
} from "@/lib/leads/open-house-registration-queue-attachment";

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
  canonicalLeadId: string | null;
  relatedSubmissionType: string;
  relatedSubmissionId: string;
  dedupeKey: string;
  lastError?: string | null;
};

export type CanonicalLeadEmailInput = CanonicalLeadQueuedEmailInput & {
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
  resolveAttachments?: () => Promise<Array<{
    filename: string;
    content: string;
    contentType: string;
  }> | undefined>;
};

type PendingEmailRow = {
  id: string;
  recipient: string;
  subject: string;
  html: string;
  email_type: string;
  related_lead_id: string | null;
  related_submission_type: string | null;
  related_submission_id: string | null;
  dedupe_key: string | null;
  attempts: number;
};

export function isResendLimitError(error: unknown) {
  return classifyEmailFailure(error) === "retryable";
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

export async function recordEmailSent(input: QueuedEmailInput) {
  await sql`
    INSERT INTO public.email_queue (
      recipient, subject, html, email_type, related_property_id,
      related_lead_id, status, attempts, sent_at, last_error
    ) VALUES (
      ${input.recipient}, ${input.subject}, ${input.html}, ${input.emailType},
      ${input.relatedPropertyId || null}, ${input.relatedLeadId || null},
      'sent', 0, now(), NULL
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
      ${input.lastError || null}
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL
    DO NOTHING
    RETURNING id::text
  `;

  return inserted.length > 0 ? "queued" : "already_queued";
}

export async function deliverCanonicalLeadEmail(
  input: CanonicalLeadEmailInput,
  onError: (stage: "permanent_send" | "queue_insert", error: unknown) => void
): Promise<ImmediateDeliveryState> {
  return attemptImmediateDelivery({
    preflight: async () => {
      const rows = await sql<{ status: string }[]>`
        SELECT status
        FROM public.email_queue
        WHERE dedupe_key = ${input.dedupeKey}
        LIMIT 1
      `;
      const status = rows[0]?.status;
      if (status === "sent") return "already_sent";
      if (status === "pending" || status === "processing") {
        return "already_queued";
      }
      if (status === "failed") return "permanent_failure";
      return null;
    },
    send: async () => {
      const apiKey = process.env.RESEND_API_KEY?.trim();
      if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");
      if (!input.recipient.trim()) throw new Error("Email recipient is missing.");
      const fromEmail =
        process.env.CONTACT_FROM_EMAIL?.trim() || "onboarding@resend.dev";
      const resend = new Resend(apiKey);
      const result = await resend.emails.send(
        {
          from: `Erickson Real Estate <${fromEmail}>`,
          to: [input.recipient],
          subject: input.subject,
          html: input.html,
          attachments:
            input.attachments || (await input.resolveAttachments?.()),
        },
        { idempotencyKey: input.dedupeKey }
      );
      if (result.error) throw result.error;
      return result.data;
    },
    recordSuccess: async () => {
      await sql`
        INSERT INTO public.email_queue (
          recipient, subject, html, email_type, related_property_id,
          related_lead_id, canonical_lead_id, related_submission_type,
          related_submission_id, dedupe_key, status, attempts, sent_at,
          last_error
        ) VALUES (
          ${input.recipient}, ${input.subject}, ${input.html},
          ${input.emailType}, ${input.relatedPropertyId || null}, NULL,
          ${input.canonicalLeadId}, ${input.relatedSubmissionType},
          ${input.relatedSubmissionId}, ${input.dedupeKey}, 'sent', 0,
          now(), NULL
        )
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL
        DO NOTHING
      `;
    },
    enqueueRetry: (lastError) =>
      queueCanonicalLeadEmail({ ...input, lastError }),
    serializeError: serializeEmailError,
    onPermanentFailure: (error) => onError("permanent_send", error),
    onQueueFailure: (error) => onError("queue_insert", error),
    onRecordFailure: (error) => onError("queue_insert", error),
  });
}

export async function processPendingEmailQueue(
  limit = DEFAULT_EMAIL_QUEUE_BATCH_SIZE
) {
  return processEmailQueue({ limit });
}

export async function processEmailQueueByDedupeKeys(dedupeKeys: string[]) {
  const uniqueKeys = [...new Set(dedupeKeys.filter(Boolean))];
  if (uniqueKeys.length === 0) return { processed: 0, sent: 0, failed: 0 };
  return processEmailQueue({
    limit: Math.min(uniqueKeys.length, DEFAULT_EMAIL_QUEUE_BATCH_SIZE),
    dedupeKeys: uniqueKeys,
  });
}

async function processEmailQueue({
  limit,
  dedupeKeys,
}: {
  limit: number;
  dedupeKeys?: string[];
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const invocationId = randomUUID();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail =
    process.env.CONTACT_FROM_EMAIL?.trim() || "onboarding@resend.dev";
  const rows = await claimPendingEmails(invocationId, limit, dedupeKeys);

  let sent = 0;
  let failed = 0;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (index > 0) await wait(EMAIL_QUEUE_SEND_INTERVAL_MS);

    const outcome = await deliverClaimedEmail({
      attempts: row.attempts,
      maximumAttempts: MAX_EMAIL_ATTEMPTS,
      async send() {
        const buyerProfileAttachments = await resolvePropertyBuyerProfileAttachment({
          emailType: row.email_type,
          relatedSubmissionType: row.related_submission_type,
          relatedSubmissionId: row.related_submission_id,
          loadMetadata: loadBuyerProfileAttachmentMetadata,
          download: downloadPrivateR2Object,
        });
        const openHouseAttachments = await resolveOpenHouseInternalAttachment({
          emailType: row.email_type,
          relatedSubmissionType: row.related_submission_type,
          relatedSubmissionId: row.related_submission_id,
          loadMetadata: loadOpenHouseAttachmentMetadata,
          download: downloadPrivateR2Object,
        });
        const attachments = buyerProfileAttachments || openHouseAttachments;
        const result = await resend.emails.send(
          {
            from: `Erickson Real Estate <${fromEmail}>`,
            to: [row.recipient],
            subject: row.subject,
            html: row.html,
            attachments,
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
      classifyFailure: classifyEmailFailure,
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

async function loadOpenHouseAttachmentMetadata(
  submissionId: string
): Promise<OpenHouseAttachmentMetadata | null> {
  const rows = await sql<
    {
      object_key: string | null;
      original_name: string | null;
      content_type: string | null;
      size_bytes: number | string | null;
      status: string;
    }[]
  >`
    SELECT
      COALESCE(carta_precalificacion_key, evidencia_fondos_key) AS object_key,
      respuestas_personalizadas->'document_metadata'->>'original_name' AS original_name,
      respuestas_personalizadas->'document_metadata'->>'content_type' AS content_type,
      (respuestas_personalizadas->'document_metadata'->>'size_bytes')::bigint AS size_bytes,
      CASE
        WHEN carta_precalificacion_key IS NOT NULL THEN carta_precalificacion_status
        ELSE evidencia_fondos_status
      END AS status
    FROM public.consultas_propiedad
    WHERE id = ${submissionId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    objectKey: row.object_key,
    originalName: row.original_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    status: row.status,
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
              attempts = attempts + 1,
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

async function claimPendingEmails(
  invocationId: string,
  limit: number,
  dedupeKeys?: string[]
) {
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

    const dedupeCondition = dedupeKeys
      ? "AND dedupe_key = ANY($4::text[])"
      : "";
    const parameters: unknown[] = [
      MAX_EMAIL_ATTEMPTS,
      limit,
      invocationId,
    ];
    if (dedupeKeys) parameters.push(dedupeKeys);

    return tx.unsafe<PendingEmailRow[]>(
      `
      WITH candidates AS (
        SELECT id
        FROM email_queue
        WHERE status = 'pending'
          AND attempts < $1
          ${dedupeCondition}
          AND updated_at <= now() - CASE attempts
            WHEN 0 THEN interval '0 seconds'
            WHEN 1 THEN interval '5 minutes'
            WHEN 2 THEN interval '15 minutes'
            WHEN 3 THEN interval '1 hour'
            ELSE interval '6 hours'
          END
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
        email_queue.related_submission_type,
        email_queue.related_submission_id::text,
        email_queue.dedupe_key,
        email_queue.attempts
    `,
      parameters as never[]
    );
  });
}

async function loadBuyerProfileAttachmentMetadata(
  submissionId: string
): Promise<BuyerProfileAttachmentMetadata | null> {
  const rows = await sql<
    {
      document_object_key: string | null;
      document_original_name: string | null;
      document_content_type: string | null;
      document_size_bytes: number | string | null;
      document_status: string;
    }[]
  >`
    SELECT
      document_object_key,
      document_original_name,
      document_content_type,
      document_size_bytes,
      document_status
    FROM public.property_buyer_profiles
    WHERE id = ${submissionId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    objectKey: row.document_object_key,
    originalName: row.document_original_name,
    contentType: row.document_content_type,
    sizeBytes:
      row.document_size_bytes === null ? null : Number(row.document_size_bytes),
    status: row.document_status,
  };
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
