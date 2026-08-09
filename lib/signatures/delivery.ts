import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import type { SignatureDatabase } from "./domain/types";
import type { SignatureDeliveryLocale } from "./delivery-template";
import { renderSignatureCompletionDelivery, renderSignatureInvitation } from "./delivery-template";

export type SignatureMailTransport = Readonly<{
  send(input: { recipient: string; subject: string; html: string; idempotencyKey: string }): Promise<{ reference?: string | null }>;
}>;

type DeliveryDomain = Readonly<{
  issueSigningToken(input: {
    participantId: string; documentVersionId: string; expiresAt: Date; keyVersion: number;
    actorAdminId: string; idempotencyKey: string; supersedeExisting?: boolean;
    purpose?: "sign_document" | "completed_document_access";
  }): Promise<{ tokenId: string; plaintextToken: string; expiresAt: string }>;
  revokeSigningToken(input: { tokenId: string; actorAdminId: string; idempotencyKey: string }): Promise<unknown>;
  appendEvent(input: Record<string, unknown>): Promise<unknown>;
}>;

function sanitizeFailure(error: unknown) {
  const status = Number((error as { status?: unknown; statusCode?: unknown })?.status ?? (error as { statusCode?: unknown })?.statusCode ?? 0);
  return status === 429 || status >= 500 ? "delivery_provider_unavailable" : "delivery_failed";
}

export function createResendSignatureTransport(): SignatureMailTransport {
  return {
    async send(input) {
      const apiKey = process.env.RESEND_API_KEY?.trim();
      const from = process.env.CONTACT_FROM_EMAIL?.trim();
      if (!apiKey || !from) throw new Error("signature_email_not_configured");
      const result = await new Resend(apiKey).emails.send({
        from: `Erickson Real Estate <${from}>`, to: [input.recipient],
        subject: input.subject, html: input.html,
      }, { idempotencyKey: input.idempotencyKey });
      if (result.error) throw result.error;
      return { reference: result.data?.id ?? null };
    },
  };
}

export function createSignatureDeliveryService(input: {
  database: SignatureDatabase;
  domain: DeliveryDomain;
  mail: SignatureMailTransport;
  publicBaseUrl: string;
  tokenKeyVersion: number;
  now?: () => Date;
}) {
  const clock = input.now ?? (() => new Date());
  const origin = new URL(input.publicBaseUrl).origin;

  async function appendDeliveryEvent(data: {
    documentId: string; documentVersionId: string; participantId: string;
    sourceSha256: string; eventType: string; idempotencyKey: string;
    deliveryId: string; status?: string;
  }) {
    await input.domain.appendEvent({
      documentId: data.documentId, documentVersionId: data.documentVersionId,
      participantId: data.participantId, eventType: data.eventType,
      actorClass: "delivery", versionHash: data.sourceSha256,
      controlledMetadata: {
        delivery_id: data.deliveryId, delivery_channel: "email",
        ...(data.status ? { delivery_status: data.status } : {}),
      }, idempotencyKey: data.idempotencyKey,
    });
  }

  async function createIntent(data: {
    participantId: string; documentVersionId: string; locale: SignatureDeliveryLocale;
    actorAdminId: string; idempotencyKey: string; kind?: "invitation" | "completed_document";
  }) {
    const result = await input.database.begin(async (tx) => {
      const rows = await tx.unsafe<{
        document_id: string; source_sha256: string; normalized_email: string;
        participant_status: string; document_status: string;
      }>(`SELECT v.document_id::text, v.source_sha256, p.normalized_email,
                  p.status AS participant_status, d.status AS document_status
             FROM public.signature_participants p
             JOIN public.signature_document_versions v ON v.id=p.document_version_id
             JOIN public.signature_documents d ON d.id=v.document_id
            WHERE p.id=$1::uuid AND p.document_version_id=$2::uuid FOR UPDATE OF p`,
        [data.participantId, data.documentVersionId]);
      const binding = rows[0];
      const kind = data.kind ?? "invitation";
      if (!binding || (kind === "invitation" && !["sent","viewed","partially_signed"].includes(binding.document_status))
        || (kind === "completed_document" && (binding.document_status !== "completed" || binding.participant_status !== "completed"))) {
        throw new Error("signature_delivery_not_eligible");
      }
      const inserted = await tx.unsafe<{ id: string }>(
        `INSERT INTO public.signature_delivery_intents (
           participant_id, document_version_id, delivery_kind, locale,
           recipient_email_snapshot, idempotency_key, created_by_admin_id
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::uuid,$7::uuid)
         ON CONFLICT (idempotency_key) DO NOTHING RETURNING id::text`,
        [data.participantId, data.documentVersionId, kind, data.locale,
          binding.normalized_email, data.idempotencyKey, data.actorAdminId]
      );
      if (!inserted[0]) {
        const existing = await tx.unsafe<{ id: string }>(
          `SELECT id::text FROM public.signature_delivery_intents WHERE idempotency_key=$1::uuid`,
          [data.idempotencyKey]
        );
        return { intentId: existing[0].id, created: false, binding };
      }
      return { intentId: inserted[0].id, created: true, binding };
    });
    if (result.created) await appendDeliveryEvent({
      documentId: result.binding.document_id, documentVersionId: data.documentVersionId,
      participantId: data.participantId, sourceSha256: result.binding.source_sha256,
      eventType: "invitation_created", idempotencyKey: randomUUID(),
      deliveryId: result.intentId, status: "pending",
    });
    return { intentId: result.intentId, created: result.created };
  }

  async function deliverIntent(intentId: string) {
    const workerId = randomUUID();
    const claimed = await input.database.begin(async (tx) => {
      const rows = await tx.unsafe<{
        id: string; participant_id: string; document_version_id: string;
        delivery_kind: "invitation" | "completed_document"; locale: SignatureDeliveryLocale;
        recipient_email_snapshot: string; attempts: number; created_by_admin_id: string;
        document_id: string; source_sha256: string; title: string; role: string;
        expires_at: string | Date;
      }>(`SELECT di.id::text, di.participant_id::text, di.document_version_id::text,
                  di.delivery_kind, di.locale, di.recipient_email_snapshot, di.attempts,
                  di.created_by_admin_id::text, v.document_id::text, v.source_sha256,
                  d.title, p.role, d.expires_at
             FROM public.signature_delivery_intents di
             JOIN public.signature_participants p ON p.id=di.participant_id
             JOIN public.signature_document_versions v ON v.id=di.document_version_id
             JOIN public.signature_documents d ON d.id=v.document_id
            WHERE di.id=$1::uuid AND di.status='pending' AND di.attempts<5
            FOR UPDATE OF di`, [intentId]);
      if (!rows[0]) return null;
      await tx.unsafe(`UPDATE public.signature_delivery_intents SET status='processing',
        locked_at=$2::timestamptz, locked_by=$3::uuid, attempted_at=$2::timestamptz,
        attempts=attempts+1, updated_at=$2::timestamptz WHERE id=$1::uuid`,
        [intentId, clock().toISOString(), workerId]);
      return rows[0];
    });
    if (!claimed) return { status: "not_claimed" as const };

    const requestedExpiry = new Date(claimed.expires_at);
    const completionExpiry = new Date(clock().getTime() + 24 * 60 * 60_000);
    const tokenExpiry = claimed.delivery_kind === "invitation" ? requestedExpiry : completionExpiry;
    const token = await input.domain.issueSigningToken({
      participantId: claimed.participant_id, documentVersionId: claimed.document_version_id,
      expiresAt: tokenExpiry, keyVersion: input.tokenKeyVersion,
      actorAdminId: claimed.created_by_admin_id, idempotencyKey: randomUUID(),
      supersedeExisting: true,
      purpose: claimed.delivery_kind === "invitation" ? "sign_document" : "completed_document_access",
    });
    await input.database.unsafe(
      `UPDATE public.signature_delivery_intents SET token_id=$2::uuid WHERE id=$1::uuid AND locked_by=$3::uuid`,
      [intentId, token.tokenId, workerId]
    );
    const path = claimed.delivery_kind === "invitation" ? `/firmar/${token.plaintextToken}` : `/firmar/completado/${token.plaintextToken}`;
    const url = `${origin}${path}`;
    const message = claimed.delivery_kind === "invitation"
      ? renderSignatureInvitation({ locale: claimed.locale, documentTitle: claimed.title,
          participantRole: claimed.role, expiresAt: tokenExpiry, signingUrl: url })
      : renderSignatureCompletionDelivery({ locale: claimed.locale, documentTitle: claimed.title,
          expiresAt: tokenExpiry, accessUrl: url });
    await appendDeliveryEvent({
      documentId: claimed.document_id, documentVersionId: claimed.document_version_id,
      participantId: claimed.participant_id, sourceSha256: claimed.source_sha256,
      eventType: "invitation_delivery_attempted", idempotencyKey: randomUUID(),
      deliveryId: intentId, status: "processing",
    });
    let deliveryResult: { reference?: string | null };
    try {
      deliveryResult = await input.mail.send({ recipient: claimed.recipient_email_snapshot,
        subject: message.subject, html: message.html, idempotencyKey: intentId });
    } catch (error) {
      const code = sanitizeFailure(error);
      await input.database.unsafe(`UPDATE public.signature_delivery_intents
        SET status='failed',
            last_error_code=$2, locked_at=NULL, locked_by=NULL, updated_at=$3::timestamptz
        WHERE id=$1::uuid AND locked_by=$4::uuid`, [intentId, code, clock().toISOString(), workerId]);
      await input.domain.revokeSigningToken({ tokenId: token.tokenId,
        actorAdminId: claimed.created_by_admin_id, idempotencyKey: randomUUID() });
      await appendDeliveryEvent({
        documentId: claimed.document_id, documentVersionId: claimed.document_version_id,
        participantId: claimed.participant_id, sourceSha256: claimed.source_sha256,
        eventType: "invitation_delivery_failed", idempotencyKey: randomUUID(),
        deliveryId: intentId, status: code,
      });
      return { status: "failed" as const, retryable: false };
    }
    await input.database.begin(async (tx) => {
      await tx.unsafe(`UPDATE public.signature_delivery_intents SET status='sent', delivered_at=$2::timestamptz,
        provider_message_reference=$3, locked_at=NULL, locked_by=NULL, updated_at=$2::timestamptz
        WHERE id=$1::uuid AND locked_by=$4::uuid`, [intentId, clock().toISOString(), deliveryResult.reference ?? null, workerId]);
      if (claimed.delivery_kind === "invitation") {
        await tx.unsafe(`UPDATE public.signature_participants SET status=CASE WHEN status='pending' THEN 'invited' ELSE status END,
          invited_at=coalesce(invited_at,$2::timestamptz), delivery_sent_at=$2::timestamptz WHERE id=$1::uuid`,
          [claimed.participant_id, clock().toISOString()]);
      }
    });
    await appendDeliveryEvent({
      documentId: claimed.document_id, documentVersionId: claimed.document_version_id,
      participantId: claimed.participant_id, sourceSha256: claimed.source_sha256,
      eventType: "invitation_delivery_succeeded", idempotencyKey: randomUUID(),
      deliveryId: intentId, status: "sent",
    });
    if (claimed.delivery_kind === "invitation") {
      await appendDeliveryEvent({
        documentId: claimed.document_id, documentVersionId: claimed.document_version_id,
        participantId: claimed.participant_id, sourceSha256: claimed.source_sha256,
        eventType: "participant_invited", idempotencyKey: randomUUID(),
        deliveryId: intentId, status: "invited",
      });
    }
    return { status: "sent" as const };
  }

  async function reissueInvitation(data: {
    participantId: string; documentVersionId: string; locale: SignatureDeliveryLocale;
    actorAdminId: string; idempotencyKey: string;
  }) {
    const rows = await input.database.unsafe<{ document_status: string; participant_status: string; token_id: string | null }>(
      `SELECT d.status AS document_status, p.status AS participant_status,
              (SELECT token_id::text FROM public.signature_delivery_intents di
                WHERE di.participant_id=p.id AND di.delivery_kind='invitation'
                ORDER BY di.created_at DESC LIMIT 1) AS token_id
         FROM public.signature_participants p
         JOIN public.signature_document_versions v ON v.id=p.document_version_id
         JOIN public.signature_documents d ON d.id=v.document_id
        WHERE p.id=$1::uuid AND p.document_version_id=$2::uuid`,
      [data.participantId, data.documentVersionId]
    );
    if (!rows[0] || ["completed","voided","expired"].includes(rows[0].document_status)
      || rows[0].participant_status === "completed") throw new Error("signature_resend_not_allowed");
    if (rows[0].token_id) await input.domain.revokeSigningToken({ tokenId: rows[0].token_id,
      actorAdminId: data.actorAdminId, idempotencyKey: randomUUID() });
    const result = await createIntent(data);
    if (result.created) {
      const context = await input.database.unsafe<{ document_id: string; source_sha256: string }>(
        `SELECT v.document_id::text, v.source_sha256 FROM public.signature_document_versions v
          WHERE v.id=$1::uuid`, [data.documentVersionId]
      );
      if (context[0]) await appendDeliveryEvent({
        documentId: context[0].document_id, documentVersionId: data.documentVersionId,
        participantId: data.participantId, sourceSha256: context[0].source_sha256,
        eventType: "invitation_reissued", idempotencyKey: randomUUID(),
        deliveryId: result.intentId, status: "pending",
      });
    }
    return result;
  }

  async function processPending(limit = 10) {
    const rows = await input.database.unsafe<{ id: string }>(
      `SELECT id::text FROM public.signature_delivery_intents
        WHERE status='pending' AND attempts<5 ORDER BY created_at LIMIT $1`,
      [Math.min(Math.max(limit, 1), 10)]
    );
    let sent = 0; let failed = 0;
    for (const row of rows) {
      const result = await deliverIntent(row.id);
      if (result.status === "sent") sent += 1;
      if (result.status === "failed") failed += 1;
    }
    return { processed: rows.length, sent, failed };
  }

  return { createIntent, deliverIntent, reissueInvitation, processPending };
}
