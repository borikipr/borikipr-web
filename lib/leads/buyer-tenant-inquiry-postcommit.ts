import { buildBuyerTenantInternalEmail } from "./buyer-tenant-inquiry-email";
import type { PersistedBuyerTenantInquiry } from "./postgres-buyer-tenant-inquiry";

export async function queueBuyerTenantInternalNotification({
  inquiry,
  recipient,
  deliver,
  onError,
}: {
  inquiry: PersistedBuyerTenantInquiry;
  recipient: string;
  deliver: (input: {
    recipient: string;
    subject: string;
    html: string;
    emailType: string;
    canonicalLeadId: string;
    relatedSubmissionType: string;
    relatedSubmissionId: string;
    dedupeKey: string;
  }, onError: (stage: "permanent_send" | "queue_insert", error: unknown) => void) => Promise<
    | "sent"
    | "queued"
    | "already_sent"
    | "already_queued"
    | "permanent_failure"
    | "failed_to_queue"
  >;
  onError: (stage: "permanent_send" | "queue_insert", error: unknown) => void;
}) {
  try {
    const email = buildBuyerTenantInternalEmail(inquiry);
    return await deliver({
      recipient,
      subject: email.subject,
      html: email.html,
      emailType: "buyer_tenant_inquiry_internal",
      canonicalLeadId: inquiry.leadId,
      relatedSubmissionType: "buyer_tenant_inquiry",
      relatedSubmissionId: inquiry.id,
      dedupeKey: `buyer_tenant_inquiry:${inquiry.id}:internal:v1`,
    }, onError);
  } catch (error) {
    onError("permanent_send", error);
    return "permanent_failure" as const;
  }
}
